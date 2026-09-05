"""Offline tests of adaptive continuation bookkeeping; no cloud or numerical solve.
Run with the Python environment containing Modal.
"""
import importlib.util,json,pathlib,tempfile,types,math,struct,sys,subprocess,unittest
from unittest.mock import patch
path=pathlib.Path(__file__).resolve().parent/'p6'/'modal_diversity.py'
spec=importlib.util.spec_from_file_location('tested_wrapper',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
sys.modules['numpy']=types.SimpleNamespace(__version__='test-stub',frombuffer=lambda data,dtype:struct.unpack('<'+'d'*(len(data)//8),data),isfinite=lambda values:types.SimpleNamespace(all=lambda:all(math.isfinite(v) for v in values)))
sys.modules['scipy']=types.SimpleNamespace(__version__='test-stub')
class Adaptive(unittest.TestCase):
 def run_case(self,behavior='success',target=.004062,step=5e-6):
  data=struct.pack('<'+'d'*72,*([.15]*72));cfg={'N':6,'M':192,'period':330.,'params':{'F':.004052,'k':.02},'L':768}
  payload={'metadata':{'config':cfg,'rootConverged':True,'shootingRms':1e-12,'spatialRms':.02,'temporalRms':.02},'bytes':data}
  job={'id':'test','charge':0,'initial':'/fake/seed.json','feed':target,'grid':6,'wavevector':[1,0],'continuation_step':step}
  calls=[];clock=[100.]
  def fake_run(argv,**kw):
   self.assertNotIn('--continuation-step',argv);self.assertLessEqual(kw['timeout'],60);self.assertGreater(kw['timeout'],0)
   folder=pathlib.Path(argv[argv.index('--output')+1]);folder.mkdir();feed=float(argv[argv.index('--feed')+1]);initial=json.loads(pathlib.Path(argv[argv.index('--initial')+1]).read_text())
   calls.append({'feed':feed,'initialFeed':initial['config']['params']['F']})
   index=len(calls)-1;clock[0]+=60 if behavior=='timeout' else .01
   if behavior=='timeout':raise subprocess.TimeoutExpired(argv,kw['timeout'],output=b'bounded timeout')
   failed=behavior=='fail' or (behavior=='first-fail' and index==0) or (behavior=='later-fail' and index>0)
   if failed:
    (folder/'failed.json').write_text(json.dumps({'rootConverged':False,'shootingRms':1e-4,'rootMessage':'fake failure'}))
   else:
    cfgnew={**cfg,'params':{**cfg['params'],'F':feed+(1e-6 if behavior=='wrong-feed' else 0)}}
    report={**payload['metadata'],'config':cfgnew,'fieldUrl':'candidate.f64','fieldEncoding':'float64-le'}
    (folder/'candidate.f64').write_bytes(data);(folder/'candidate.json').write_text(json.dumps(report))
   return types.SimpleNamespace(returncode=0,stdout='',stderr='')
  with patch('subprocess.run',fake_run),patch('time.monotonic',lambda:clock[0]):
   result=m.execute_job(job,m.source_fingerprint(),payload,source_root=m.HERE)
  self.assertLessEqual(len(calls),24);self.assertLessEqual(result['elapsedSeconds'],180.01)
  return result,calls
 def test_success_and_actual_warm_starts(self):
  r,c=self.run_case();self.assertEqual(r['outcome'],'candidate-seed');self.assertTrue(r['continuationReachedTarget']);self.assertAlmostEqual(r['actualFeed'],.004062);self.assertEqual(len(r['checkpoints']),2);self.assertEqual(c[1]['initialFeed'],c[0]['feed'])
 def test_halving_preserves_last_accepted_state(self):
  r,c=self.run_case('first-fail');self.assertEqual(r['outcome'],'candidate-seed');self.assertEqual(c[0]['initialFeed'],c[1]['initialFeed']);self.assertAlmostEqual(c[1]['feed']-c[1]['initialFeed'],2.5e-6)
 def test_failed_is_partial_not_candidate(self):
  r,c=self.run_case('fail');self.assertEqual(r['outcome'],'stopped-continuation-seed');self.assertFalse(r['continuationReachedTarget']);self.assertEqual(r['actualFeed'],.004052);self.assertEqual(r['continuationStopReason'],'minimum-step');self.assertEqual(len(r['checkpoints']),0)
 def test_partial_checkpoint_is_retained(self):
  r,c=self.run_case('later-fail');self.assertEqual(r['outcome'],'stopped-continuation-seed');self.assertEqual(len(r['checkpoints']),1);self.assertEqual(r['report']['config']['params']['F'],c[0]['feed']);self.assertEqual(r['actualFeed'],c[0]['feed'])
 def test_wrong_feed_never_accepted(self):
  r,c=self.run_case('wrong-feed');self.assertEqual(r['outcome'],'stopped-continuation-seed');self.assertEqual(len(r['checkpoints']),0)
 def test_total_time_cap(self):
  r,c=self.run_case('timeout');self.assertEqual(r['outcome'],'stopped-continuation-seed');self.assertEqual(len(c),3);self.assertEqual(r['continuationStopReason'],'time-budget')
 def test_attempt_cap(self):
  r,c=self.run_case(target=.00407,step=1e-7);self.assertEqual(len(c),24);self.assertEqual(r['outcome'],'stopped-continuation-seed');self.assertEqual(r['continuationStopReason'],'attempt-limit')
 def test_validation(self):
  for raw in [{'charge':0,'continuation_step':5e-6},{'charge':0,'continuation_step':math.nan,'initial':'x','feed':.004}]:
   with self.assertRaises(ValueError):m.validate_job(raw)
if __name__=='__main__':unittest.main()
