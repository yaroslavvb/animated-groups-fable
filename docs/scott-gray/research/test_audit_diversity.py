"""Tiny fixture regressions for cache reuse; never compare the published atlas."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('audit_diversity',Path(__file__).with_name('audit-diversity.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)


class AuditReuseTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory();self.root=Path(self.temporary.name)
        for family in ['', 'p6']:
            data=self.root/family/'data';data.mkdir(parents=True)
            name='candidate-orbits.json' if family else 'verified-orbits.json'
            (data/name).write_text(json.dumps({'orbits':[]}))
        self.paths=[];entries=[]
        for name in ['first','second']:
            directory=self.root/'data/orbits';directory.mkdir(exist_ok=True)
            path=directory/f'{name}.json';payload=struct.pack('<128f',*([.2]*128));(directory/f'{name}.f32').write_bytes(payload)
            c={'groupId':'g95','N':4,'M':4,'period':300.,'L':256.,'ops':[],
               'params':{'F':.004,'k':.02,'Du':.16,'Dv':.08,'dx':64.,'stencil':'five-point'}}
            m={'schema':'scott-gray-orbit-binary-v1','config':c,'fieldEncoding':'float32-le','fieldLayout':'frame-major; planar U then V; x-fast',
               'fieldValueCount':128,'fieldByteLength':512,'fieldUrl':name+'.f32','fieldSha256':hashlib.sha256(payload).hexdigest(),'diversityAdmission':{'validated':True}}
            path.write_text(json.dumps(m));self.paths.append(path)
            entries.append({'groupId':'g95','url':str(path.relative_to(self.root)),'patternName':name})
        (self.root/'data/verified-orbits.json').write_text(json.dumps({'orbits':entries}))
        self.root_patch=patch.object(audit,'ROOT',self.root);self.root_patch.start()
        self.records,self.jobs=audit.collect_records()
        self.result={'family':'p4','groupId':'g95','first':self.records[0]['path'],'second':self.records[1]['path'],'amplitudeNormalizedShapeRms':.75}
        self.old={'comparisonCodeSha256':'code-v1','records':copy.deepcopy(self.records),'pairs':[self.result]}

    def tearDown(self):
        self.root_patch.stop();self.temporary.cleanup()

    def cached(self,records=None,code='code-v1'):
        return audit.reusable_pairs(self.old,records or self.records,code)

    def test_unchanged_payload_and_full_config_reuse_existing_result(self):
        records,jobs=audit.collect_records();self.assertEqual(len(jobs),1)
        self.assertEqual(list(self.cached(records).values()),[self.result])
        self.assertEqual(records[0]['name'],'first')  # patternName is sufficient without name.

    def test_changed_comparison_code_forces_recomputation(self):
        self.assertEqual(self.cached(code='code-v2'),{})

    def test_every_relevant_config_change_invalidates_reuse(self):
        for mutate in [lambda c:c.update(period=301),lambda c:c.update(N=8),lambda c:c.update(M=8),
                       lambda c:c.update(L=512),lambda c:c.update(seed='another'),
                       lambda c:c['params'].update(F=.00401),lambda c:c.update(ops=[{'tau':.5}])]:
            records=copy.deepcopy(self.records);mutate(records[0]['config']);self.assertEqual(self.cached(records),{})

    def test_new_actual_payload_and_matching_new_metadata_hash_invalidate_old_result(self):
        path=self.paths[0];m=json.loads(path.read_text());payload=struct.pack('<128f',*([.21]*128));(path.parent/m['fieldUrl']).write_bytes(payload)
        m['fieldSha256']=hashlib.sha256(payload).hexdigest();path.write_text(json.dumps(m))
        records,_=audit.collect_records();self.assertEqual(self.cached(records),{})

    def test_payload_tampering_without_hash_update_is_rejected_before_reuse(self):
        path=self.paths[0].with_suffix('.f32');payload=bytearray(path.read_bytes());payload[0]^=1;path.write_bytes(payload)
        with self.assertRaisesRegex(ValueError,'Actual saved field hash'):audit.collect_records()

    def test_encoding_layout_and_size_cannot_hide_behind_same_hash(self):
        path=self.paths[0];original=json.loads(path.read_text())
        for change in [{'fieldEncoding':'float64-le'},{'fieldLayout':'interleaved U,V'}, {'fieldValueCount':127},{'fieldByteLength':508}]:
            path.write_text(json.dumps({**original,**change}))
            with self.assertRaises(ValueError):audit.collect_records()
        path.write_text(json.dumps(original))

    def test_removed_record_and_group_mismatch_do_not_reuse(self):
        self.assertEqual(self.cached(self.records[:1]),{})
        m=json.loads(self.paths[0].read_text());m['config']['groupId']='g96';self.paths[0].write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError,'group disagree'):audit.collect_records()

    def test_nonfinite_payload_is_rejected_even_with_matching_hash(self):
        path=self.paths[0];m=json.loads(path.read_text());payload=struct.pack('<128f',*([float('nan')]+[.2]*127));(path.parent/m['fieldUrl']).write_bytes(payload)
        m['fieldSha256']=hashlib.sha256(payload).hexdigest();path.write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError,'nonfinite'):audit.collect_records()


if __name__=='__main__':unittest.main()
