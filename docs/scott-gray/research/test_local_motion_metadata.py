"""Motion arrows require measured motion; canonical half-turns supply no sign."""
import hashlib,json,os,subprocess,tempfile,unittest
from collections import Counter
from pathlib import Path
import numpy as np
from local_motion_metadata import analyse_centre,angular_fit,ring_samples,geometry_digest,centre_key,LIMITS


def rotating_movie(sign=1,N=64,M=64,opposite_second=False):
 y,x=np.indices((N,N));t=np.arange(M)[:,None,None]/M;z=(np.sin(2*np.pi*x/N)-1j*sign*np.sin(2*np.pi*y/N))*np.exp(2j*np.pi*t)
 other=z if not opposite_second else (np.sin(2*np.pi*x/N)+1j*sign*np.sin(2*np.pi*y/N))*np.exp(2j*np.pi*t)
 return np.stack([.5+.08*z.real,.2+.04*other.imag],axis=1)

class LocalMotionTest(unittest.TestCase):
 def test_both_rotational_directions_are_measured(self):
  for sign in [1,-1]:
   with self.subTest(sign=sign):
    result=analyse_centre(rotating_movie(sign),[0,0],.5,'square');self.assertEqual(result['status'],'rotation');self.assertEqual(result['sign'],sign);self.assertEqual(result['confidence'],'high')

 def test_four_identical_half_turn_centres_have_alternating_motion(self):
  f=rotating_movie()
  for point,sign in [([0,0],1),([.5,.5],1),([0,.5],-1),([.5,0],-1)]:
   with self.subTest(point=point):self.assertEqual(analyse_centre(f,point,.5,'square')['sign'],sign)

 def test_standing_wave_gets_no_arrow(self):
  N=M=64;t=np.arange(M)[:,None,None]/M;x=np.indices((N,N))[1];a=np.sin(2*np.pi*x/N);field=np.stack([.5+.08*a*np.cos(2*np.pi*t),.2+.04*a*np.sin(2*np.pi*t)],axis=1)
  result=analyse_centre(field,[0,0],.5,'square');self.assertIsNone(result['sign']);self.assertNotEqual(result['status'],'rotation')

 def test_opposing_concentration_directions_get_no_arrow(self):
  result=analyse_centre(rotating_movie(opposite_second=True),[0,0],.5,'square');self.assertIsNone(result['sign']);self.assertEqual(result['status'],'mixed-motion')

 def test_spatially_underresolved_neighborhood_gets_no_arrow(self):
  result=analyse_centre(rotating_movie(N=12),[0,0],.2,'square');self.assertIsNone(result['sign']);self.assertEqual(result['status'],'under-resolved')

 def test_radius_dependent_counterrotation_gets_no_arrow(self):
  N=M=64;y,x=np.indices((N,N))/N;x=x-.5;y=y-.5;r=np.hypot(x,y);theta=np.arctan2(y,x);weight=1/(1+np.exp((r-.14)*150));a=np.exp(-1j*theta)*weight+np.exp(1j*theta)*(1-weight);z=a[None]*np.exp(2j*np.pi*np.arange(M)[:,None,None]/M);f=np.stack([.5+.08*z.real,.2+.04*z.imag],axis=1)
  result=analyse_centre(f,[.5,.5],.5,'square');self.assertIsNone(result['sign']);self.assertEqual(result['status'],'mixed-motion')

 def test_temporally_reversing_ring_does_not_have_consistent_direction(self):
  M,A=64,256;t=np.arange(M)[:,None]/M;theta=np.arange(A)[None]*2*np.pi/A;profile=np.cos(theta-1.2*np.sin(2*np.pi*t));fit=angular_fit(profile);self.assertLess(fit['phaseSignAgreement'],.95)

 def test_lag_consistency_and_positive_feature_direction(self):
  M,A=64,256;t=np.arange(M)[:,None]/M;theta=np.arange(A)[None]*2*np.pi/A;profile=np.cos(theta-2*np.pi*t)
  for lag in [1,2]:
   fit=angular_fit(profile,lag);self.assertEqual(fit['sign'],1);self.assertAlmostEqual(fit['degreesPerFrame'],360/M,places=8);self.assertGreater(fit['fitImprovement'],.999)

 def test_triangular_sampling_uses_physical_circles(self):
  N=48;y,x=np.indices((N,N))/N;physical_x=x-.5*y;physical_y=np.sqrt(3)/2*y;field=np.stack([physical_x,physical_y])[None].repeat(4,axis=0);centre=[.4,.5];radius=.03;samples=ring_samples(field,centre,radius,'triangular',256);theta=np.arange(256)*2*np.pi/256
  self.assertLess(np.max(abs(samples[0,0]-(centre[0]-.5*centre[1]+radius*np.cos(theta)))),1e-12)
  self.assertLess(np.max(abs(samples[0,1]-(np.sqrt(3)/2*centre[1]+radius*np.sin(theta)))),1e-12)

class PublishedMotionCatalogTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.research=Path(__file__).resolve().parent;cls.path=cls.research.parent/'data/local-motion.json';cls.manifest=json.loads(cls.path.read_text());cls.records={r['id']:r for r in cls.manifest['records']}
  with tempfile.TemporaryDirectory() as temporary:
   path=Path(temporary)/'centres.json';process=subprocess.run([os.environ.get('NODE_BINARY','node'),str(cls.research/'build-motion-centres.mjs'),str(path)],capture_output=True,text=True)
   if process.returncode:raise RuntimeError('Geometry exporter needs Node.js 18 or newer: '+process.stderr)
   cls.geometry=json.loads(path.read_text())['records']

 def test_complete_catalog_and_exact_overlay_geometry(self):
  self.assertEqual(len(self.records),len(self.manifest['records']));self.assertEqual(set(self.records),{r['id'] for r in self.geometry})
  for source in self.geometry:
   record=self.records[source['id']]
   for key in ['fieldSha256','N','M','lattice']:self.assertEqual(record[key],source[key])
   self.assertEqual(sorted(centre_key(c['centre']) for c in record['centres']),sorted(centre_key(c['point']) for c in source['centres']))

 def test_provenance_and_summary_match_published_file(self):
  m=self.manifest;self.assertEqual(m['methodCodeSha256'],hashlib.sha256((self.research/'local_motion_metadata.py').read_bytes()).hexdigest());self.assertEqual(m['inputGeometrySha256'],geometry_digest(self.geometry));self.assertEqual(m['limits'],LIMITS)
  states=Counter(c['status'] for r in self.records.values() for c in r['centres']);self.assertEqual(dict(states),m['summary']['states']);self.assertEqual(sum(states.values()),m['summary']['centres']);self.assertEqual(len(self.records),m['summary']['records']);self.assertLess(self.path.stat().st_size,3_000_000);self.assertNotIn('fieldPath',self.path.read_text())

 def test_ambiguous_motion_never_supplies_a_direction(self):
  for r in self.records.values():
   for c in r['centres']:
    self.assertIsInstance(c['evidence'],dict)
    if c['status']=='rotation':
     self.assertIn(c['sign'],[-1,1]);self.assertEqual(c['confidence'],'high');self.assertGreaterEqual(c['evidence']['minimumFitImprovement'],LIMITS['minimumFitImprovement']-1e-6);self.assertGreaterEqual(c['evidence']['minimumPhaseSignAgreement'],LIMITS['minimumPhaseSignAgreement']-1e-6);self.assertEqual(len(c['evidence']['windings']),1);self.assertLess(c['sign']*c['evidence']['windings'][0],0)
    else:self.assertIsNone(c['sign']);self.assertEqual(c['confidence'],'unknown')

 def test_reported_g6_saved_movie_has_both_chiralities_with_same_action(self):
  source=next(r for r in self.geometry if r['id']=='wallpaper:g6:731aa45654d4d690');payload=Path(source['fieldPath']).read_bytes();self.assertEqual(hashlib.sha256(payload).hexdigest(),source['fieldSha256']);N,M=source['N'],source['M'];field=np.frombuffer(payload,dtype='<f4').reshape(M,2,N,N)
  inverse=(-np.arange(N))%N
  # The exact same half-turn/+half-period action holds across the whole field.
  moved=np.roll(field,-M//2,axis=0)[:,:,inverse,:][:,:,:,inverse]
  self.assertLess(float(np.max(abs(field-moved))),3e-8)
  stored={centre_key(c['centre']):c for c in self.records[source['id']]['centres']}
  for point,sign in [([0,0],1),([.5,.5],1),([0,.5],-1),([.5,0],-1)]:
   measured=analyse_centre(field,point,.5,'square');self.assertEqual(measured['sign'],sign);self.assertEqual(measured['status'],'rotation');self.assertEqual(stored[centre_key(point)]['sign'],sign)

if __name__=='__main__':unittest.main()
