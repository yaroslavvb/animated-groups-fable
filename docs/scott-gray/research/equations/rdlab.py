#!/usr/bin/env python3
"""Generic periodic-orbit laboratory for several reaction–diffusion / amplitude equations
on the wallpaper lattices of docs/scott-gray/wallpaper-groups.json.

Fields are stored as (2, N, N) arrays q[c, y, x]; the movie layout matches the site's
Float32 payloads: frame-major, planar channel 0 then channel 1, x fastest.
Convention (same as the site): q(Mx+v, t + tau T) = q(x, t).
"""
import json, math, time
import numpy as np

# ---------------------------------------------------------------- models
def _laplacian(q, lattice, h):
    if lattice == 'square':
        return (np.roll(q, 1, -1) + np.roll(q, -1, -1) + np.roll(q, 1, -2) + np.roll(q, -1, -2) - 4 * q) / (h * h)
    # triangular: neighbours (x±1,y), (x,y±1), (x+1,y+1), (x-1,y-1) in array[y,x]
    s = (np.roll(q, 1, -1) + np.roll(q, -1, -1) + np.roll(q, 1, -2) + np.roll(q, -1, -2)
         + np.roll(np.roll(q, -1, -1), -1, -2) + np.roll(np.roll(q, 1, -1), 1, -2) - 6 * q)
    return s * (2.0 / (3.0 * h * h))

def rhs_gray_scott(q, p, lattice, h):
    u, v = q; L = _laplacian(q, lattice, h); r = u * v * v
    return np.stack([p['Du'] * L[0] - r + p['F'] * (1 - u), p['Dv'] * L[1] + r - (p['F'] + p['k']) * v])

def rhs_ginzburg_landau(q, p, lattice, h):
    """A_t = A + (1+i alpha) D lap A - (1 - i beta)|A|^2 A   (SymSim's sign convention), A = u + i v."""
    u, v = q; L = _laplacian(q, lattice, h); a, b, D = p['alpha'], p['beta'], p['D']; m = u * u + v * v
    lu, lv = D * L[0], D * L[1]
    return np.stack([u + (lu - a * lv) - m * (u + b * v), v + (lv + a * lu) - m * (v - b * u)])

def rhs_brusselator(q, p, lattice, h):
    u, v = q; L = _laplacian(q, lattice, h); r = u * u * v
    return np.stack([p['Du'] * L[0] + p['a'] - (p['b'] + 1) * u + r, p['Dv'] * L[1] + p['b'] * u - r])

def rhs_barkley(q, p, lattice, h):
    """Barkley excitable/oscillatory model: u_t = Du lap u + u(1-u)(u-(v+b)/a)/eps, v_t = Dv lap v + u - v."""
    u, v = q; L = _laplacian(q, lattice, h)
    return np.stack([p['Du'] * L[0] + u * (1 - u) * (u - (v + p['b']) / p['a']) / p['eps'], p['Dv'] * L[1] + u - v])

def rhs_fitzhugh_nagumo(q, p, lattice, h):
    """u_t = Du lap u + u - u^3/3 - v + I,  v_t = Dv lap v + eps (u + a - b v)."""
    u, v = q; L = _laplacian(q, lattice, h)
    return np.stack([p['Du'] * L[0] + u - u ** 3 / 3 - v + p['I'], p['Dv'] * L[1] + p['eps'] * (u + p['a'] - p['b'] * v)])

MODELS = {
    'gray-scott': dict(rhs=rhs_gray_scott, bounds=(-1e-8, 1.2), diffusion=lambda p: max(p['Du'], p['Dv']), dtmax=0.4),
    'ginzburg-landau': dict(rhs=rhs_ginzburg_landau, bounds=(-3, 3), diffusion=lambda p: p['D'] * math.hypot(1, p['alpha']), dtmax=0.05),
    'brusselator': dict(rhs=rhs_brusselator, bounds=(-1e-8, 50), diffusion=lambda p: max(p['Du'], p['Dv']), dtmax=0.02),
    'barkley': dict(rhs=rhs_barkley, bounds=(-0.5, 1.5), diffusion=lambda p: max(p['Du'], p['Dv']), dtmax=0.01),
    'fitzhugh-nagumo': dict(rhs=rhs_fitzhugh_nagumo, bounds=(-4, 4), diffusion=lambda p: max(p['Du'], p['Dv']), dtmax=0.05),
}

def timestep(model, p, h, dt=None):
    m = MODELS[model]; bound = min(m['dtmax'], 0.15 * h * h / m['diffusion'](p))
    return min(dt, bound) if dt else bound

def flow(model, q, T, p, lattice, h, dt=None, steps=None):
    """RK4 evolution for time T (no projection). Returns the final state."""
    rhs = MODELS[model]['rhs']; q = np.array(q, dtype=float)
    if steps is None:
        steps = max(1, int(math.ceil(T / timestep(model, p, h, dt))))
    k = T / steps
    for _ in range(steps):
        a = rhs(q, p, lattice, h); b = rhs(q + .5 * k * a, p, lattice, h); c = rhs(q + .5 * k * b, p, lattice, h); d = rhs(q + k * c, p, lattice, h)
        q += k * (a + 2 * b + 2 * c + d) / 6
    return q

# ---------------------------------------------------------------- groups
def load_groups(path):
    data = json.loads(open(path).read()); return data, {g['id']: g for g in data['groups']}

def mapping(op, N):
    """Flat index array m with (S q)(y,x) = q.ravel()[m] = q(M x + v)."""
    y, x = np.indices((N, N)); a = np.asarray(op['M'], int); v = np.asarray(op.get('v', [0, 0]), float) * N
    if np.max(abs(v - np.rint(v))) > 1e-7: raise ValueError('Operation does not preserve this mesh')
    v = np.rint(v).astype(int)
    return (((a[1, 0] * x + a[1, 1] * y + v[1]) % N) * N + (a[0, 0] * x + a[0, 1] * y + v[0]) % N).ravel()

def apply_op(q, m):
    N = q.shape[-1]; return q.reshape(q.shape[0], -1)[:, m].reshape(q.shape)

class Character:
    """The group's operations on an N-mesh with their time offsets tau (fractions of T)."""
    def __init__(self, group, N):
        self.group = group; self.N = N; self.ops = group['ops']
        if N % group['meshMultiple']: raise ValueError('mesh incompatible')
        self.maps = [mapping(op, N) for op in self.ops]; self.taus = np.array([op['tau'] for op in self.ops])
        self.kernel = [m for m, t in zip(self.maps, self.taus) if abs(t) < 1e-9]
        self.order = group['phaseOrder']
        gen = [i for i, t in enumerate(self.taus) if abs(t - 1 / self.order) < 1e-9]
        self.generator = gen[0] if gen else None
        self.inverse_maps = [np.argsort(m) for m in self.maps]
    def project_kernel(self, q):
        flat = q.reshape(q.shape[0], -1); return np.mean([flat[:, m] for m in self.kernel], axis=0).reshape(q.shape)
    def project_complex(self, B, sign=1):
        """Project complex field B onto {B(gx) = exp(2 pi i sign tau_g) B(x)}."""
        flat = B.ravel()
        return np.mean([np.exp(-2j * np.pi * sign * t) * flat[m] for m, t in zip(self.maps, self.taus)], axis=0).reshape(B.shape)
    def symmetry_error(self, movie):
        """movie: (M, 2, N, N). Returns max |q(gx, t+tau T) - q(x,t)| over ops."""
        M = movie.shape[0]; flat = movie.reshape(M, 2, -1); worst = 0.0
        for m, t in zip(self.maps, self.taus):
            s = t * M
            if abs(s - round(s)) > 1e-7: raise ValueError('frame count incompatible with tau')
            worst = max(worst, float(np.max(abs(flat[(np.arange(M) + round(s)) % M][:, :, m] - flat))))
        return worst


def space_time_project(movie, ch):
    """Average a movie over the group's space-time action so q(gx, t+tau T) = q(x,t) holds exactly.
    The saved candidates already satisfy it to round-off; the projection only makes symmetric
    samples bit-identical before Float32 encoding (as the Gray–Scott exports do)."""
    M = movie.shape[0]; flat = movie.reshape(M, 2, -1); out = np.zeros_like(flat)
    for m, t in zip(ch.maps, ch.taus):
        s = int(round(t * M))
        if abs(t * M - s) > 1e-7: raise ValueError('frame count incompatible with tau')
        out += flat[(np.arange(M) + s) % M][:, :, m]
    return (out / len(ch.maps)).reshape(movie.shape)

# ---------------------------------------------------------------- CGL relative equilibria
def cgl_relative_equilibrium(group, N, L, p, seed=0, sign=1, lattice='square', total_time=400.0, report_every=50.0, tol=1e-10, rng=None, amplitude=0.5, initial=None):
    """Integrate the complex Ginzburg–Landau equation inside the invariant subspace
    B(gx) = exp(2 pi i sign tau_g) B(x). Returns dict with B (complex N x N), omega, residual."""
    h = L / N; ch = Character(group, N); rng = rng or np.random.default_rng(seed)
    if initial is None:
        B = amplitude * (rng.standard_normal((N, N)) + 1j * rng.standard_normal((N, N)))
    else:
        B = initial.copy()
    B = ch.project_complex(B, sign)
    q = np.stack([B.real, B.imag]); dt = timestep('ginzburg-landau', p, h); t = 0.0; history = []
    while t < total_time:
        q = flow('ginzburg-landau', q, report_every, p, lattice, h, dt); t += report_every
        B = ch.project_complex(q[0] + 1j * q[1], sign); q = np.stack([B.real, B.imag])
        F = rhs_ginzburg_landau(q, p, lattice, h); Ft = F[0] + 1j * F[1]
        omega = float(np.imag(np.vdot(B, Ft)) / np.vdot(B, B).real)   # best i*omega fit: F ~ i omega B
        residual = float(np.sqrt(np.mean(abs(Ft - 1j * omega * B) ** 2)))
        history.append((t, omega, residual, float(np.mean(abs(B) ** 2))))
        if residual < tol: break
    return dict(B=B, omega=omega, residual=residual, history=history, character=ch, h=h)

def cgl_movie(B, omega, M):
    """Analytic movie of the relative equilibrium: A(t) = B exp(i omega t), T = 2 pi/|omega|."""
    T = 2 * np.pi / abs(omega); frames = []
    for j in range(M):
        A = B * np.exp(1j * omega * T * j / M); frames.append(np.stack([A.real, A.imag]))
    return np.array(frames), T

# ---------------------------------------------------------------- generic audit
LIMITS = {'symmetryMax': 2e-7, 'minimumAbsoluteContrast': .002, 'minimumRelativeRangeContrast': .05, 'minimumSpatialRms': .012, 'minimumTemporalRms': .008, 'trajectoryRms': 1e-5, 'closureRms': 1e-5, 'minimumRelativeSubperiodRms': .03, 'maximumTemporalTailEnergyFraction': .01}

def visibility(field, ch):
    M, _, N, _ = field.shape; flat = field.reshape(M, 2, -1); spans = np.ptp(flat, axis=(0, 2)); rows = []
    for i, (m, t) in enumerate(zip(ch.maps, ch.taus)):
        if abs(t) < 1e-9: continue
        diff = flat[:, :, m] - flat; delta = np.roll(diff, -1, axis=0) - diff
        aa = np.sum(delta ** 2, axis=2); bb = np.sum(diff * delta, axis=2); cc = np.sum(diff ** 2, axis=2)
        alpha = np.clip(np.divide(-bb, aa, out=np.zeros_like(bb), where=aa != 0), 0, 1)
        minimum = np.sqrt(np.maximum(0, (cc + 2 * bb * alpha + aa * alpha ** 2) / (N * N))).min(axis=0); relative = minimum / spans
        rows.append(dict(operation=i, tau=float(t), minimumRmsByChannel=minimum.tolist(), minimumRelativeRangeByChannel=relative.tolist(), passed=bool(np.all(minimum >= LIMITS['minimumAbsoluteContrast']) and np.all(relative >= LIMITS['minimumRelativeRangeContrast']))))
    return dict(passed=all(r['passed'] for r in rows), referenceOnly=not rows, operations=rows)

def audit(model, field, p, group, L, T, lattice, dynamics=True):
    """Model-generic version of research/wallpaper/audit.py's structural + dynamics checks."""
    field = np.asarray(field, float); M, _, N, _ = field.shape; h = L / N; ch = Character(group, N)
    stats = dict(spatialRms=float(np.sqrt(np.mean((field - field.mean(axis=(2, 3), keepdims=True)) ** 2))), temporalRms=float(np.sqrt(np.mean((field - field.mean(axis=0, keepdims=True)) ** 2))), minimum=float(field.min()), maximum=float(field.max()))
    sym = ch.symmetry_error(field); vis = visibility(field, ch)
    energies = np.mean(abs(np.fft.fft(field, axis=0) / M) ** 2, axis=(1, 2, 3)); freq = np.arange(M); freq = np.minimum(freq, M - freq)
    total = float(energies[1:].sum()); tail = float(energies[freq > M / 4].sum()) / max(total, 1e-30)
    periods = [dict(divisor=d, relativeProjectionRms=float(np.sqrt(energies[freq % d != 0].sum())) / max(stats['temporalRms'], 1e-12)) for d in range(2, M // 2 + 1)]
    lo, hi = MODELS[model]['bounds']
    structural = sym <= LIMITS['symmetryMax'] and vis['passed'] and tail <= LIMITS['maximumTemporalTailEnergyFraction'] and stats['spatialRms'] >= LIMITS['minimumSpatialRms'] and stats['temporalRms'] >= LIMITS['minimumTemporalRms'] and stats['minimum'] >= lo and stats['maximum'] <= hi and all(x['relativeProjectionRms'] >= LIMITS['minimumRelativeSubperiodRms'] for x in periods)
    out = dict(model=model, passed=False, symmetryMax=sym, visibility=vis, tailEnergyFraction=tail, minSubperiodRms=min(x['relativeProjectionRms'] for x in periods) if periods else None, **stats, structuralPassed=bool(structural))
    if structural and dynamics:
        checks = []
        for scale in [1.0, 0.5]:
            dt = timestep(model, p, h) * scale; q = field[0].copy(); traj = []
            for j in range(M): traj.append(q.copy()); q = flow(model, q, T / M, p, lattice, h, dt)
            traj = np.array(traj); checks.append(dict(dt=dt, trajectoryRms=float(np.sqrt(np.mean((traj - field) ** 2))), trajectoryMax=float(np.max(abs(traj - field))), closureRms=float(np.sqrt(np.mean((q - field[0]) ** 2)))))
        out['independentDynamics'] = dict(checks=checks, passed=all(c['trajectoryRms'] <= LIMITS['trajectoryRms'] and c['closureRms'] <= LIMITS['closureRms'] for c in checks))
        out['passed'] = out['independentDynamics']['passed']
    return out

if __name__ == '__main__':
    import sys
    data, groups = load_groups(sys.argv[1] if len(sys.argv) > 1 else 'wallpaper-groups.json')
    print(len(groups), 'groups')

# ---------------------------------------------------------------- Newton–Krylov polish of a CGL relative equilibrium
def cgl_polish(B, omega, ch, p, lattice, h, sign=1, maxiter=60, tol=1e-12):
    """Solve F(B) - i omega B = 0 inside the character subspace with a global-phase condition."""
    from scipy.optimize import root
    N = B.shape[0]; ref = ch.project_complex(B, sign); scale = float(np.sqrt(np.mean(abs(ref) ** 2))) or 1.0
    def unpack(z):
        Bz = ch.project_complex((z[:N * N] + 1j * z[N * N:2 * N * N]).reshape(N, N), sign); return Bz, z[-1]
    def residual(z):
        Bz, w = unpack(z); q = np.stack([Bz.real, Bz.imag]); F = rhs_ginzburg_landau(q, p, lattice, h); G = ch.project_complex((F[0] + 1j * F[1]) - 1j * w * Bz, sign)
        phase = np.imag(np.vdot(ref, Bz)) / (scale * scale * N * N)
        return np.r_[G.real.ravel(), G.imag.ravel(), phase]
    z0 = np.r_[ref.real.ravel(), ref.imag.ravel(), omega]
    sol = root(residual, z0, method='krylov', options=dict(fatol=tol, maxiter=maxiter, jac_options=dict(inner_maxiter=60, method='lgmres')))
    Bz, w = unpack(sol.x); r = residual(sol.x)
    return dict(B=Bz, omega=float(w), residual=float(np.sqrt(np.mean(r[:-1] ** 2))), success=bool(sol.success), message=str(sol.message), nit=int(sol.nit) if hasattr(sol, 'nit') else None)

def cgl_search(group, N, L, p, seed=0, lattice='square', total_time=800.0, M=96, polish=True, amplitude=0.5, tol=1e-9):
    """Try both phase signs; return the audited candidate that satisfies the group's ops, if any."""
    out = []
    for sign in (1, -1):
        r = cgl_relative_equilibrium(group, N, L, p, seed=seed, sign=sign, lattice=lattice, total_time=total_time, report_every=50, tol=tol, amplitude=amplitude)
        rec = dict(sign=sign, omega=r['omega'], residual=r['residual'], meanSquare=float(np.mean(abs(r['B']) ** 2)))
        B, omega = r['B'], r['omega']
        if polish and r['residual'] < 1e-2:
            pol = cgl_polish(B, omega, r['character'], p, lattice, r['h'], sign=sign); rec['polish'] = {k: v for k, v in pol.items() if k != 'B'}
            if pol['residual'] < r['residual']: B, omega = pol['B'], pol['omega']; rec['residual'] = pol['residual']; rec['omega'] = omega
        movie, T = cgl_movie(B, omega, M); a = audit('ginzburg-landau', movie, p, group, L, T, lattice, dynamics=rec['residual'] < 1e-6)
        rec.update(period=T, audit={k: v for k, v in a.items() if k != 'visibility'}, visibilityPassed=a['visibility']['passed'], visibilityMin=min([min(o['minimumRelativeRangeByChannel']) for o in a['visibility']['operations']] or [None]) if a['visibility']['operations'] else None, B=B)
        out.append(rec)
        if a['passed']: break
    return out

# ---------------------------------------------------------------- export and pictures
def resample_complex(B, N2):
    """Fourier resample a doubly periodic complex field (lattice coordinates) to N2 x N2."""
    N = B.shape[0]; F = np.fft.fft2(B) / (N * N); out = np.zeros((N2, N2), complex)
    k = np.fft.fftfreq(N, 1 / N).astype(int); k2 = np.fft.fftfreq(N2, 1 / N2).astype(int); idx2 = {int(v): i for i, v in enumerate(k2)}
    for i, ky in enumerate(k):
        for j, kx in enumerate(k):
            if abs(ky) <= N2 // 2 and abs(kx) <= N2 // 2 and (ky in idx2) and (kx in idx2): out[idx2[int(ky)], idx2[int(kx)]] = F[i, j]
    return np.fft.ifft2(out) * (N2 * N2)

def export_record(model, movie, T, group, L, p, outdir, name='candidate', extra=None):
    """Write the site's Float32 layout and a metadata JSON compatible with the wallpaper atlas."""
    import os, hashlib
    os.makedirs(outdir, exist_ok=True); M, _, N, _ = movie.shape; h = L / N
    stencil = 'triangular-six' if group['lattice'] == 'triangular' else 'five-point'
    config = dict(N=N, M=M, L=L, period=float(T), groupId=group['id'], model=model, params={**p, 'dx': h, 'stencil': stencil}, ops=group['ops'])
    payload = movie.astype('<f4').tobytes(); open(os.path.join(outdir, name + '.f32'), 'wb').write(payload)
    meta = dict(schema='rdlab-candidate-v1', model=model, groupId=group['id'], family=group['family'], lattice=group['lattice'], config=config, fieldUrl=name + '.f32', fieldEncoding='float32-le', fieldSha256=hashlib.sha256(payload).hexdigest(), fieldByteLength=len(payload), period=float(T), **(extra or {}))
    json.dump(meta, open(os.path.join(outdir, name + '.json'), 'w'), indent=1); return meta

COLD_HOT = np.array([[0, 20, 40, 120], [.25, 60, 120, 220], [.5, 245, 245, 245], [.75, 230, 110, 40], [1, 130, 10, 20]], float)

def picture(frame, lattice, path, size=320, tiles=2, stops=COLD_HOT, lo=None, hi=None):
    """Render channel 0 of a frame (N x N, lattice coordinates) over tiles x tiles cells to a PNG."""
    from PIL import Image
    n = frame.shape[-1]; y, x = np.indices((size, size)); xx = (x + .5) / size * tiles; yy = (y + .5) / size * tiles
    if lattice == 'triangular': yy = yy / (np.sqrt(3) / 2); xx = xx + yy * .5
    grid = frame; lo = float(grid.min()) if lo is None else lo; hi = float(grid.max()) if hi is None else hi
    xf = (xx * n) % n; yf = (yy * n) % n; ix = np.floor(xf).astype(int); iy = np.floor(yf).astype(int); fx = xf - ix; fy = yf - iy
    if lattice == 'triangular':
        q00 = grid[iy, ix]; q10 = grid[iy, (ix + 1) % n]; q01 = grid[(iy + 1) % n, ix]; q11 = grid[(iy + 1) % n, (ix + 1) % n]
        values = np.where(fx >= fy, (1 - fx) * q00 + (fx - fy) * q10 + fy * q11, (1 - fy) * q00 + (fy - fx) * q01 + fx * q11)
    else:
        values = sum(grid[(iy + dy) % n, (ix + dx) % n] * (fx if dx else 1 - fx) * (fy if dy else 1 - fy) for dy in [0, 1] for dx in [0, 1])
    values = np.clip((values - lo) / (hi - lo), 0, 1)
    rgb = np.stack([np.interp(values, stops[:, 0], stops[:, i]) for i in [1, 2, 3]], axis=2).astype(np.uint8); Image.fromarray(rgb).save(path)

# ---------------------------------------------------------------- relative periodic orbits of general models
def uniform_equilibrium(model, p, guess):
    from scipy.optimize import fsolve
    f = lambda z: MODELS[model]['rhs'](np.array(z, float).reshape(2, 1, 1), p, 'square', 1.0).ravel()
    z = fsolve(f, guess, xtol=1e-13); return np.array(z, float)

def hopf_eigen(model, p, q0, lam):
    """Eigen-decomposition of the reaction Jacobian at q0 plus diffusion eigenvalue lam (<=0)."""
    eps = 1e-6; J = np.zeros((2, 2)); base = MODELS[model]['rhs'](q0.reshape(2, 1, 1), p, 'square', 1.0).ravel()
    for j in range(2):
        d = np.zeros(2); d[j] = eps; J[:, j] = (MODELS[model]['rhs']((q0 + d).reshape(2, 1, 1), p, 'square', 1.0).ravel() - base) / eps
    D = np.diag([p.get('Du', p.get('D', 1.0)), p.get('Dv', p.get('D', 1.0))]); return np.linalg.eig(J + lam * D)

def seed_from_complex(model, p, q0, B, amplitude, lam=0.0):
    """q(x) = q0 + amplitude * Re(B(x) e) with e the oscillatory eigenvector of the reaction Jacobian."""
    w, V = hopf_eigen(model, p, q0, lam); i = int(np.argmax(w.imag)); e = V[:, i] / V[0, i]
    field = np.real(B[None, :, :] * e[:, None, None]); field /= np.sqrt(np.mean(field ** 2)) or 1
    return q0[:, None, None] + amplitude * field, float(abs(w[i].imag))

def twisted_residual(model, q, T, p, lattice, h, ch, dt=None):
    """S_g Phi_{T/order}(q) - q for the phase generator g (tau = 1/order)."""
    g = ch.generator
    if g is None: raise ValueError('group has no phase generator')
    evolved = flow(model, q, T / ch.order, p, lattice, h, dt)
    return apply_op(evolved, ch.maps[g]) - q

def rpo_polish(model, q, T, p, lattice, h, ch, maxiter=40, tol=1e-11, dt=None):
    """Newton–Krylov on the twisted shooting equation with a phase condition; unknowns (kernel-projected q, log T)."""
    from scipy.optimize import root
    ref = ch.project_kernel(q); tangent = MODELS[model]['rhs'](ref, p, lattice, h); tangent /= np.linalg.norm(tangent) or 1
    n = ref.size
    def unpack(z): return ch.project_kernel(z[:n].reshape(ref.shape)), float(np.exp(z[n]))
    def residual(z):
        qz, Tz = unpack(z); r = ch.project_kernel(twisted_residual(model, qz, Tz, p, lattice, h, ch, dt))
        return np.r_[r.ravel(), np.sum((qz - ref) * tangent)]
    z0 = np.r_[ref.ravel(), np.log(T)]
    sol = root(residual, z0, method='krylov', options=dict(fatol=tol, maxiter=maxiter, jac_options=dict(inner_maxiter=40, method='lgmres')))
    qz, Tz = unpack(sol.x); r = residual(sol.x)
    return dict(q=qz, T=Tz, residual=float(np.sqrt(np.mean(r[:-1] ** 2))), success=bool(sol.success), message=str(sol.message))

def estimate_period(model, q, p, lattice, h, ch, Tmin, Tmax, samples=24, dt=None):
    """Coarse-to-fine minimisation of |S_g Phi_{T/order}(q) - q| over T."""
    from scipy.optimize import minimize_scalar
    grid = np.linspace(Tmin, Tmax, samples); vals = [np.linalg.norm(twisted_residual(model, q, T, p, lattice, h, ch, dt)) for T in grid]
    i = int(np.argmin(vals)); lo, hi = grid[max(0, i - 1)], grid[min(samples - 1, i + 1)]
    res = minimize_scalar(lambda T: np.linalg.norm(twisted_residual(model, q, T, p, lattice, h, ch, dt)), bounds=(lo, hi), method='bounded', options=dict(xatol=1e-9))
    return float(res.x), float(res.fun), list(zip(grid.tolist(), vals))

def rpo_from_attractor(model, group, N, L, p, q_init, transient=200.0, Tmin=None, Tmax=None, M=96, checks=4, check_interval=50.0, dt=None):
    """Kernel-projected forward integration, then twisted-map period estimate, Newton–Krylov polish, movie and audit."""
    h = L / N; ch = Character(group, N); lattice = group['lattice']; q = ch.project_kernel(np.array(q_init, float)); log = []
    q = ch.project_kernel(flow(model, q, transient, p, lattice, h, dt))
    best = None
    for c in range(checks):
        T, r, _ = estimate_period(model, q, p, lattice, h, ch, Tmin, Tmax, dt=dt); log.append(dict(check=c, T=T, twistedResidual=r))
        if best is None or r < best[1]: best = (q.copy(), r, T)
        q = ch.project_kernel(flow(model, q, check_interval, p, lattice, h, dt))
    q, r, T = best
    pol = rpo_polish(model, q, T, p, lattice, h, ch, dt=dt); q, T = pol['q'], pol['T']
    movie = []; state = q.copy()
    for j in range(M): movie.append(state.copy()); state = flow(model, state, T / M, p, lattice, h, dt)
    movie = np.array(movie); a = audit(model, movie, p, group, L, T, lattice, dynamics=pol['residual'] < 1e-6)
    return dict(q=q, T=T, movie=movie, polish={k: v for k, v in pol.items() if k != 'q'}, log=log, audit=a)
