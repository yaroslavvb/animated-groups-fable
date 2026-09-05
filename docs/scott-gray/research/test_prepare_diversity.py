"""Origin matching is a symmetry check, not a Gray–Scott existence test.

Analytic C4 movies below have an independently specified quarter-period action.
They deliberately do not claim to solve the chemistry; exported proposals must
still pass the separate numerical admission gate.
"""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import numpy as np

HERE=Path(__file__).resolve().parent
SPEC=importlib.util.spec_from_file_location('prepare_diversity',HERE/'prepare-diversity.py')
PREPARE=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(PREPARE)
GROUPS={g['id']:g for g in json.loads((HERE.parent/'groups.json').read_text())}


def quarter_movie(N=16,M=16):
    t,y,x=np.indices((M,N,N),dtype=float)
    theta=2*np.pi*t/M
    # Under R90=(-y,x), psi(R90*x)=-i psi(x). Adding T/4
    # multiplies the temporal factor by i, so both components are invariant.
    psi=(np.sin(2*np.pi*x/N)-1j*np.sin(2*np.pi*y/N))
    psi+=(.31+.17j)*(np.sin(6*np.pi*x/N)-1j*np.sin(6*np.pi*y/N))
    wave=psi*np.exp(1j*theta)
    return np.stack([.22+.03*wave.real,.12+.02*wave.imag],axis=1)


def action_error(movie,group):
    """Directly test every operation/frame/component; no group averaging."""
    M,_,N,_=movie.shape;y,x=np.indices((N,N));error=0.
    for op in group['render']['ops']:
        matrix=np.asarray(op['M']);v=op['v']
        gx=(matrix[0,0]*x+matrix[0,1]*y+round(N*v[0]))%N
        gy=(matrix[1,0]*x+matrix[1,1]*y+round(N*v[1]))%N
        times=(np.arange(M)+round(M*op['tau']))%M
        moved=movie[times][:,:,gy,gx]
        error=max(error,float(np.max(np.abs(moved-movie))))
    return error


class SquareOriginMatchingTests(unittest.TestCase):
    def test_analytic_fixture_has_quarter_period_character(self):
        values=quarter_movie()
        self.assertLess(action_error(values,GROUPS['g96']),2e-16)
        self.assertGreater(action_error(values,GROUPS['g95']),.02)
        self.assertGreater(action_error(values,GROUPS['g94']),.02)

    def test_quarter_and_eighth_origins_restore_the_exact_action(self):
        original=quarter_movie();N=original.shape[-1]
        for sx,sy in [(2,2),(3,1)]:
            with self.subTest(eighths=(sx,sy)):
                shifted=np.roll(original,(sy*N//8,sx*N//8),axis=(2,3))
                saved=shifted.copy()
                projected,correction=PREPARE.match_square_origin(shifted,GROUPS['g96'],16)
                self.assertIsNotNone(projected)
                self.assertEqual(correction['originTranslation'],[sx/8,sy/8])
                self.assertLess(correction['max'],1e-15)
                self.assertLess(action_error(projected,GROUPS['g96']),1e-15)
                np.testing.assert_allclose(projected,original,rtol=0,atol=1e-15)
                np.testing.assert_array_equal(shifted,saved)

    def test_affine_generator_offsets_are_checked_together_with_origin(self):
        original=quarter_movie();N=original.shape[-1];y,x=np.indices((N,N))
        affine=original[:,:,(y+N//2)%N,(-x-N//4)%N]
        self.assertLess(action_error(affine,GROUPS['g99']),2e-16)
        shifted=np.roll(affine,(N//8,3*N//8),axis=(2,3))
        projected,correction=PREPARE.match_square_origin(shifted,GROUPS['g99'],16)
        self.assertIsNotNone(projected)
        self.assertLess(correction['max'],1e-15)
        self.assertLess(action_error(projected,GROUPS['g99']),1e-15)

    def test_wrong_phase_character_is_not_repaired_by_origin_search(self):
        values=quarter_movie()
        for gid in ['g94','g95']:
            with self.subTest(group=gid):
                projected,correction=PREPARE.match_square_origin(values,GROUPS[gid],16)
                self.assertIsNone(projected)
                self.assertGreater(correction['max'],1e-8)

    def test_later_v_frame_corruption_cannot_pass_the_phase_zero_prefilter(self):
        values=quarter_movie();values[3,1,5,7]+=.001
        # The prefilter only visits t=0,4,8,12 for g96. Frame 3 is absent.
        projected,correction=PREPARE.match_square_origin(values,GROUPS['g96'],16)
        self.assertIsNone(projected)
        self.assertGreater(correction['max'],1e-5)

    def test_only_roundoff_size_changes_are_permitted(self):
        values=quarter_movie();values[3,1,5,7]+=2e-10;original=values.copy()
        projected,correction=PREPARE.match_square_origin(values,GROUPS['g96'],16)
        self.assertIsNotNone(projected)
        self.assertGreater(correction['max'],0)
        self.assertLessEqual(correction['max'],correction['maximumAllowed'])
        self.assertLess(action_error(projected,GROUPS['g96']),1e-15)
        self.assertLess(np.max(np.abs(projected-values)),1e-8)
        np.testing.assert_array_equal(values,original)

    def test_one_deterministic_representative_not_all_valid_origins(self):
        values=quarter_movie()
        first,info=PREPARE.match_square_origin(values,GROUPS['g96'],16)
        second,again=PREPARE.match_square_origin(values,GROUPS['g96'],16)
        self.assertIsInstance(first,np.ndarray)
        self.assertEqual(first.shape,values.shape)
        self.assertEqual(info['originTranslation'],[0.,0.])
        self.assertEqual(info,again)
        np.testing.assert_array_equal(first,second)

    def test_preparation_exports_at_most_one_candidate_per_group(self):
        with tempfile.TemporaryDirectory(prefix='square-origin-test-') as directory:
            root=Path(directory)
            paths=[]
            for N in [8,16]:
                field=quarter_movie(N);binary=root/f'n{N}.f64';field.astype('<f8').tofile(binary)
                config={'N':N,'M':16,'period':330.,'L':256.,'groupId':'g96',
                        'params':{'F':.004,'k':.02,'Du':.16,'Dv':.08,'dx':256/N,'stencil':'five-point'},
                        'ops':GROUPS['g96']['render']['ops']}
                metadata=root/f'n{N}.json';metadata.write_text(json.dumps({'config':config,'charge':1,'fieldUrl':binary.name,'fieldEncoding':'float64-le'}));paths.append(str(metadata))
            cases=root/'cases.json';cases.write_text(json.dumps({'cases':[{'family':'p4','coarse':paths[0],'fine':paths[1],'id':'analytic-character-fixture','name':'Analytic fixture'}]}))
            output=root/'proposals'
            subprocess.run([sys.executable,str(HERE/'prepare-diversity.py'),str(cases),'--output',str(output)],check=True,capture_output=True,text=True,timeout=30)
            proposals=json.loads((output/'proposals.json').read_text())['proposals']
            gids=[p['groupId'] for p in proposals]
            self.assertEqual(sorted(gids),['g96','g97','g99'])
            self.assertEqual(len(gids),len(set(gids)))
            for proposal in proposals:
                meta=json.loads(Path(proposal['path']).read_text())
                self.assertNotIn('offlineVerification',meta)
                self.assertLessEqual(meta['provenance']['sampledSymmetryRoundoffCorrection']['max'],1e-8)
                field=np.fromfile(output/meta['fieldUrl'],dtype='<f4').reshape(16,2,16,16)
                self.assertEqual(action_error(field,GROUPS[proposal['groupId']]),0.)


if __name__=='__main__':unittest.main()
