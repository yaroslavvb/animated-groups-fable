"""Analytic direction fixtures independent of the nonlinear movie search."""
import unittest
import numpy as np
from audit_time_direction_catalog import audit_operation

class TimeDirectionTest(unittest.TestCase):
 def test_positive_translation_offset_rejects_the_inverse_sign(self):
  M,N=16,8;t=np.arange(M)[:,None,None]/M;x=np.indices((N,N))[1]/N;phase=2*np.pi*(x-t);field=np.stack([.5+.08*np.cos(phase),.2+.04*np.sin(phase)],axis=1)
  result=audit_operation(field,{'M':[[1,0],[0,1]],'v':[.25,0],'s':1,'tau':.25})
  self.assertTrue(result['forwardPassed']);self.assertFalse(result['oppositeTimeSignPassed']);self.assertTrue(result['timeDirectionIdentifiable'])
  self.assertGreater(min(result['oppositeTimeSign']['rmsByChannel']),.02)

 def test_rotation_conjugation_by_reflection_reverses_spatial_handedness(self):
  M,N=16,8;t=np.arange(M)[:,None,None]/M;y,x=np.indices((N,N));amplitude=np.sin(2*np.pi*x/N)-1j*np.sin(2*np.pi*y/N);z=amplitude*np.exp(2j*np.pi*t);field=np.stack([.5+.08*z.real,.2+.04*z.imag],axis=1)
  positive={'M':[[0,-1],[1,0]],'v':[0,0],'s':1,'tau':.25};negative={**positive,'M':[[0,1],[-1,0]]}
  self.assertTrue(audit_operation(field,positive)['forwardPassed']);self.assertFalse(audit_operation(field,negative)['forwardPassed'])
  reflected=field[:,:,:,(-np.arange(N))%N]
  self.assertTrue(audit_operation(reflected,negative)['forwardPassed']);self.assertFalse(audit_operation(reflected,positive)['forwardPassed'])

 def test_half_period_does_not_identify_a_direction(self):
  M,N=16,8;t=np.arange(M)[:,None,None]/M;x=np.indices((N,N))[1]/N;phase=2*np.pi*(x-t);field=np.stack([.5+.08*np.cos(phase),.2+.04*np.sin(phase)],axis=1)
  result=audit_operation(field,{'M':[[1,0],[0,1]],'v':[.5,0],'s':1,'tau':.5})
  self.assertTrue(result['forwardPassed']);self.assertTrue(result['oppositeTimeSignPassed']);self.assertFalse(result['timeDirectionIdentifiable'])

 def test_checks_every_frame_and_both_concentrations(self):
  M,N=16,8;t=np.arange(M)[:,None,None]/M;x=np.indices((N,N))[1]/N;phase=2*np.pi*(x-t);field=np.stack([.5+.08*np.cos(phase),.2+.04*np.sin(phase)],axis=1);field[7,1,2,3]+=.01
  result=audit_operation(field,{'M':[[1,0],[0,1]],'v':[.25,0],'s':1,'tau':.25})
  self.assertFalse(result['forwardPassed']);self.assertLess(result['forward']['maximumByChannel'][0],1e-10);self.assertAlmostEqual(result['forward']['maximumByChannel'][1],.01)

if __name__=='__main__':unittest.main()
