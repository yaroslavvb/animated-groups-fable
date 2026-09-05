"""Small report fixtures: current, excluded and refined versions count correctly."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('report_diversity',Path(__file__).with_name('report-diversity.py'))
report=importlib.util.module_from_spec(spec);spec.loader.exec_module(report)


def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value))


class DiversityReportTests(unittest.TestCase):
    def fixture(self,root):
        site=root/'p4';metadata_dir=site/'data/orbits';metadata_dir.mkdir(parents=True)
        config={'N':4,'M':4,'groupId':'g95','period':300,'L':256,
                'params':{'F':.004,'k':.02,'Du':.16,'Dv':.08,'dx':64,'stencil':'five-point'},
                'ops':[{'M':[[0,-1],[1,0]],'v':[0,0],'s':1,'tau':.5}]}
        gate={'validated':True,'reasons':[],'candidatePhase':{'passed':True},'independentPhase':{'passed':True},
              'refinedPhase':{'passed':True,'independentForwardFrames':True,'primitiveAtResolvedDivisors':True}}
        entries=[]
        for label in ['current','excluded']:
            payload=struct.pack('<128f',*([.2]*128));field=metadata_dir/f'{label}.f32';field.write_bytes(payload)
            metadata={'config':config,'fieldEncoding':'float32-le','fieldValueCount':128,'fieldByteLength':512,'fieldUrl':field.name,
                      'fieldSha256':hashlib.sha256(payload).hexdigest(),'diversityAdmission':gate,
                      'visibleTimeSymmetry':{'passed':label=='current'}}
            path=metadata_dir/f'{label}.json';write(path,metadata);entries.append({'url':'data/orbits/'+path.name,'groupId':'g95'})
        write(site/'groups.json',[{'id':'g95'}])
        manifest={'orbits':[entries[0]],'excludedFromGallery':[entries[1]],
                  'refinementReplacements':[{'url':'retired-coarse.json','replacedBy':entries[0]['url']}]}
        write(site/'data/verified-orbits.json',manifest)
        return site,manifest

    def test_excluded_is_auditable_but_does_not_increase_current_choices(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);site,_=self.fixture(root)
            with patch.object(report,'ROOT',root),patch.object(report,'FAMILIES',[('p4','442',site,'verified-orbits.json')]):
                records,groups,_=report.collect()
            self.assertEqual(len(records),2)
            self.assertEqual([r['visibilityState'] for r in records],['visible','excluded'])
            self.assertEqual(groups[0]['maximumChoicesAtFixedParameters'],1)
            self.assertEqual(groups[0]['storedRecords'],2)
            self.assertNotIn('retired-coarse.json',[r['metadataPath'] for r in records])

    def test_active_excluded_overlap_is_rejected_instead_of_double_counted(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);site,manifest=self.fixture(root);manifest['excludedFromGallery'].append(manifest['orbits'][0]);write(site/'data/verified-orbits.json',manifest)
            with patch.object(report,'ROOT',root),patch.object(report,'FAMILIES',[('p4','442',site,'verified-orbits.json')]):
                with self.assertRaisesRegex(AssertionError,'both current and excluded'):report.collect()

    def test_duplicate_inventory_urls_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);site,manifest=self.fixture(root);manifest['orbits']*=2;write(site/'data/verified-orbits.json',manifest)
            with patch.object(report,'ROOT',root),patch.object(report,'FAMILIES',[('p4','442',site,'verified-orbits.json')]):
                with self.assertRaisesRegex(AssertionError,'Duplicate record URL'):report.collect()

    def test_status_counts_do_not_call_launched_or_planned_jobs_complete(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            write(root/'research/search-grid.json',{'batches':[{'id':'discovery','status':'executed','plannedJobs':64,'recordedResults':64}]})
            write(root/'research/search-grid-p4.json',{'runs':[{'batch':1,'status':'launched','numberOfJobs':3,'cases':[{}, {}, {}]},
                                                            {'batch':2,'status':'planned','numberOfJobs':2,'cases':[{}, {}]},
                                                            {'batch':3,'status':'failed','numberOfJobs':3,'returnedJobReports':2,'cases':[{}, {}, {}]}]})
            write(root/'research/p6/search-grid-gpu.json',{'runs':[{'batch':1,'state':'completed','jobCount':4,'jobs':[{}]*4},
                                                                {'batch':2,'state':'running','jobCount':1,'jobs':[{}]}]})
            with patch.object(report,'ROOT',root):scope=report.search_scope()
            self.assertEqual(scope['jobCount'],77)
            self.assertEqual(scope['statusCounts'],{'completed':68,'launched':4,'planned':2,'failed':3})
            self.assertFalse(scope['deflatedNewtonImplemented'])

    def test_stopped_apps_distinguish_collected_failures_from_missing_results(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            write(root/'research/p6/search-grid-gpu.json',{'runs':[
                {'batch':1,'observedState':'stopped','jobCount':2,'jobs':[{'result':{'converged':False}}]*2},
                {'batch':2,'observedState':'stopped','jobCount':3,'jobs':[{'result':{}},{'result':{}},{'outcome':'result-not-collected'}]},
                {'batch':3,'observedState':'ephemeral','jobCount':1,'jobs':[{}]},
            ]})
            with patch.object(report,'ROOT',root):scope=report.search_scope()
            self.assertEqual(scope['statusCounts'],{'completed':2,'failed':3,'launched':1})


if __name__=='__main__':unittest.main()
