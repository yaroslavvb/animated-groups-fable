#!/usr/bin/env python3
"""Independent saved-byte admission for periodic orbits of the additional equations.

Reads an exported Float32 movie and its metadata, rebuilds every structural check from the
bytes (canonical affine operations at every saved phase, whole-loop same-time contrast for
each nonzero offset, variation floors, resolved primitive period, temporal resolution), then
integrates the equations forward from the exported first frame at two timestep limits with
no symmetry projection. The certificate has the same shape as the Gray–Scott wallpaper
certificate so the browser applies identical gates; the forward bounds reuse audit.py.
"""
import hashlib, json, math, sys
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent / 'wallpaper'))
from rdlab import MODELS, Character, flow, timestep, visibility, LIMITS
from audit import attach_forward_bounds


def attach_scaled_forward_bounds(proof, span):
    """audit.py's triangle bounds, with the 1e-6 phase limits scaled by the saved field's range.
    The Gray–Scott limits were set for concentrations of order 0.2; Ginzburg–Landau and Brusselator
    fields are of order 1, where one float32 step of the exported first frame is already ~1e-7, so the
    same relative accuracy is demanded instead of the same absolute one. The scale is recorded."""
    scale = max(1.0, float(span))
    saved = dict(LIMITS)
    try:
        import audit
        original = dict(audit.LIMITS); audit.LIMITS['forwardPhaseMax'] = original['forwardPhaseMax'] * scale; audit.LIMITS['forwardPhaseRms'] = original['forwardPhaseRms'] * scale
        out = attach_forward_bounds(proof)
    finally:
        audit.LIMITS.update(original)
    out['forwardTargetPhaseBounds']['rangeScale'] = scale
    out['forwardTargetPhaseBounds']['method'] += f' Limits are the Gray–Scott limits times the field range ({scale:.4g}) so that the same relative accuracy is required of order-one fields.'
    return out
GATE = 'equations-offline-v1'
MODEL_PARAMS = {'ginzburg-landau': ['alpha', 'beta', 'D'], 'brusselator': ['a', 'b', 'Du', 'Dv']}

def verifier_fingerprint():
    return hashlib.sha256(b''.join((HERE / name).read_bytes() for name in ['rdlab.py', 'admit.py'])).hexdigest()

def certify(field, config, group):
    field = np.asarray(field, float); model = config['model']; p = config['params']
    if model not in MODELS or model not in MODEL_PARAMS: raise ValueError('Unsupported model')
    if field.ndim != 4 or field.shape[1] != 2 or field.shape[2] != field.shape[3]: raise ValueError('Expected a complete square-indexed two-channel movie')
    M, _, N, _ = field.shape
    if config['N'] != N or config['M'] != M or N % group['meshMultiple'] or M % group['frameMultiple']: raise ValueError('Config and canonical mesh/frame dimensions disagree')
    for key in MODEL_PARAMS[model] + ['dx']:
        if not (isinstance(p.get(key), (int, float)) and math.isfinite(p[key])): raise ValueError('Invalid parameter ' + key)
    if abs(p['dx'] * N - config['L']) > 1e-9 or config['L'] <= 0: raise ValueError('Physical lattice length mismatch')
    if p['stencil'] != ('triangular-six' if group['lattice'] == 'triangular' else 'five-point'): raise ValueError('Stencil mismatch')
    if not math.isfinite(config['period']) or not 0 < config['period'] < 20000: raise ValueError('Invalid period')
    if not np.isfinite(field).all(): return {'schema': 'equation-orbit-certificate-v1', 'passed': False, 'reason': 'Nonfinite samples'}
    ch = Character(group, N); lattice = group['lattice']; h = config['L'] / N; T = config['period']
    stats = dict(spatialRms=float(np.sqrt(np.mean((field - field.mean(axis=(2, 3), keepdims=True)) ** 2))), temporalRms=float(np.sqrt(np.mean((field - field.mean(axis=0, keepdims=True)) ** 2))), minimum=float(field.min()), maximum=float(field.max()))
    flat = field.reshape(M, 2, -1); rows = []; relation = {'passed': True}
    for i, (m, t) in enumerate(zip(ch.maps, ch.taus)):
        s = t * M
        if abs(s - round(s)) > 1e-7: relation = {'passed': False, 'reason': 'Incompatible temporal grid'}; break
        diff = flat[(np.arange(M) + round(s)) % M][:, :, m] - flat; maximum = float(np.max(abs(diff)))
        if maximum > LIMITS['symmetryMax']: relation = {'passed': False, 'operation': i, 'max': maximum}; break
        rows.append(dict(operation=i, tau=float(t), maximum=maximum, rms=float(np.sqrt(np.mean(diff ** 2)))))
    if relation['passed']: relation['operations'] = rows
    vis = visibility(field, ch) if relation['passed'] else {'passed': False, 'reason': 'Phase relation failed'}
    energies = np.mean(abs(np.fft.fft(field, axis=0) / M) ** 2, axis=(1, 2, 3)); freq = np.arange(M); freq = np.minimum(freq, M - freq)
    total = float(energies[1:].sum()); tail = float(energies[freq > M / 4].sum()) / max(total, 1e-30)
    resolution = dict(passed=tail <= LIMITS['maximumTemporalTailEnergyFraction'], tailEnergyFraction=tail, cutoffFrequency=M / 4, scope='Fraction of nonconstant temporal Fourier energy above one quarter of the saved frame count.')
    periods = [dict(divisor=d, relativeProjectionRms=float(np.sqrt(energies[freq % d != 0].sum())) / max(stats['temporalRms'], 1e-12)) for d in range(2, M // 2 + 1)]
    lo, hi = MODELS[model]['bounds']
    structural = relation['passed'] and vis['passed'] and resolution['passed'] and stats['spatialRms'] >= LIMITS['minimumSpatialRms'] and stats['temporalRms'] >= LIMITS['minimumTemporalRms'] and stats['minimum'] >= lo and stats['maximum'] <= hi and all(x['relativeProjectionRms'] >= LIMITS['minimumRelativeSubperiodRms'] for x in periods)
    dynamics = None
    if structural:
        checks = []
        for scale in [1.0, 0.5]:
            dt = timestep(model, p, h) * scale; q = field[0].copy(); traj = []
            for j in range(M): traj.append(q.copy()); q = flow(model, q, T / M, p, lattice, h, dt)
            traj = np.array(traj); difference = traj - field
            checks.append(dict(dtLimit=dt, trajectoryRms=float(np.sqrt(np.mean(difference ** 2))), trajectoryMax=float(np.max(abs(difference))), closureRms=float(np.sqrt(np.mean((q - field[0]) ** 2)))))
        dynamics = dict(passed=all(c['trajectoryRms'] <= LIMITS['trajectoryRms'] and c['closureRms'] <= LIMITS['closureRms'] for c in checks), method='Independent RK4 full-cycle forward integration of the ' + model + ' equations at two timestep limits, starting from the exported Float32 first frame; no symmetry projection.', checks=checks)
    span = float(max(field[:, 0].max() - field[:, 0].min(), field[:, 1].max() - field[:, 1].min()))
    return attach_scaled_forward_bounds({'schema': 'equation-orbit-certificate-v1', 'model': model, 'passed': bool(structural and dynamics and dynamics['passed']), 'limits': dict(LIMITS, concentrationBounds=[lo, hi], forwardPhaseMax=1e-6 * max(1.0, span), forwardPhaseRms=1e-6 * max(1.0, span)), **stats, 'phaseRelations': relation, 'visibility': vis, 'resolvedSubperiods': periods, 'temporalResolution': resolution, 'independentDynamics': dynamics, 'scope': 'Finite-grid numerical verification of a ' + model + ' orbit, not a continuum existence proof or a maximal-symmetry classification.'}, span)

if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description=__doc__); ap.add_argument('metadata', type=Path); ap.add_argument('--output', type=Path); a = ap.parse_args()
    meta = json.loads(a.metadata.read_text()); c = meta['config']; groups = {g['id']: g for g in json.loads((ROOT / 'wallpaper-groups.json').read_text())['groups']}
    payload = (a.metadata.parent / meta['fieldUrl']).read_bytes(); field = np.frombuffer(payload, dtype='<f4').reshape(c['M'], 2, c['N'], c['N'])
    out = certify(field, c, groups[c['groupId']]); out['fieldSha256'] = hashlib.sha256(payload).hexdigest(); text = json.dumps(out, indent=2)
    if a.output: a.output.write_text(text)
    else: print(text)
