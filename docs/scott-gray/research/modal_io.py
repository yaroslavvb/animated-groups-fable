"""Local-only seed loading and movie reconstruction; no cloud calls."""
from pathlib import Path
import array
import ctypes
import json
import math
import platform
import subprocess
import sys

HERE=Path(__file__).resolve().parent

def validate_targets(targets):
    """Reject malformed/oversized jobs before invoking a paid worker."""
    if not isinstance(targets,list) or not 1 <= len(targets) <= 16:
        raise ValueError('Supply a JSON list containing 1–16 {F, k} targets.')
    for target in targets:
        if not isinstance(target,dict) or set(target) != {'F','k'}:
            raise ValueError('Each target must contain exactly F and k.')
        if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v)
               for v in target.values()):
            raise ValueError('F and k must be finite numbers.')
        if not 0 < target['F'] <= .1 or not 0 <= target['k'] <= .1:
            raise ValueError('Supported target bounds: 0 < F ≤ 0.1 and 0 ≤ k ≤ 0.1.')
    return targets

def parse_families(value):
    families=[x.strip() for x in value.split(',')]
    if not families or len(set(families)) != len(families) or any(x not in ('standing','rotating') for x in families):
        raise ValueError('families must be standing, rotating, or standing,rotating.')
    return families

def load_saved_seed(directory,group,family,baseline=False):
    name=f'{group}-{family}-N48-M128.json' if baseline else f'{group}-F0p00403000-k0p02000-N48-M128.json'
    path=Path(directory)/name
    meta=json.loads(path.read_text());config=meta['config'];count=2*config['N']**2
    raw=(path.parent/meta['fieldUrl']).read_bytes()[:count*4]
    values=array.array('f');values.frombytes(raw)
    if sys.byteorder!='little':values.byteswap()
    doubles=array.array('d',values)
    if sys.byteorder!='little':doubles.byteswap()
    return {'family':family,'config':config,'initial':doubles.tobytes()}

def write_results(result,output_dir):
    out=Path(output_dir);out.mkdir(parents=True,exist_ok=True)
    library=out.resolve()/('rk4-local.dylib' if platform.system()=='Darwin' else 'rk4-local.so')
    flags=['-dynamiclib'] if platform.system()=='Darwin' else ['-shared','-fPIC']
    subprocess.run(['c++','-O3','-std=c++17',*flags,str(HERE/'gray_scott_rk4.cpp'),'-o',str(library)],check=True)
    lib=ctypes.CDLL(str(library));ptr=ctypes.POINTER(ctypes.c_double);native=lib.flow
    native.argtypes=[ptr,ptr,ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int];native.restype=None
    records=result.pop('records');candidates=[]
    for record in records:
        report=record['report'];p=report['config']['params'];mode=f"-mode{report['spatialMode']}" if 'spatialMode' in report else ''
        name=f"{report['config']['groupId']}{mode}-F{p['F']:.8f}-k{p['k']:.8f}-N48-M128".replace('.','p');base=out/name
        report.update(fieldUrl=base.name+'.f64',fieldEncoding='float64-le',fieldLayout='frame-major; planar U then V; x-fast; lattice nodes i/N,j/N')
        base.with_suffix('.json').write_text(json.dumps(report,indent=2))
        candidates.append({'url':base.name+'.json','family':report['family']})
        N=report['config']['N'];M=report['config']['M'];duration=report['period']/M;Array=ctypes.c_double*(2*N*N)
        initial=array.array('d');initial.frombytes(record['initial'])
        if sys.byteorder!='little':initial.byteswap()
        state=Array(*initial);next_state=Array()
        with base.with_suffix('.f64').open('wb') as f:
            for _ in range(M):
                encoded=array.array('d',state)
                if sys.byteorder!='little':encoded.byteswap()
                f.write(encoded.tobytes());native(state,next_state,N,p['Du'],p['Dv'],p['F'],p['k'],p['dx'],duration,math.ceil(duration/.1));state,next_state=next_state,state
    (out/'run-report.json').write_text(json.dumps(result,indent=2))
    (out/'candidates.json').write_text(json.dumps({'schema':'scott-gray-continuation-candidates-v1','candidates':candidates},indent=2))
    return len(records)
