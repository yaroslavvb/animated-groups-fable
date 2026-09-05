import unittest
import numpy as np
from morphology import orbit_distance


class OrbitDiversityTests(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(442632)
        self.field = rng.normal(size=(12,2,12,12))*.02 + .2

    def test_phase_and_position_do_not_count_as_a_new_shape(self):
        shifted = np.roll(self.field,(3,2,5),axis=(0,2,3))
        for family in ['p4','p6']:
            d = orbit_distance(self.field,shifted,family,size=12,phases=12)
            self.assertLess(d['relativeShapeRms'],1e-7)

    def test_mirrored_orbit_is_matched_without_reversing_time(self):
        reflected = self.field.transpose(0,1,3,2)
        self.assertLess(orbit_distance(self.field,reflected,size=12,phases=12)['relativeShapeRms'],1e-7)
        reversed_time = self.field[::-1]
        self.assertGreater(orbit_distance(self.field,reversed_time,size=12,phases=12)['relativeShapeRms'],.5)

    def test_distinct_spatial_shells_are_not_duplicates(self):
        t,y,x = np.indices((12,12,12))
        a = np.stack([np.cos(2*np.pi*(x+t)/12),np.sin(2*np.pi*(y+t)/12)],axis=1)
        b = np.stack([np.cos(2*np.pi*(2*x+t)/12),np.sin(2*np.pi*(2*y+t)/12)],axis=1)
        self.assertGreater(orbit_distance(a,b,size=12,phases=12)['relativeShapeRms'],1.)

    def test_amplitude_change_is_reported_separately_from_shape(self):
        result=orbit_distance(self.field,3*self.field,size=12,phases=12)
        self.assertGreater(result['relativeShapeRms'],.5)
        self.assertLess(result['amplitudeNormalizedShapeRms'],1e-7)

    @staticmethod
    def smooth_movie(dx=0.,dy=0.,dt=0.):
        t,y,x=np.indices((48,48,48),dtype=float)/48
        modes=[(4,1,1,.01),(3,-2,2,.006),(-1,5,1,.008),(2,3,3,.004)]
        u=sum(a*np.cos(2*np.pi*(kx*(x+dx)+ky*(y+dy)+w*(t+dt))) for kx,ky,w,a in modes)
        v=sum(a*.5*np.sin(2*np.pi*(kx*(x+dx)+ky*(y+dy)+w*(t+dt))) for kx,ky,w,a in modes)
        return np.stack([u+.2,v+.1],axis=1)

    def test_continuous_offsets_between_samples_are_not_new_shapes(self):
        a=self.smooth_movie();b=self.smooth_movie(.5/24,.5/24,.5/48)
        for family in ['p4','p6']:
            result=orbit_distance(a,b,family)
            self.assertLess(result['relativeShapeRms'],1e-7)
            self.assertLess(result['amplitudeNormalizedShapeRms'],1e-7)
            self.assertGreater(result['sampledRelativeShapeRms'],.2)
            self.assertTrue(result['continuousShiftRefinement'])
            self.assertTrue(result['alignmentConverged'])
            self.assertTrue(0<=result['phaseShift']<1)
            self.assertTrue(all(0<=v<1 for v in result['latticeShift']))

    def test_continuous_offsets_and_reflection_preserve_amplitude_metric(self):
        a=self.smooth_movie();b=3*self.smooth_movie(.371,.147,.293).transpose(0,1,3,2)
        result=orbit_distance(a,b,'p6')
        self.assertGreater(result['relativeShapeRms'],.5)
        self.assertLess(result['amplitudeNormalizedShapeRms'],1e-7)

    def test_reported_alignment_reconstructs_the_same_movie(self):
        from morphology import centered
        a=centered(self.smooth_movie());b=centered(self.smooth_movie(.131,.277,.163))
        result=orbit_distance(a,b)
        y,x=np.indices((24,24));coords=np.asarray(result['matrix'])@np.array([x.ravel(),y.ravel()])%24
        moved=b[:,:,coords[1],coords[0]].reshape(b.shape)
        t=np.fft.fftfreq(48)*48;y=np.fft.fftfreq(24)*24;x=y
        dx,dy=result['latticeShift'];dt=result['phaseShift']
        factor=np.exp(-2j*np.pi*(t[:,None,None]*dt+y[None,:,None]*dy+x[None,None,:]*dx))
        aligned=np.fft.ifftn(np.fft.fftn(moved,axes=(0,2,3))*factor[:,None,:,:],axes=(0,2,3)).real
        self.assertLess(np.sqrt(np.mean((a-aligned)**2))/np.sqrt(np.mean(a*a)),1e-7)


if __name__ == '__main__':
    unittest.main()
