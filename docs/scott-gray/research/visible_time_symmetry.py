"""Fast candidate visibility screen; final JavaScript admission is authoritative.

The API accepts a complete movie, flattened or shaped (M, 2, N, N), and the
selected group's canonical operations. It tests both concentrations separately,
over every linear interpolation segment including the last-to-first seam. This
is a visibility preference, not a PDE, phase-relation, or periodicity test.

Example:
    audit_visible_time_symmetry(movie, ops=canonical_ops, noise_rms=1e-8)
    python3 visible_time_symmetry.py candidate.json --group g248

CLI groups come from the checked-in canonical group definitions, not candidate
claims about which operations passed. Float32 and Float64 payloads are supported.
Exit codes: 0 all screens pass, 1 a visibility screen fails, 2 invalid input.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np

VISIBILITY_VERSION = 'per-channel-rotation-contrast-v1'
VISIBILITY_LIMITS = {'minimumRelativeColorRange': .05, 'minimumAbsoluteRms': .002, 'noiseFactor': 100}
SCOPE = ('Both displayed concentrations; every nonzero-offset rotation; exact minimum over every linear playback segment, including the loop seam. '
         'Zero-offset spatial symmetries are allowed. This is a visibility policy, not a continuum existence proof.')
ROOT = Path(__file__).resolve().parent.parent


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _finite(value):
    return not isinstance(value, (bool, np.bool_)) and isinstance(value, (int, float, np.integer, np.floating)) and math.isfinite(value)


def audit_visible_time_symmetry(field, N=None, M=None, ops=None, noise_rms=0):
    """Return the JavaScript visibility schema for a complete candidate movie.

    ``ops`` must be the canonical requested group operations, each with integer
    lattice matrix M, lattice translation v, forward-time sign s and offset tau.
    An exact minimum is obtained from ||d0 + alpha*(d1-d0)||² on each segment.
    Reductions use Float64, so borderline results can differ at roundoff level
    from JavaScript's sequential sums. The final saved-field gate resolves them.
    """
    movie = np.asarray(field, dtype=np.float64)
    if movie.ndim == 4:
        _require(movie.shape[1] == 2 and movie.shape[2] == movie.shape[3], 'Movie shape must be (M, 2, N, N).')
        N = movie.shape[2] if N is None else N
        M = movie.shape[0] if M is None else M
    _require(_finite(N) and float(N).is_integer() and N >= 2 and
             _finite(M) and float(M).is_integer() and M >= 2,
             'Visibility audit needs complete spatial and temporal grids.')
    N, M = int(N), int(M)
    _require(movie.size == 2*M*N*N and movie.ndim in (1,4), 'Visibility audit needs the complete movie.')
    _require(movie.ndim != 4 or movie.shape == (M,2,N,N), 'Explicit dimensions disagree with the shaped movie.')
    _require(isinstance(ops, (list,tuple)) and len(ops), 'Visibility audit needs canonical operations.')
    _require(_finite(noise_rms) and noise_rms >= 0, 'Visibility uncertainty must be finite and nonnegative.')
    _require(np.isfinite(movie).all(), 'Visibility audit rejects nonfinite fields.')
    movie = movie.reshape(M, 2, N*N)
    ranges = np.stack([movie.min(axis=(0,2)), movie.max(axis=(0,2))], axis=1)
    absolute_floor = max(VISIBILITY_LIMITS['minimumAbsoluteRms'], VISIBILITY_LIMITS['noiseFactor']*float(noise_rms))
    _require(math.isfinite(absolute_floor), 'Visibility uncertainty is too large.')
    operations, reasons = [], []
    y,x = np.indices((N,N), dtype=np.int64)
    for index, op in enumerate(ops):
        _require(isinstance(op, dict), 'Visibility audit needs canonical operations.')
        matrix = op.get('M')
        _require(isinstance(matrix, (list,tuple)) and len(matrix) == 2 and all(isinstance(row,(list,tuple)) and len(row) == 2 for row in matrix),
                 'Visibility audit needs integer lattice operations.')
        _require(all(_finite(a) and float(a).is_integer() for row in matrix for a in row), 'Visibility audit needs integer lattice operations.')
        a,b,c,d = (int(a) for row in matrix for a in row)
        tau = op.get('tau') if op.get('tau') is not None else 0
        _require(_finite(tau), 'Visibility phase offset must be finite.')
        tau = math.fmod(math.fmod(float(tau),1)+1,1)
        translation = op.get('v') if op.get('v') is not None else [0,0]
        _require(isinstance(translation,(list,tuple)) and len(translation) == 2 and all(_finite(v) for v in translation),
                 'Visibility translation must contain two finite coordinates.')
        sign = op.get('s') if op.get('s') is not None else 1
        _require(_finite(sign) and sign == 1, 'Visibility audit only supports forward time shifts.')
        offsets = np.asarray(translation)*N
        _require(np.isfinite(offsets).all() and np.all(np.abs(offsets-np.rint(offsets)) < 1e-8), 'Generator does not map the lattice exactly.')
        if tau == 0 or a*d-b*c != 1 or (a,b,c,d) == (1,0,0,1):
            continue
        tx,ty = np.rint(offsets).astype(np.int64)
        mapped = (((c*x+d*y+ty)%N)*N+(a*x+b*y+tx)%N).ravel()
        channels = []
        for species in range(2):
            with np.errstate(over='raise', invalid='raise'):
                difference = movie[:,species,mapped]-movie[:,species,:]
                delta = np.roll(difference,-1,axis=0)-difference
                aa = np.einsum('ij,ij->i',delta,delta)
                bb = np.einsum('ij,ij->i',difference,delta)
                cc = np.einsum('ij,ij->i',difference,difference)
                alpha = np.zeros(M)
                np.divide(-bb,aa,out=alpha,where=aa != 0)
                alpha = np.clip(alpha,0,1)
                squared = np.maximum(0,(cc+2*bb*alpha+aa*alpha*alpha)/(N*N))
            frame = int(np.argmin(squared))
            minimum = math.sqrt(float(squared[frame]))
            span = float(ranges[species,1]-ranges[species,0])
            relative = minimum/span if span > 0 else 0
            phase = math.fmod(math.fmod((frame+float(alpha[frame]))/M,1)+1,1)
            passed = minimum >= absolute_floor and relative >= VISIBILITY_LIMITS['minimumRelativeColorRange']
            channel = 'V' if species else 'U'
            channels.append({'channel':channel,'minimumRms':minimum,'minimumRelativeColorRange':relative,'phase':phase,'passed':passed})
            if not passed:
                reasons.append(f'Rotation {index}, {channel}: an unshifted frame is too close to its rotation near phase {phase:.4f}.')
        operations.append({'operation':index,'tau':tau,'channels':channels,'passed':all(c['passed'] for c in channels)})
    return {'version':VISIBILITY_VERSION,'passed':not reasons,'referenceOnly':not operations,
            'thresholds':{**VISIBILITY_LIMITS,'effectiveAbsoluteFloor':absolute_floor},'noiseRms':float(noise_rms),
            'operations':operations,'reasons':reasons,
            'minimumRelativeColorRange':min((c['minimumRelativeColorRange'] for op in operations for c in op['channels']),default=None),
            'scope':SCOPE}


def canonical_operations(group_id):
    for path in [ROOT/'groups.json', ROOT/'p6/groups.json']:
        for group in json.loads(path.read_text()):
            if group['id'] == group_id:
                return group['render']['ops']
    raise ValueError(f'Unknown canonical group: {group_id}')


def screen_metadata(path, group_id=None, noise_rms=0):
    path = Path(path)
    metadata = json.loads(path.read_text())
    config = metadata['config']
    group_id = group_id or config['groupId']
    dtype = {'float32-le':'<f4','float64-le':'<f8'}.get(metadata.get('fieldEncoding'))
    _require(dtype is not None, 'Only Float32/Float64 little-endian movies are supported.')
    _require(isinstance(metadata.get('fieldUrl'),str), 'Metadata must reference the full movie payload.')
    payload = (path.parent/metadata['fieldUrl']).read_bytes()
    count = 2*config['M']*config['N']**2
    _require(len(payload) == count*np.dtype(dtype).itemsize, 'Payload is not the complete movie.')
    if 'fieldValueCount' in metadata:
        _require(metadata['fieldValueCount'] == count, 'Declared field value count is incorrect.')
    if 'fieldByteLength' in metadata:
        _require(metadata['fieldByteLength'] == len(payload), 'Declared field byte length is incorrect.')
    sha = hashlib.sha256(payload).hexdigest()
    if 'fieldSha256' in metadata:
        _require(metadata['fieldSha256'] == sha, 'Saved payload hash mismatch.')
    result = audit_visible_time_symmetry(np.frombuffer(payload,dtype=dtype),N=config['N'],M=config['M'],
                                        ops=canonical_operations(group_id),noise_rms=noise_rms)
    return {'metadata':str(path),'groupId':group_id,'N':config['N'],'M':config['M'],'fieldEncoding':metadata['fieldEncoding'],
            'fieldSha256':sha,'screeningOnly':True,'authoritative':False,'visibility':result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('metadata',nargs='+',type=Path)
    parser.add_argument('--group',help='Canonical target group (default: each candidate configuration).')
    parser.add_argument('--noise-rms',type=float,default=0,help='Conservative numerical uncertainty; final gate recomputes its own.')
    parser.add_argument('--output',type=Path)
    args = parser.parse_args()
    results=[];invalid=False
    for path in args.metadata:
        try:
            results.append(screen_metadata(path,args.group,args.noise_rms))
        except (ValueError,KeyError,TypeError,OSError,FloatingPointError) as error:
            invalid=True
            results.append({'metadata':str(path),'screeningOnly':True,'authoritative':False,'error':str(error)})
    text=json.dumps({'schema':'scott-gray-candidate-visibility-screen-v1','results':results},indent=2,allow_nan=False)+'\n'
    if args.output:
        args.output.write_text(text)
    else:
        print(text,end='')
    return 2 if invalid else 0 if all(r['visibility']['passed'] for r in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
