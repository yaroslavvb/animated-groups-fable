"""Cross-language parity against the authoritative gallery visibility checker."""
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

import numpy as np
from visible_time_symmetry import audit_visible_time_symmetry,screen_metadata,canonical_operations,ROOT

R={'M':[[0,-1],[1,0]],'v':[0,0],'s':1,'tau':.25}
NODE=os.environ.get('SCOTT_GRAY_NODE') or str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
if not Path(NODE).is_file():
    NODE=shutil.which('node')
DRIVER="""
import fs from 'node:fs';
const {auditVisibleTimeSymmetry}=await import(process.argv[1]);
const cases=JSON.parse(fs.readFileSync(0,'utf8'));
const output=cases.map(test=>{
 try {
  let input=test;
  if(test.metadata){
   const m=JSON.parse(fs.readFileSync(test.metadata)),bytes=fs.readFileSync(new URL(m.fieldUrl,'file://'+test.metadata));
   const field=Array.from(new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4));
   input={field,N:m.config.N,M:m.config.M,ops:test.ops,noiseRms:test.noiseRms??0};
  }
  return {result:auditVisibleTimeSymmetry(input)};
 } catch(error) {return {error:error.message};}
});
console.log(JSON.stringify(output));
"""


def movie(N=12,M=16):
    t,y,x=np.indices((M,N,N),dtype=float)
    phi=2*np.pi*t/M;x=2*np.pi*x/N;y=2*np.pi*y/N
    return np.stack([.3+.05*(1+.16*np.cos(phi+.17+c/5))*(np.sin(x)*np.cos(phi+c/7)-np.sin(y)*np.sin(phi+c/7)) for c in range(2)],axis=1)


def case(field,ops=None,noise=0):
    return {'field':field.ravel().tolist(),'N':field.shape[2],'M':field.shape[0],'ops':ops or [copy.deepcopy(R)],'noiseRms':noise}


class VisibleTimeSymmetryTests(unittest.TestCase):
    def node(self,cases):
        self.assertTrue(NODE,'A modern Node executable is required for parity tests.')
        process=subprocess.run([NODE,'--input-type=module','-e',DRIVER,(ROOT/'visible-time-symmetry.mjs').as_uri()],
                               input=json.dumps(cases),text=True,capture_output=True,check=True)
        return json.loads(process.stdout)

    def compare(self,test):
        py=audit_visible_time_symmetry(test['field'],test['N'],test['M'],test['ops'],test.get('noiseRms',0))
        result=self.node([test])[0]
        self.assertNotIn('error',result)
        js=result['result']
        for key in ['version','passed','referenceOnly','thresholds']:
            self.assertEqual(py[key],js[key])
        self.assertEqual(len(py['operations']),len(js['operations']))
        for a,b in zip(py['operations'],js['operations']):
            self.assertEqual((a['operation'],a['tau'],a['passed']),(b['operation'],b['tau'],b['passed']))
            for ac,bc in zip(a['channels'],b['channels']):
                self.assertEqual((ac['channel'],ac['passed']),(bc['channel'],bc['passed']))
                self.assertAlmostEqual(ac['minimumRms'],bc['minimumRms'],delta=2e-9)
                self.assertAlmostEqual(ac['minimumRelativeColorRange'],bc['minimumRelativeColorRange'],delta=2e-8)
        return py

    def test_rotating_quadrature_both_species_pass(self):
        result=self.compare(case(movie()));self.assertTrue(result['passed']);self.assertGreater(result['minimumRelativeColorRange'],.1)

    def test_bad_interpolation_midpoint_cannot_hide_between_frames(self):
        field=movie();N=field.shape[2];_,y,x=np.indices((field.shape[0],N,N));shape=np.cos(2*np.pi*x/N)-np.cos(2*np.pi*y/N)
        field[:,0]=.3+.05*shape*np.where(np.arange(field.shape[0])[:,None,None]%2,1,-1)
        result=self.compare(case(field));self.assertFalse(result['passed']);self.assertLess(result['operations'][0]['channels'][0]['minimumRms'],2e-9)

    def test_loop_seam_is_included(self):
        N=12;M=4;y,x=np.indices((N,N));a=np.sin(2*np.pi*x/N);b=np.sin(2*np.pi*y/N)
        # Consecutive nonseam pairs avoid zero, but final -a to initial a crosses zero.
        field=np.stack([np.stack([.3+.05*s,.2+.03*s]) for s in [a,b,-a+b,-a]])
        result=self.compare(case(field));self.assertFalse(result['passed'])
        for channel in result['operations'][0]['channels']:
            self.assertAlmostEqual(channel['phase'],.875,delta=1e-10)

    def test_one_invariant_channel_rejects_joint_movie(self):
        field=movie();field[:,1]=.2
        result=self.compare(case(field));self.assertFalse(result['passed']);self.assertTrue(result['operations'][0]['channels'][0]['passed']);self.assertFalse(result['operations'][0]['channels'][1]['passed'])

    def test_affine_triangular_rotation_and_reference_operations(self):
        ops=[{'M':[[1,-1],[1,0]],'v':[.5,0],'s':1,'tau':1/6},
             {'M':[[1,0],[0,1]],'v':[.5,.5],'s':1,'tau':.5},dict(R,tau=0)]
        result=self.compare(case(movie(),ops));self.assertEqual(len(result['operations']),1)
        reference=self.compare(case(movie(),ops[1:]));self.assertTrue(reference['referenceOnly']);self.assertTrue(reference['passed'])

    def test_noise_floor_and_low_amplitude_reject(self):
        self.assertFalse(self.compare(case(movie(),noise=.002))['passed'])
        field=.3+(movie()-.3)*.001
        self.assertFalse(self.compare(case(field))['passed'])

    def test_invalid_finite_inputs_rejected_in_both_languages(self):
        tests=[]
        for change in [{'N':1},{'field':[0.,1.]},{'ops':[]},{'noiseRms':-.1},{'noiseRms':1e308},
                       {'ops':[dict(R,v=[.001,0])]},{'ops':[dict(R,M=[[.5,0],[0,1]])]},
                       {'ops':[dict(R,s=-1,tau=0)]},{'ops':[dict(R,v=[0],tau=0)]}]:
            tests.append({**case(movie()),**change})
        outputs=self.node(tests)
        for test,result in zip(tests,outputs):
            self.assertIn('error',result)
            with self.assertRaises(ValueError):audit_visible_time_symmetry(test['field'],test['N'],test['M'],test['ops'],test['noiseRms'])

    def test_nonfinite_inputs_and_partial_movie_rejected(self):
        for value in [float('nan'),float('inf'),float('-inf')]:
            with self.assertRaises(ValueError):audit_visible_time_symmetry(movie(),ops=[dict(R,tau=value)])
            with self.assertRaises(ValueError):audit_visible_time_symmetry(movie(),ops=[dict(R,v=[value,0],tau=0)])
            with self.assertRaises(ValueError):audit_visible_time_symmetry(movie(),ops=[R],noise_rms=value)
            field=movie();field[0,0,0,0]=value
            with self.assertRaises(ValueError):audit_visible_time_symmetry(field,ops=[R])
        with self.assertRaises(ValueError):audit_visible_time_symmetry(movie(),N=13,ops=[R])
        with self.assertRaises(ValueError):audit_visible_time_symmetry(movie(),N=6,M=64,ops=[R])

    def test_actual_saved_float32_movie_matches_node(self):
        path=ROOT/'data/orbits/g95-F0p00400000-k0p02000000-N48-M128.json'
        result=screen_metadata(path)
        js=self.node([{'metadata':str(path),'ops':canonical_operations('g95')}])[0]['result']
        self.assertTrue(result['screeningOnly']);self.assertFalse(result['authoritative']);self.assertTrue(result['visibility']['passed'])
        for a,b in zip(result['visibility']['operations'],js['operations']):
            for ac,bc in zip(a['channels'],b['channels']):
                for key in ['minimumRms','minimumRelativeColorRange','phase']:
                    self.assertAlmostEqual(ac[key],bc[key],delta=1e-10)

    def test_metadata_ignores_claimed_ops_and_rejects_corrupted_payload(self):
        source=ROOT/'data/orbits/g95-F0p00400000-k0p02000000-N48-M128.json'
        metadata=json.loads(source.read_text());payload=(source.parent/metadata['fieldUrl']).read_bytes()
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);metadata['fieldUrl']='movie.f32';metadata['config']['ops']=[]
            (root/'movie.f32').write_bytes(payload);(root/'orbit.json').write_text(json.dumps(metadata))
            self.assertTrue(screen_metadata(root/'orbit.json')['visibility']['operations'])
            damaged=bytearray(payload);damaged[100]^=1;(root/'movie.f32').write_bytes(damaged)
            with self.assertRaisesRegex(ValueError,'hash mismatch'):screen_metadata(root/'orbit.json')


if __name__=='__main__':unittest.main()
