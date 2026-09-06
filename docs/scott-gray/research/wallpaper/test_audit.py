"""Focused analytic fixtures for the admission gate; no numerical solver needed."""
import copy
import unittest
import numpy as np
from audit import audit,symmetry,visibility,attach_forward_bounds

IDENTITY={'M':[[1,0],[0,1]],'v':[0,0],'s':1,'tau':0}
REFERENCE={'id':'g1','lattice':'square','ops':[IDENTITY],'meshMultiple':1,'frameMultiple':1}

def movie(M=24,N=8,frequency=1):
    t=np.arange(M)[:,None,None]/M;y,x=np.indices((N,N));phase=2*np.pi*(x/N-frequency*t)
    return np.stack([.5+.08*np.cos(phase),.15+.03*np.sin(phase)],axis=1)

def configuration(M=24,N=8):
    return {'N':N,'M':M,'L':256.,'period':350.,'params':{'F':.004,'k':.02,'Du':.16,'Dv':.08,'dx':256/N,'stencil':'five-point'}}

class AuditTest(unittest.TestCase):
    def test_forward_time_shift_sign_is_not_its_inverse(self):
        field=movie();operation={**IDENTITY,'v':[.25,0],'tau':.25}
        self.assertTrue(symmetry(field,[operation])['passed'])
        self.assertFalse(symmetry(field,[{**operation,'tau':.75}])['passed'])
        self.assertTrue(visibility(field,[operation])['passed'])

    def test_linear_segment_interior_cancellation_is_rejected(self):
        # The sampled frames differ strongly under a half-cell translation, but
        # their interpolated midpoint is spatially constant in both channels.
        x=np.indices((8,8))[1];a=np.cos(2*np.pi*x/8)
        field=np.stack([np.stack([.5+.08*a,.15+.03*a]),np.stack([.5-.08*a,.15-.03*a])])
        operation={**IDENTITY,'v':[.5,0],'tau':.5}
        self.assertTrue(symmetry(field,[operation])['passed'])
        result=visibility(field,[operation]);self.assertFalse(result['passed'])
        self.assertTrue(all(value<1e-8 for value in result['operations'][0]['minimumRmsByChannel']))

    def test_each_concentration_must_have_visible_offset(self):
        field=movie();field[:,1]=.15
        operation={**IDENTITY,'v':[.25,0],'tau':.25}
        with np.errstate(divide='ignore',invalid='ignore'):
            self.assertFalse(visibility(field,[operation])['passed'])

    def test_zero_offset_is_marked_reference_only(self):
        result=audit(movie(),configuration(),REFERENCE,dynamics={'passed':True,'method':'test fixture only','checks':[{'trajectoryRms':0.,'trajectoryMax':0.},{'trajectoryRms':0.,'trajectoryMax':0.}]})
        self.assertTrue(result['passed']);self.assertTrue(result['visibility']['referenceOnly'])
        self.assertEqual(result['visibility']['operations'],[])

    def test_temporally_underresolved_movie_fails(self):
        field=movie()+.4*(movie(frequency=9)-np.array([.5,.15])[None,:,None,None])
        result=audit(field,configuration(),REFERENCE,dynamics={'passed':True,'method':'test fixture only','checks':[{'trajectoryRms':0.,'trajectoryMax':0.},{'trajectoryRms':0.,'trajectoryMax':0.}]})
        self.assertFalse(result['passed']);self.assertFalse(result['temporalResolution']['passed'])
        self.assertGreater(result['temporalResolution']['tailEnergyFraction'],.01)

    def test_proper_subperiod_movie_fails(self):
        result=audit(movie(frequency=2),configuration(),REFERENCE,dynamics={'passed':True,'method':'test fixture only','checks':[{'trajectoryRms':0.,'trajectoryMax':0.},{'trajectoryRms':0.,'trajectoryMax':0.}]})
        self.assertFalse(result['passed'])
        self.assertLess(next(row for row in result['resolvedSubperiods'] if row['divisor']==2)['relativeProjectionRms'],1e-8)

    def test_forward_target_bounds_require_trajectory_evidence(self):
        proof={'passed':True,'phaseRelations':{'operations':[{'operation':0,'tau':.5,'rms':1e-8,'maximum':2e-8}]},'visibility':{'operations':[]},'independentDynamics':{'passed':True}}
        self.assertFalse(attach_forward_bounds(proof)['passed'])
        proof['independentDynamics']['checks']=[{'trajectoryRms':3e-8,'trajectoryMax':4e-8}]
        bound=attach_forward_bounds(proof)
        self.assertTrue(bound['passed'])
        operation=bound['forwardTargetPhaseBounds']['checks'][0]['operations'][0]
        self.assertAlmostEqual(operation['rmsUpperBound'],7e-8)
        self.assertAlmostEqual(operation['maximumUpperBound'],1e-7)
        proof['independentDynamics']['checks'][0]['trajectoryMax']=1e-5
        self.assertFalse(attach_forward_bounds(proof)['passed'])

    def test_inconsistent_equation_metadata_fails_before_dynamics(self):
        for section,key,value in [(None,'N',12),(None,'M',12),(None,'L',255),(None,'period',float('nan')),('params','F',-.001),('params','k',float('inf')),('params','Du',.17),('params','Dv',.07),('params','dx',33),('params','stencil','triangular-six')]:
            config=configuration();target=config if section is None else config[section];target[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):audit(movie(),config,REFERENCE,dynamics={'passed':True})

if __name__=='__main__':unittest.main()
