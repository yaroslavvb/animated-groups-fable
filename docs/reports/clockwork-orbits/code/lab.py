#!/usr/bin/env python3
"""Shared laboratory for the clockwork-symmetry method experiments.

Everything numerical is *borrowed* from the repository, never re-derived:

* ``docs/scott-gray/research/equations/rdlab.py``   — right-hand sides, RK4 flow, the
  ``Character`` index permutations, ``cgl_relative_equilibrium`` / ``cgl_polish``,
  ``hopf_eigen``, ``seed_from_complex``, ``rpo_polish``, ``estimate_period``.
* ``docs/scott-gray/research/equations/modal_equations.py`` — ``run_brusselator``, the exact
  pipeline the published g227 record came out of (imported with a stub ``modal`` module so
  that nothing can talk to Modal).
* ``docs/scott-gray/research/equations/admit.py`` — ``certify``, the saved-byte acceptance
  audit with the repository ``LIMITS``.
* ``docs/scott-gray/research/wallpaper/audit.py`` — ``attach_forward_bounds`` (via admit).
* ``docs/scott-gray/wallpaper-groups.json`` — the 68 clockwork entries.

The repository is treated as **read only**.  Convention throughout (repo convention):

    q(M x + v, t + tau*T) = q(x, t)

with ``x`` in the entry's lattice basis.  Fields are ``(2, N, N)`` arrays indexed
``q[channel, j, i]`` where ``i`` is the first lattice coordinate (x-fast, as in the site's
Float32 payloads) and node ``(i, j)`` sits at lattice coordinates ``(i/N, j/N)``.
Movies are ``(M, 2, N, N)``, frame-major.

Import with::

    import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import lab

See README.md for the full API.
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
from dataclasses import dataclass, field as _dc_field
from pathlib import Path

os.environ.setdefault('OMP_NUM_THREADS', '4')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '4')
os.environ.setdefault('MKL_NUM_THREADS', '4')

import numpy as np

# ---------------------------------------------------------------- repository wiring
def _find_repo() -> Path:
    """Locate the animated-groups-fable checkout.

    Set ``AGF_REPO`` to the checkout, or place this folder anywhere inside it
    (these scripts ship at ``docs/reports/clockwork-orbits/code/``) and it is
    found by walking up until ``docs/scott-gray/research/equations/rdlab.py``
    appears.
    """
    env = os.environ.get('AGF_REPO')
    if env:
        return Path(env).expanduser().resolve()
    here = Path(__file__).resolve()
    for cand in [here.parent, *here.parents]:
        if (cand / 'docs' / 'scott-gray' / 'research' / 'equations' / 'rdlab.py').is_file():
            return cand
    raise RuntimeError(
        'Could not locate the animated-groups-fable checkout. '
        'Set the AGF_REPO environment variable to its path, e.g. '
        'AGF_REPO=~/animated-groups-fable python direct.py ...')


REPO = _find_repo()
SG = REPO / 'docs' / 'scott-gray'
EQ_DIR = SG / 'research' / 'equations'
WP_DIR = SG / 'research' / 'wallpaper'
GROUPS_JSON = SG / 'wallpaper-groups.json'
ORBITS_DIR = SG / 'data' / 'equation-orbits'
BATCHES_DIR = EQ_DIR / 'batches'

for _p in (str(EQ_DIR), str(WP_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)


def _stub_modal():
    """Let ``modal_equations`` import without the modal package (and without any network)."""
    if 'modal' in sys.modules:
        return
    from unittest.mock import MagicMock
    sys.modules['modal'] = MagicMock(name='modal-stub')


_stub_modal()

import rdlab                      # noqa: E402  (repo module)
import admit                      # noqa: E402  (repo module)
import audit as wp_audit          # noqa: E402  (repo module, wallpaper/audit.py)
import modal_equations            # noqa: E402  (repo module; modal is stubbed)

LIMITS = dict(rdlab.LIMITS)
GATE = admit.GATE
PUBLISHED_G227 = ORBITS_DIR / 'g227-brusselator-e47c12f9099fb9d2b6d4.json'
G227_JOB_ID = 'g227-bruss-a1b23-L40-s1'
G227_PERIOD = 6.390159918584649

# ---------------------------------------------------------------- cost counters
COUNTERS = {
    'rhs_calls': 0,          # full-field right-hand-side evaluations
    'rhs_node_evals': 0,     # the same, weighted by N*N (grid-point RHS evaluations)
    'rk4_steps': 0,          # RK4 stages / 4
    'flow_calls': 0,         # calls to rdlab.flow  (one trajectory integration each)
    'flow_time': 0.0,        # seconds spent inside rdlab.flow
    'residual_calls': 0,     # twisted-shooting residual evaluations through this module
}
_ORIGINALS: dict[str, object] = {}


def reset_counters() -> dict:
    """Zero the global cost counters and return the previous snapshot."""
    old = dict(COUNTERS)
    COUNTERS.update({k: (0.0 if isinstance(v, float) else 0) for k, v in COUNTERS.items()})
    return old


def counters() -> dict:
    """Snapshot of the global cost counters."""
    return dict(COUNTERS)


def _install_counters():
    """Wrap rdlab's RHS functions and ``flow`` so every experiment can report its cost.

    Idempotent.  rdlab looks its RHS up through module globals / ``rdlab.MODELS`` at call
    time, so patching those attributes instruments every repo code path, including
    ``modal_equations.run_brusselator``.
    """
    if _ORIGINALS:
        return
    names = ['rhs_gray_scott', 'rhs_ginzburg_landau', 'rhs_brusselator', 'rhs_barkley',
             'rhs_fitzhugh_nagumo']
    for name in names:
        original = getattr(rdlab, name)
        _ORIGINALS[name] = original

        def counted(q, p, lattice, h, _f=original):
            COUNTERS['rhs_calls'] += 1
            COUNTERS['rhs_node_evals'] += int(np.asarray(q).shape[-1]) * int(np.asarray(q).shape[-2])
            return _f(q, p, lattice, h)

        counted.__name__ = name
        setattr(rdlab, name, counted)
    for model, spec in rdlab.MODELS.items():
        key = 'rhs_' + model.replace('-', '_')
        if key in _ORIGINALS:
            spec['rhs'] = getattr(rdlab, key)
    _ORIGINALS['flow'] = rdlab.flow

    def counted_flow(model, q, T, p, lattice, h, dt=None, steps=None, _f=rdlab.flow):
        COUNTERS['flow_calls'] += 1
        if steps is None:
            steps = max(1, int(math.ceil(T / rdlab.timestep(model, p, h, dt))))
        COUNTERS['rk4_steps'] += int(steps)
        t0 = time.perf_counter()
        try:
            return _f(model, q, T, p, lattice, h, dt=dt, steps=steps)
        finally:
            COUNTERS['flow_time'] += time.perf_counter() - t0

    rdlab.flow = counted_flow
    # repo modules that did ``from rdlab import flow`` at import time hold the original
    for module in (admit, modal_equations):
        if getattr(module, 'flow', None) is _ORIGINALS['flow']:
            module.flow = counted_flow


_install_counters()

# ---------------------------------------------------------------- 1. entries


@dataclass
class Entry:
    """One clockwork (wallpaper + time-shift) entry of ``wallpaper-groups.json``."""
    id: str
    family: str
    orbifold: str
    signature: str
    lattice: str                     # 'triangular' | 'square'
    phase_order: int                 # m
    mesh_multiple: int
    frame_multiple: int
    has_time_shift: bool
    basis: np.ndarray                # (2,2); row i is lattice vector a_i in Cartesian
    ops: list                        # raw op dicts {'M','v','s','tau'}
    taus: np.ndarray
    generator: int                   # index of a primitive op with tau = 1/m
    kernel: list                     # indices of ops with tau == 0
    group: dict                      # the raw JSON entry (pass straight to rdlab/admit)
    named_generators: list = _dc_field(default_factory=list)

    # -- convenience -------------------------------------------------------
    @property
    def m(self) -> int:
        return self.phase_order

    @property
    def generator_op(self) -> dict:
        return self.ops[self.generator]

    @property
    def kernel_ops(self) -> list:
        return [self.ops[i] for i in self.kernel]

    def character(self, N: int) -> 'rdlab.Character':
        """rdlab.Character for this entry on an N x N mesh (raises if incompatible)."""
        return character(self, N)

    def point_parts(self) -> list:
        """Distinct integer matrices M appearing in the ops (the point group), as tuples."""
        seen, out = set(), []
        for op in self.ops:
            key = tuple(map(tuple, op['M']))
            if key not in seen:
                seen.add(key)
                out.append(np.asarray(op['M'], int))
        return out


_GROUPS_CACHE: dict = {}


def load_groups(path=None) -> tuple:
    """(data, {id: entry_dict}) straight from wallpaper-groups.json (rdlab.load_groups)."""
    path = str(path or GROUPS_JSON)
    if path not in _GROUPS_CACHE:
        _GROUPS_CACHE[path] = rdlab.load_groups(path)
    return _GROUPS_CACHE[path]


def load_entry(group_id: str, path=None) -> Entry:
    """Load one clockwork entry, e.g. ``load_entry('g227')``."""
    _, groups = load_groups(path)
    if group_id not in groups:
        raise KeyError(f'no such entry: {group_id}')
    g = groups[group_id]
    taus = np.array([op['tau'] for op in g['ops']], float)
    m = int(g['phaseOrder'])
    gen = [i for i, t in enumerate(taus) if abs(t - 1.0 / m) < 1e-9]
    kernel = [i for i, t in enumerate(taus) if abs(t) < 1e-9]
    return Entry(id=g['id'], family=g['family'], orbifold=g.get('orbifold', ''),
                 signature=g.get('signature', ''), lattice=g['lattice'], phase_order=m,
                 mesh_multiple=int(g['meshMultiple']), frame_multiple=int(g['frameMultiple']),
                 has_time_shift=bool(g['hasTimeShift']), basis=np.asarray(g['basis'], float),
                 ops=g['ops'], taus=taus, generator=(gen[0] if gen else -1), kernel=kernel,
                 group=g, named_generators=g.get('namedGenerators', []))


def all_entry_ids(path=None) -> list:
    _, groups = load_groups(path)
    return sorted(groups, key=lambda s: int(s[1:]))


def records_for(group_id: str, model: str | None = None, directory=None) -> list:
    """Paths of the published equation-orbit metadata JSONs for an entry."""
    directory = Path(directory or ORBITS_DIR)
    pattern = f'{group_id}-{model}-*.json' if model else f'{group_id}-*.json'
    return sorted(directory.glob(pattern))


def job_config(job_id: str, batch: str = 'bruss1') -> dict:
    """The exact Modal job dict for a batch job id (e.g. ``g227-bruss-a1b23-L40-s1``)."""
    jobs = json.loads((BATCHES_DIR / batch / 'jobs.json').read_text())
    for j in jobs:
        if j['id'] == job_id:
            return dict(j)
    raise KeyError(f'no job {job_id} in batch {batch}')


def job_result(job_id: str, batch: str = 'bruss1') -> dict:
    """The recorded Modal result summary row for a batch job id (wall time, outcome)."""
    summary = json.loads((BATCHES_DIR / batch / 'batch.json').read_text())
    for row in summary['results']:
        if row.get('id') == job_id:
            return dict(row)
    raise KeyError(f'no result {job_id} in batch {batch}')


# ---------------------------------------------------------------- 2. grid helpers
_CHAR_CACHE: dict = {}


def character(entry: Entry, N: int) -> 'rdlab.Character':
    key = (entry.id, int(N))
    if key not in _CHAR_CACHE:
        if N % entry.mesh_multiple:
            raise ValueError(f'mesh N={N} incompatible with {entry.id} '
                             f'(meshMultiple={entry.mesh_multiple})')
        _CHAR_CACHE[key] = rdlab.Character(entry.group, N)
    return _CHAR_CACHE[key]


def op_mapping(op: dict, N: int) -> np.ndarray:
    """Flat gather index m with ``(S q)(p) = q.ravel()[m] = q(M p + v)`` (rdlab.mapping).

    Raises ``ValueError`` when ``v*N`` is not integral, i.e. the operation does not
    permute this mesh.
    """
    return rdlab.mapping(op, int(N))


def apply_op(field: np.ndarray, op, N: int | None = None) -> np.ndarray:
    """Exact index permutation ``(S q)(p) = q(M p + v)`` on the N x N grid.

    ``field`` may be ``(N,N)``, ``(C,N,N)`` or ``(M,C,N,N)``; ``op`` is an op dict or a
    ready flat mapping array.  Errors if the operation is incompatible with the mesh.
    """
    field = np.asarray(field)
    n = int(field.shape[-1])
    if field.shape[-2] != n:
        raise ValueError('field must be square in its last two axes')
    if N is not None and N != n:
        raise ValueError(f'field is {n}x{n}, not {N}x{N}')
    m = op if isinstance(op, np.ndarray) else op_mapping(op, n)
    lead = field.shape[:-2]
    return field.reshape(-1, n * n)[:, m].reshape(lead + (n, n))


def lattice_coords(N: int) -> np.ndarray:
    """(N, N, 2) lattice coordinates; ``out[j, i] = (i/N, j/N)`` — same indexing as fields."""
    j, i = np.indices((N, N))
    return np.stack([i / N, j / N], axis=-1)


def to_cartesian(entry: Entry, uv) -> np.ndarray:
    """Lattice coordinates -> Cartesian: ``X = u*a1 + v*a2`` (``entry.basis`` rows)."""
    uv = np.asarray(uv, float)
    return uv @ entry.basis


def to_lattice(entry: Entry, xy) -> np.ndarray:
    """Cartesian -> lattice coordinates (inverse of :func:`to_cartesian`)."""
    xy = np.asarray(xy, float)
    return xy @ np.linalg.inv(entry.basis)


def cartesian_coords(entry: Entry, N: int) -> np.ndarray:
    """(N, N, 2) Cartesian node positions, one periodic cell, matching field indexing."""
    return to_cartesian(entry, lattice_coords(N))


def kernel_reduction(entry: Entry, N: int) -> dict:
    """Kernel (tau = 0) orbit reduction exactly as ``wallpaper/search.py`` does it.

    Returns ``dict(reps, expand, count, labels)`` for one channel of length ``N*N``:
    ``reduced = q.ravel()[reps]`` and ``q.ravel() == reduced[expand]`` for any
    kernel-invariant ``q``.
    """
    ch = character(entry, N)
    kernel = ch.kernel
    labels = np.min(kernel, axis=0)
    _, expand = np.unique(labels, return_inverse=True)
    count = int(expand.max()) + 1
    _, reps = np.unique(expand, return_index=True)
    return dict(reps=reps, expand=expand, count=count, labels=labels)


def project_kernel(entry: Entry, q: np.ndarray) -> np.ndarray:
    """Average over the zero-offset (kernel) operations — rdlab's ``Character.project_kernel``."""
    return character(entry, q.shape[-1]).project_kernel(np.asarray(q, float))


def project_character(B: np.ndarray, entry: Entry, harmonic: int = 1) -> np.ndarray:
    """Project a complex field onto the twisted sector of the ``harmonic``-th temporal mode.

    ``harmonic=+1`` is the sector of the first harmonic ``Ahat``:
    ``B(g x) = exp(-2 pi i * harmonic * tau_g) B(x)``.
    Equal to ``rdlab.Character.project_complex(B, sign=-harmonic)``.
    """
    ch = character(entry, B.shape[-1])
    flat = np.asarray(B, complex).ravel()
    terms = [np.exp(2j * np.pi * harmonic * t) * flat[m] for m, t in zip(ch.maps, ch.taus)]
    return np.mean(terms, axis=0).reshape(B.shape)


def symmetry_error(frames: np.ndarray, entry: Entry) -> float:
    """max |q(g x, t + tau_g T) - q(x, t)| over all ops (rdlab Character.symmetry_error)."""
    return float(character(entry, frames.shape[-1]).symmetry_error(np.asarray(frames, float)))


# ---------------------------------------------------------------- 3. dynamics
BRUSSELATOR_DEFAULTS = dict(a=1.0, b=2.3, Du=1.0, Dv=1.0)


def brusselator_params(a=1.0, b=2.3, Du=1.0, Dv=1.0) -> dict:
    return dict(a=float(a), b=float(b), Du=float(Du), Dv=float(Dv))


def brusselator_rhs(q, a=1.0, b=2.3, Du=1.0, Dv=1.0, L=40.0, N=None, lattice='triangular'):
    """The repository Brusselator right-hand side (``rdlab.rhs_brusselator``).

    ``q`` is ``(2, N, N)``; the mesh spacing is ``h = L / N`` (``N`` defaults to ``q.shape[-1]``).
    """
    q = np.asarray(q, float)
    N = int(N or q.shape[-1])
    return rdlab.rhs_brusselator(q, brusselator_params(a, b, Du, Dv), lattice, L / N)


def timestep(params: dict, L: float, N: int, model: str = 'brusselator', dt=None) -> float:
    """The repository's stability-limited RK4 step (``rdlab.timestep``)."""
    return float(rdlab.timestep(model, params, L / N, dt))


def flow(q, T, params, entry=None, L=40.0, N=None, model='brusselator', lattice=None,
         dt=None, steps=None):
    """RK4 flow ``Phi_T`` of the unprojected equations (``rdlab.flow``), counted.

    Either pass ``entry`` (its lattice is used) or ``lattice=``.
    """
    q = np.asarray(q, float)
    N = int(N or q.shape[-1])
    lattice = lattice or (entry.lattice if entry is not None else 'square')
    return rdlab.flow(model, q, float(T), params, lattice, L / N, dt=dt, steps=steps)


def uniform_equilibrium(params: dict, model: str = 'brusselator') -> np.ndarray:
    """The spatially uniform steady state; for the Brusselator that is (a, b/a)."""
    if model == 'brusselator':
        return rdlab.uniform_equilibrium('brusselator', params, [params['a'], params['b'] / params['a']])
    raise ValueError('provide your own guess for ' + model)


def laplacian_eigenvalue(entry: Entry, wave, N: int, L: float) -> float:
    """Exact eigenvalue (<=0) of the repository stencil for the plane wave exp(2 pi i k.p/N).

    ``wave = (a, b)`` are integer reciprocal indices; matches ``wallpaper/search.py``.
    """
    a, b = int(wave[0]), int(wave[1])
    h = L / N
    if entry.lattice == 'square':
        return float(-4 * (math.sin(math.pi * a / N) ** 2 + math.sin(math.pi * b / N) ** 2) / (h * h))
    return float(2 / (3 * h * h) * (2 * math.cos(2 * math.pi * a / N) + 2 * math.cos(2 * math.pi * b / N)
                                    + 2 * math.cos(2 * math.pi * (a + b) / N) - 6))


# ---------------------------------------------------------------- 4. twisted shooting
def twisted_residual(q0, T, entry: Entry, params: dict, L=40.0, N=None, model='brusselator',
                     dt=None) -> np.ndarray:
    """``S_g Phi_{T/m}(q0) - q0`` for the primitive generator g (tau = 1/m).

    This is ``rdlab.twisted_residual`` verbatim: the repo convention applies the generator's
    index permutation to the *evolved* state.  A zero of this residual satisfies
    ``q(M x + v, t + T/m) = q(x, t)``.
    """
    q0 = np.asarray(q0, float)
    N = int(N or q0.shape[-1])
    COUNTERS['residual_calls'] += 1
    return rdlab.twisted_residual(model, q0, float(T), params, entry.lattice, L / N,
                                  character(entry, N), dt)


def estimate_period(q0, entry: Entry, params: dict, Tmin, Tmax, L=40.0, N=None,
                    model='brusselator', samples=24, dt=None):
    """Coarse grid + bounded refinement of ``|S_g Phi_{T/m}(q0) - q0|`` (rdlab.estimate_period)."""
    q0 = np.asarray(q0, float)
    N = int(N or q0.shape[-1])
    T, value, grid = rdlab.estimate_period(model, q0, params, entry.lattice, L / N,
                                           character(entry, N), Tmin, Tmax, samples=samples, dt=dt)
    return dict(T=T, residualNorm=value, grid=grid)


def newton_krylov_rpo(q0, T, entry: Entry, params: dict, L=40.0, N=None, model='brusselator',
                      maxiter=60, tol=1e-11, dt=None, callback=None, snapshots=True,
                      inner_maxiter=40, inner_method='lgmres'):
    """Newton--Krylov solve of the twisted shooting equation, with a per-iteration callback.

    Same unknowns, phase condition, residual and scipy options as ``rdlab.rpo_polish``
    (kernel-projected state plus ``log T``; the phase condition removes the time-translation
    direction), so it converges to the same orbits — but it records a history.

    ``callback(info)`` is called once per Newton iteration with
    ``dict(iteration, residualRms, T, q=<(2,N,N) copy or None>, residualNorm)``;
    the same dicts are returned in ``history``.
    """
    from scipy.optimize import root
    q0 = np.asarray(q0, float)
    N = int(N or q0.shape[-1])
    ch = character(entry, N)
    h = L / N
    ref = ch.project_kernel(q0)
    tangent = rdlab.MODELS[model]['rhs'](ref, params, entry.lattice, h)
    tangent = tangent / (np.linalg.norm(tangent) or 1.0)
    n = ref.size
    history = []

    def unpack(z):
        return ch.project_kernel(z[:n].reshape(ref.shape)), float(np.exp(z[n]))

    def residual(z):
        qz, Tz = unpack(z)
        r = ch.project_kernel(rdlab.twisted_residual(model, qz, Tz, params, entry.lattice, h, ch, dt))
        COUNTERS['residual_calls'] += 1
        return np.r_[r.ravel(), np.sum((qz - ref) * tangent)]

    def _callback(z, f):
        qz, Tz = unpack(z)
        info = dict(iteration=len(history), residualRms=float(np.sqrt(np.mean(f[:-1] ** 2))),
                    residualNorm=float(np.linalg.norm(f[:-1])), phaseCondition=float(f[-1]),
                    T=Tz, q=(qz.copy() if snapshots else None))
        history.append(info)
        if callback is not None:
            callback(info)

    z0 = np.r_[ref.ravel(), np.log(float(T))]
    t0 = time.perf_counter()
    started = counters()
    sol = root(residual, z0, method='krylov', callback=_callback,
               options=dict(fatol=tol, maxiter=maxiter,
                            jac_options=dict(inner_maxiter=inner_maxiter, method=inner_method)))
    qz, Tz = unpack(sol.x)
    r = residual(sol.x)
    spent = {k: COUNTERS[k] - started[k] for k in COUNTERS}
    return dict(q=qz, T=Tz, residual=float(np.sqrt(np.mean(r[:-1] ** 2))),
                success=bool(sol.success), message=str(sol.message), history=history,
                iterations=len(history), wallSeconds=time.perf_counter() - t0, cost=spent)


def rpo_polish(q0, T, entry: Entry, params: dict, L=40.0, N=None, model='brusselator',
               maxiter=40, tol=1e-11, dt=None):
    """``rdlab.rpo_polish`` unchanged (the call the published record was produced by)."""
    q0 = np.asarray(q0, float)
    N = int(N or q0.shape[-1])
    return rdlab.rpo_polish(model, q0, float(T), params, entry.lattice, L / N,
                            character(entry, N), maxiter=maxiter, tol=tol, dt=dt)


def movie_from_state(q0, T, entry: Entry, params: dict, M=48, L=40.0, N=None,
                     model='brusselator', dt=None, project=False) -> np.ndarray:
    """One independent RK4 period from ``q0``: ``(M, 2, N, N)``.

    ``project=True`` additionally applies ``rdlab.space_time_project`` (what the site's
    exporter does, to make an already-symmetric sample bit-identical under the action).
    """
    q0 = np.asarray(q0, float)
    N = int(N or q0.shape[-1])
    h = L / N
    frames = []
    s = q0.copy()
    for _ in range(M):
        frames.append(s.copy())
        s = rdlab.flow(model, s, T / M, params, entry.lattice, h, dt)
    out = np.array(frames)
    return rdlab.space_time_project(out, character(entry, N)) if project else out


# ---------------------------------------------------------------- 5. published records
def load_published(record_json=None, group_id=None, model='brusselator') -> dict:
    """Read a published equation-orbit record: frames ``(M,2,N,N)``, period, params.

    Layout (from the metadata): frame-major, planar channel 0 then channel 1, x-fast,
    lattice nodes ``i/N, j/N``.  Returns a dict with ``frames, period, params, config,
    entry, N, M, L, model, meta, sha256Matches, path``.
    """
    if record_json is None:
        record_json = (records_for(group_id, model)[0] if group_id else PUBLISHED_G227)
    path = Path(record_json)
    meta = json.loads(path.read_text())
    cfg = meta['config']
    payload = (path.parent / meta['fieldUrl']).read_bytes()
    if meta.get('fieldEncoding') not in (None, 'float32-le'):
        raise ValueError('unexpected field encoding ' + str(meta.get('fieldEncoding')))
    M, N = int(cfg['M']), int(cfg['N'])
    frames = np.frombuffer(payload, dtype='<f4').reshape(M, 2, N, N).astype(float)
    import hashlib
    digest = hashlib.sha256(payload).hexdigest()
    return dict(frames=frames, period=float(cfg['period']), params={k: v for k, v in cfg['params'].items()
                                                                    if k not in ('dx', 'stencil')},
                config=cfg, entry=load_entry(cfg['groupId']), N=N, M=M, L=float(cfg['L']),
                model=cfg['model'], meta=meta, path=str(path),
                sha256Matches=(digest == meta.get('fieldSha256')), fieldSha256=digest)


def resample_time(frames: np.ndarray, M2: int) -> np.ndarray:
    """Resample a movie along time (periodic) to ``M2`` frames.

    Exact when ``M2`` divides ``M`` (plain decimation, no band-limit assumption); otherwise
    ``scipy.signal.resample`` — band-limited periodic interpolation, which is only as good as
    the movie's temporal resolution near the Nyquist frame (the repo's audit keeps the tail
    energy above ``M/4`` below 1%).
    """
    frames = np.asarray(frames, float)
    M = frames.shape[0]
    if M == M2:
        return frames.copy()
    if M2 < M and M % M2 == 0:
        return frames[::M // M2].copy()
    from scipy.signal import resample
    return np.asarray(resample(frames, int(M2), axis=0), float)


def _shift_time_fractional(frames: np.ndarray, delta: float) -> np.ndarray:
    """Shift a movie in time by ``delta`` frames (band-limited, periodic)."""
    M = frames.shape[0]
    F = np.fft.rfft(frames, axis=0)
    k = np.arange(F.shape[0])
    phase = np.exp(-2j * np.pi * k * delta / M).reshape((-1,) + (1,) * (frames.ndim - 1))
    return np.fft.irfft(F * phase, n=M, axis=0)


def compare_orbits(A, B, entry: Entry | None = None, allow_ops=True, refine=True,
                   verbose=False) -> dict:
    """Are two orbits the same solution?  Aligns the time origin, all lattice translations
    and (optionally) the entry's point-group parts, then reports the residual difference.

    ``A``/``B`` may be ``load_published`` dicts, ``dict(frames=..., period=...)`` or
    ``(frames, period)`` tuples.  Alignment is exact and exhaustive: for each candidate
    point-group part ``P`` the squared difference over *every* integer time shift and
    *every* lattice translation is obtained from one FFT cross-correlation, because

        ||A - B'||^2 = ||A||^2 + ||B||^2 - 2 <A, B'>

    and ``B'`` runs over permutations of ``B``.  ``refine=True`` then minimises over a
    fractional time shift (band-limited interpolation).

    Returns ``dict(periodA, periodB, periodDifference, relativePeriodDifference, rms, max,
    relativeRms, frameShift, translation, pointPart, fractionalFrameShift, sameOrbit)``.
    """
    def unwrap(x):
        if isinstance(x, dict):
            return np.asarray(x['frames'], float), float(x.get('period') or x['config']['period'])
        frames, period = x
        return np.asarray(frames, float), float(period)

    fa, Ta = unwrap(A)
    fb, Tb = unwrap(B)
    if fa.shape[-1] != fb.shape[-1]:
        raise ValueError('compare_orbits needs the same spatial mesh')
    if fa.shape[0] != fb.shape[0]:
        fb = resample_time(fb, fa.shape[0])
    M, C, N, _ = fa.shape
    parts = [np.eye(2, dtype=int)]
    if allow_ops and entry is not None:
        parts = entry.point_parts()
    na = float(np.sum(fa ** 2))
    nb = float(np.sum(fb ** 2))
    size = fa.size
    best = None
    Fa = np.fft.rfftn(fa, axes=(0, 2, 3))
    for P in parts:
        op = dict(M=[[int(P[0, 0]), int(P[0, 1])], [int(P[1, 0]), int(P[1, 1])]], v=[0.0, 0.0])
        try:
            fbp = apply_op(fb, op)
        except ValueError:
            continue
        # correlation over (time shift, j shift, i shift)
        corr = np.fft.irfftn(np.conj(Fa) * np.fft.rfftn(fbp, axes=(0, 2, 3)), s=(M, N, N),
                             axes=(0, 2, 3)).sum(axis=1)
        sq = (na + nb - 2 * corr) / size
        idx = np.unravel_index(int(np.argmin(sq)), sq.shape)
        value = float(sq[idx])
        if best is None or value < best[0]:
            best = (value, idx, op, fbp)
    if best is None:
        raise ValueError('no compatible point-group part')
    _, (st, sj, si), op, fbp = best
    aligned = np.roll(np.roll(np.roll(fbp, -st, axis=0), -sj, axis=2), -si, axis=3)
    frac = 0.0
    if refine and M >= 8:
        from scipy.optimize import minimize_scalar
        def cost(d):
            return float(np.sqrt(np.mean((_shift_time_fractional(aligned, d) - fa) ** 2)))
        res = minimize_scalar(cost, bounds=(-1.0, 1.0), method='bounded', options=dict(xatol=1e-7))
        if res.fun < np.sqrt(np.mean((aligned - fa) ** 2)):
            frac = float(res.x)
            aligned = _shift_time_fractional(aligned, frac)
    diff = aligned - fa
    rms = float(np.sqrt(np.mean(diff ** 2)))
    span = float(fa.max() - fa.min()) or 1.0
    out = dict(periodA=Ta, periodB=Tb, periodDifference=abs(Ta - Tb),
               relativePeriodDifference=abs(Ta - Tb) / max(abs(Ta), 1e-30),
               rms=rms, max=float(np.max(abs(diff))), relativeRms=rms / span,
               frameShift=int(st), translation=[int(si), int(sj)],
               pointPart=[[int(v) for v in row] for row in op['M']],
               fractionalFrameShift=frac, fieldSpan=span)
    out['sameOrbit'] = bool(out['relativePeriodDifference'] < 1e-4 and out['relativeRms'] < 1e-2)
    if verbose:
        print(json.dumps({k: v for k, v in out.items() if k != 'pointPart'}, indent=1))
    return out


# ---------------------------------------------------------------- 6. Hopf, seeds
def hopf_eigen(a=1.0, b=2.3, Du=1.0, Dv=1.0, k2=0.0, params=None, model='brusselator') -> dict:
    """Linearisation of the Brusselator about its uniform state with diffusion.

    ``k2 = |k|^2 >= 0`` (or use ``-`` the stencil eigenvalue from
    :func:`laplacian_eigenvalue`); the diffusion eigenvalue handed to rdlab is
    ``lam = -k2``.  Returns ``dict(eigenvalues, eigenvectors, index, lam, growth, omega,
    period, e_hopf, q0, muHopf)`` where ``e_hopf`` is normalised to first component 1,
    exactly as ``rdlab.seed_from_complex`` does.
    """
    p = params or brusselator_params(a, b, Du, Dv)
    q0 = uniform_equilibrium(p, model)
    lam = -float(k2)
    w, V = rdlab.hopf_eigen(model, p, q0, lam)
    i = int(np.argmax(w.imag))
    e = V[:, i] / V[0, i]
    omega = float(abs(w[i].imag))
    return dict(eigenvalues=w, eigenvectors=V, index=i, lam=lam, growth=float(w[i].real),
                omega=omega, period=(2 * math.pi / omega if omega > 0 else math.inf),
                e_hopf=e, q0=q0, muHopf=float(p['b'] - 1 - p['a'] ** 2))


def wave_shells(entry: Entry, N: int, L: float, radius: int = 4, harmonic: int = 1,
                tolerance: float = 1e-9) -> list:
    """Reciprocal-lattice shells, smallest ``|k|`` first, with the character projection's norm.

    Returns a list of ``dict(waves, surviving, lam, k2, projectionNorm, norms)``; ``lam`` is
    the exact stencil Laplacian eigenvalue and ``k2 = -lam``.  ``surviving`` lists the members
    of the shell whose twisted star does **not** cancel — every wave is tested, because within
    one shell some survive and some do not: for g227 the star of ``(1,0)`` survives while the
    star of ``(-1,0)`` cancels identically, since the entry's ``(1/3, 2/3)`` translation with
    ``tau = 2/3`` selects ``a + 2b == 1 (mod 3)``.  A shell with ``projectionNorm == 0`` cannot
    seed the character at all.
    """
    seen: dict[float, list] = {}
    for a in range(-radius, radius + 1):
        for b in range(-radius, radius + 1):
            if a == 0 and b == 0:
                continue
            lam = laplacian_eigenvalue(entry, (a, b), N, L)
            key = round(lam, 9)
            seen.setdefault(key, []).append((a, b))
    out = []
    for lam in sorted(seen, reverse=True):          # lam <= 0, so descending = |k| ascending
        waves = seen[lam]
        norms = [float(np.sqrt(np.mean(abs(character_star(entry, N, w, harmonic=harmonic)) ** 2)))
                 for w in waves]
        surviving = [w for w, n in zip(waves, norms) if n > tolerance]
        out.append(dict(waves=waves, surviving=surviving, lam=lam, k2=-lam,
                        projectionNorm=float(max(norms)), norms=norms))
    return out


def character_star(entry: Entry, N: int, wave, harmonic: int = 1) -> np.ndarray:
    """The twisted plane-wave star ``sum_g exp(2 pi i harmonic tau_g) * (plane wave o g)``.

    The result satisfies ``psi(g x) = exp(-2 pi i harmonic tau_g) psi(x)`` — the law obeyed
    by the ``harmonic``-th temporal Fourier coefficient of a clockwork orbit.  Construction
    identical to ``wallpaper/search.py``'s ``psi``.
    """
    ch = character(entry, N)
    j, i = np.indices((N, N))
    a, b = int(wave[0]), int(wave[1])
    base = np.exp(2j * np.pi * (a * i + b * j) / N).ravel()
    return sum(np.exp(2j * np.pi * harmonic * t) * base[m]
               for m, t in zip(ch.maps, ch.taus)).reshape(N, N) / len(ch.maps)


def character_star_seed(entry: Entry, N=36, L=40.0, shell=1, sign=1, params=None,
                        amplitude=0.25, model='brusselator', wave=None, seed_phase=0.0) -> dict:
    """Seed (ii): the lowest-|k| twisted plane-wave star lifted through the Hopf eigenvector.

    ``shell=1`` is the smallest ``|k|`` whose character projection does not vanish (shell 2
    the next, and so on); ``sign=+1`` builds the sector of the first harmonic
    (``psi(gx) = e^{-2 pi i tau_g} psi(x)``), ``sign=-1`` its conjugate.  The complex star is
    lifted with ``rdlab.seed_from_complex`` (``q = q0 + amplitude * Re(psi * e_Hopf)``, unit
    rms direction) and the trial period is ``T0 = 2 pi / Im lambda`` of the Hopf eigenvalue at
    that ``|k|``.

    Returns ``dict(seed, T0, psi, waves, lam, k2, omega, growth, shell, e_hopf, q0, amplitude)``.
    """
    p = params or brusselator_params()
    shells = [s for s in wave_shells(entry, N, L, harmonic=sign) if s['projectionNorm'] > 1e-9]
    if wave is not None:
        lam = laplacian_eigenvalue(entry, wave, N, L)
        chosen = dict(waves=[tuple(wave)], surviving=[tuple(wave)], lam=lam, k2=-lam,
                      projectionNorm=None)
    else:
        if shell < 1 or shell > len(shells):
            raise ValueError(f'shell {shell} out of range (1..{len(shells)})')
        chosen = shells[shell - 1]
    psi = character_star(entry, N, chosen['surviving'][0], harmonic=sign)
    if seed_phase:
        psi = psi * np.exp(2j * np.pi * seed_phase)
    norm = float(np.sqrt(np.mean(abs(psi) ** 2)))
    if norm < 1e-12:
        raise ValueError('this reciprocal shell cancels under the character')
    hopf = hopf_eigen(params=p, k2=chosen['k2'], model=model)
    seed, omega = rdlab.seed_from_complex(model, p, hopf['q0'], psi, amplitude, lam=chosen['lam'])
    return dict(seed=seed, T0=2 * math.pi / omega, psi=psi, waves=chosen['waves'],
                surviving=chosen['surviving'], wave=chosen['surviving'][0],
                lam=chosen['lam'], k2=chosen['k2'], omega=omega, growth=hopf['growth'],
                shell=(shell if wave is None else None), e_hopf=hopf['e_hopf'], q0=hopf['q0'],
                amplitude=float(amplitude), projectionNorm=norm, sign=int(sign),
                availableShells=[dict(lam=s['lam'], k2=s['k2'], waves=s['waves'],
                                      surviving=s['surviving'],
                                      projectionNorm=s['projectionNorm']) for s in shells[:6]])


def original_cgl_seed(entry: Entry, job: dict, signs=(1, -1)) -> dict:
    """Seed (i), stage 1: the matched Ginzburg--Landau spiral lattice, exactly as the job did.

    Reproduces ``modal_equations.run_brusselator``'s first stage: reduced coefficients
    ``alpha=0, beta=job.seedBeta (0.11), D=2``, rescaled box ``Lc = L sqrt(2 mu / max(Du,Dv))``
    with ``mu = b - 1 - a^2``, ``rdlab.cgl_relative_equilibrium`` from noise inside the
    character subspace (total_time 600, report_every 50, tol 1e-9) then ``rdlab.cgl_polish``;
    both signs are tried and the audited one is kept.
    """
    p = brusselator_params(job['a'], job['b'], job.get('Du', 1.0), job.get('Dv', 1.0))
    L, N = float(job['L']), int(job['N'])
    mu = p['b'] - 1 - p['a'] ** 2
    if mu <= 0:
        raise ValueError('Brusselator uniform state must be Hopf-unstable (b > 1 + a^2)')
    Lc = L * math.sqrt(2 * mu / max(p['Du'], p['Dv']))
    pc = dict(alpha=0.0, beta=float(job.get('seedBeta', 0.11)), D=2.0)
    stages = []
    for sign in signs:
        r = rdlab.cgl_relative_equilibrium(entry.group, N, Lc, pc, seed=int(job.get('seed', 0)),
                                           sign=sign, lattice=entry.lattice, total_time=600,
                                           report_every=50, tol=1e-9)
        pol = rdlab.cgl_polish(r['B'], r['omega'], r['character'], pc, entry.lattice, Lc / N, sign=sign)
        movie, T = rdlab.cgl_movie(pol['B'], pol['omega'], 48)
        a = rdlab.audit('ginzburg-landau', movie, pc, entry.group, Lc, T, entry.lattice, dynamics=False)
        stages.append(dict(stage='cgl-seed', sign=sign, residual=pol['residual'], omega=pol['omega'],
                           structural=a['structuralPassed'], symmetryMax=a['symmetryMax']))
        if a['structuralPassed'] and pol['residual'] < 1e-8:
            return dict(B=pol['B'], sign=sign, omega=pol['omega'], residual=pol['residual'],
                        Lc=Lc, pc=pc, mu=mu, stages=stages, success=True)
    return dict(B=None, sign=None, stages=stages, Lc=Lc, pc=pc, mu=mu, success=False)


def original_seed(entry: Entry, job: dict, amplitude=None) -> dict:
    """Seed (i), complete: the ORIGINAL pipeline's Brusselator seed and trial period.

    ``original_cgl_seed`` then ``rdlab.seed_from_complex`` at the job's ``seedAmplitude``
    (default 0.25), with ``T0 = 2 pi / Im lambda_Hopf`` at ``lam = 0`` (as the job does).
    """
    p = brusselator_params(job['a'], job['b'], job.get('Du', 1.0), job.get('Dv', 1.0))
    cgl = original_cgl_seed(entry, job)
    if not cgl['success']:
        return dict(success=False, cgl=cgl)
    amp = float(job.get('seedAmplitude', 0.25) if amplitude is None else amplitude)
    q0 = uniform_equilibrium(p)
    seed, omega = rdlab.seed_from_complex('brusselator', p, q0, cgl['B'], amplitude=amp)
    return dict(success=True, seed=seed, T0=2 * math.pi / omega, omega=omega, amplitude=amp,
                cgl={k: v for k, v in cgl.items() if k != 'B'}, B=cgl['B'], sign=cgl['sign'],
                params=p, q0=q0)


def run_original_pipeline(job: dict | None = None, entry: Entry | None = None,
                          job_id: str = G227_JOB_ID, batch: str = 'bruss1') -> dict:
    """Run the ORIGINAL Modal job locally on the CPU: ``modal_equations.run_brusselator``.

    No Modal, no network, no cost: the ``modal`` package is stubbed at import.  Returns the
    job's own result dict plus ``labWallSeconds`` and ``labCost`` (the counter delta).
    """
    job = dict(job or job_config(job_id, batch))
    entry = entry or load_entry(job['groupId'])
    modal_equations.validate(job)
    started = counters()
    t0 = time.perf_counter()
    out = modal_equations.run_brusselator(job, entry.group, t0)
    out['labWallSeconds'] = time.perf_counter() - t0
    out['labCost'] = {k: COUNTERS[k] - started[k] for k in COUNTERS}
    return out


# ---------------------------------------------------------------- 7. harmonics, vortices
def first_harmonic(frames: np.ndarray, harmonic: int = 1) -> np.ndarray:
    """``Ahat(x) = (1/T) int_0^T q(x,t) e^{-2 pi i harmonic t / T} dt`` per channel.

    Returned as a complex ``(C, N, N)`` array (the discrete mean over saved frames).
    For a clockwork orbit it obeys ``Ahat(g x) = exp(-2 pi i harmonic tau_g) Ahat(x)``
    (verified in :func:`harmonic_character_error`).
    """
    frames = np.asarray(frames, float)
    M = frames.shape[0]
    phase = np.exp(-2j * np.pi * harmonic * np.arange(M) / M)
    return np.tensordot(phase, frames, axes=(0, 0)) / M


def harmonic_character_error(Ahat: np.ndarray, entry: Entry, harmonic: int = 1) -> dict:
    """Check ``Ahat(g x) = e^{-2 pi i harmonic tau_g} Ahat(x)`` for every op; also the ``+`` sign.

    Returns ``dict(minusSignMax, plusSignMax, scale, operations)`` — for a genuine clockwork
    orbit ``minusSignMax`` is at round-off and ``plusSignMax`` is of order ``scale``.
    """
    Ahat = np.asarray(Ahat, complex)
    ch = character(entry, Ahat.shape[-1])
    scale = float(np.max(abs(Ahat))) or 1.0
    rows, minus, plus = [], 0.0, 0.0
    for i, (m, t) in enumerate(zip(ch.maps, ch.taus)):
        moved = apply_op(Ahat, m)
        e_minus = float(np.max(abs(moved - np.exp(-2j * np.pi * harmonic * t) * Ahat)))
        e_plus = float(np.max(abs(moved - np.exp(+2j * np.pi * harmonic * t) * Ahat)))
        rows.append(dict(operation=i, tau=float(t), minusSign=e_minus, plusSign=e_plus))
        minus, plus = max(minus, e_minus), max(plus, e_plus)
    return dict(minusSignMax=minus, plusSignMax=plus, scale=scale,
                minusSignRelative=minus / scale, plusSignRelative=plus / scale, operations=rows)


def _triangles(N: int, lattice: str) -> list:
    """Elementary loops of the mesh as lists of (i, j) node offsets, counter-clockwise.

    Triangular lattice: the two triangles of each rhombus cut along the short diagonal
    (0,0)-(1,1), matching the repository's rendering interpolation.  Square: the 4-cycle.
    """
    if lattice == 'triangular':
        return [[(0, 0), (1, 0), (1, 1)], [(0, 0), (1, 1), (0, 1)]]
    return [[(0, 0), (1, 0), (1, 1), (0, 1)]]


def winding_map(Ahat2d: np.ndarray, entry: Entry) -> list:
    """Per-cell phase winding of a complex field: list of ``(charge_array, offsets)``.

    One entry per elementary loop of :func:`_triangles`; ``charge_array[j, i]`` is the
    winding number of ``arg Ahat`` around the loop anchored at node ``(i, j)``, computed
    from principal-value phase differences (so it is an exact integer for a resolved field).
    """
    A = np.asarray(Ahat2d, complex)
    N = A.shape[-1]
    out = []
    for loop in _triangles(N, entry.lattice):
        total = np.zeros((N, N))
        for k in range(len(loop)):
            (i0, j0), (i1, j1) = loop[k], loop[(k + 1) % len(loop)]
            z0 = np.roll(np.roll(A, -j0, axis=0), -i0, axis=1)
            z1 = np.roll(np.roll(A, -j1, axis=0), -i1, axis=1)
            total += np.angle(z1 / np.where(abs(z0) == 0, 1e-300, z0))
        out.append((np.rint(total / (2 * np.pi)).astype(int), loop))
    return out


def _neighbour_ring(lattice: str) -> list:
    """Neighbour offsets around a node, counter-clockwise in Cartesian (y up)."""
    if lattice == 'triangular':
        return [(1, 0), (1, 1), (0, 1), (-1, 0), (-1, -1), (0, -1)]
    return [(1, 0), (0, 1), (-1, 0), (0, -1)]


def node_winding(Ahat2d: np.ndarray, entry: Entry, tolerance: float = 1e-9,
                 return_mask: bool = False):
    """Winding of ``arg Ahat`` around the neighbour ring of every node: integer ``(N,N)``.

    Use this when a rotation centre sits *on* a mesh node — which is where the theory says
    the harmonic must vanish: the loop encircles the node itself, so the charge is read off
    directly instead of from the adjacent triangles.

    A ring that *passes through* a zero has no defined winding; those entries are set to 0
    (a ring node with ``|Ahat| <= tolerance * max|Ahat|`` counts as a zero).  Without this,
    every true vortex node also produces spurious +-1 at the neighbours whose ring runs over
    it.  ``return_mask=True`` additionally returns the boolean "well defined" mask.
    """
    A = np.asarray(Ahat2d, complex)
    N = A.shape[-1]
    ring = _neighbour_ring(entry.lattice)
    scale = float(np.max(abs(A))) or 1.0
    total = np.zeros((N, N))
    defined = np.ones((N, N), bool)
    for k in range(len(ring)):
        (i0, j0), (i1, j1) = ring[k], ring[(k + 1) % len(ring)]
        z0 = np.roll(np.roll(A, -j0, axis=0), -i0, axis=1)
        z1 = np.roll(np.roll(A, -j1, axis=0), -i1, axis=1)
        total += np.angle(z1 / np.where(abs(z0) == 0, 1e-300, z0))
        defined &= abs(z0) > tolerance * scale
    out = np.where(defined, np.rint(total / (2 * np.pi)), 0).astype(int)
    return (out, defined) if return_mask else out


def find_vortices(Ahat, entry: Entry, channel: int = 0) -> list:
    """Vortices of ``Ahat``: winding of ``arg Ahat`` around every elementary cell.

    ``Ahat`` may be ``(C,N,N)`` (``channel`` selects) or ``(N,N)``.  Returns a list of
    ``dict(charge, lattice=[u,v], cartesian=[x,y], amplitude, loop)`` sorted by |u|,|v|;
    positions are loop centroids in lattice coordinates (fractions of a cell) and in
    Cartesian units of the lattice length.  ``amplitude`` is the mean ``|Ahat|`` on the loop
    (small at a true zero).
    """
    A = np.asarray(Ahat, complex)
    if A.ndim == 3:
        A = A[channel]
    N = A.shape[-1]
    out = []
    for charges, loop in winding_map(A, entry):
        js, iss = np.nonzero(charges)
        for j, i in zip(js.tolist(), iss.tolist()):
            nodes = [((i + di) % N, (j + dj) % N) for di, dj in loop]
            uv = np.mean([[(i + di) / N, (j + dj) / N] for di, dj in loop], axis=0)
            amp = float(np.mean([abs(A[jj, ii]) for ii, jj in nodes]))
            out.append(dict(charge=int(charges[j, i]), lattice=[float(uv[0]), float(uv[1])],
                            cartesian=[float(v) for v in to_cartesian(entry, uv)],
                            amplitude=amp, loop=[list(map(int, p)) for p in loop],
                            anchor=[int(i), int(j)]))
    out.sort(key=lambda r: (r['lattice'][1], r['lattice'][0]))
    return out


def rotation_centres(entry: Entry, translation_range: int = 2) -> list:
    """Every rotation-centre class of the entry in one lattice cell, with order and offset.

    For each op whose linear part ``M`` is a rotation of order ``n > 1``, and each lattice
    translation ``l``, the map ``x -> M x + v + l`` has the fixed point
    ``x* = (I - M)^{-1} (v + l)``.  Centres are deduped modulo the lattice.  The primitive
    generator at a centre is the one whose Cartesian rotation angle is ``+2 pi / n``; its
    offset is ``k / n`` with ``k = round(tau * n)``.

    Returns, per centre, ``dict(lattice, cartesian, order, tau, k, angleDegrees,
    predictedWinding, ops)``.  ``predictedWinding`` is ``(-k) mod n`` reduced to the
    symmetric range: the first harmonic must vanish there with winding ``w = -k (mod n)``
    (from ``Ahat(gx) = e^{-2 pi i tau} Ahat(x)`` and ``Ahat ~ z^w`` near the centre, where the
    generator rotates the Cartesian plane by ``+2 pi / n``).
    """
    A = entry.basis.T                      # columns are a1, a2: Cartesian = A @ (u,v)
    Ainv = np.linalg.inv(A)
    found: dict[tuple, dict] = {}
    for index, op in enumerate(entry.ops):
        Mi = np.asarray(op['M'], int)
        if np.array_equal(Mi, np.eye(2, dtype=int)):
            continue
        # order of M
        P = Mi.copy()
        n = 1
        while not np.array_equal(P, np.eye(2, dtype=int)) and n < 12:
            P = P @ Mi
            n += 1
        if n < 2 or n > 6:
            continue
        Mc = A @ Mi @ Ainv
        if abs(np.linalg.det(Mc) - 1) > 1e-9:
            continue                        # a reflection, not a rotation
        angle = math.degrees(math.atan2(Mc[1, 0], Mc[0, 0]))
        I_M = np.eye(2) - Mi
        if abs(np.linalg.det(I_M)) < 1e-12:
            continue
        v = np.asarray(op.get('v', [0, 0]), float)
        for la in range(-translation_range, translation_range + 1):
            for lb in range(-translation_range, translation_range + 1):
                x = np.linalg.solve(I_M, v + np.array([la, lb], float))
                key = tuple(np.round(np.mod(x, 1.0), 9) % 1.0)
                rec = found.setdefault(key, dict(lattice=[float(key[0]), float(key[1])],
                                                 cartesian=[float(t) for t in to_cartesian(entry, np.array(key))],
                                                 order=n, ops=[]))
                rec['order'] = max(rec['order'], n)
                rec['ops'].append(dict(op=index, tau=float(op['tau']), angleDegrees=angle,
                                       translation=[la, lb]))
    out = []
    for rec in found.values():
        n = rec['order']
        target = 360.0 / n
        primitive = min(rec['ops'], key=lambda r: abs(((r['angleDegrees'] - target + 180) % 360) - 180))
        tau = primitive['tau']
        k = int(round(tau * n)) % n
        w = ((-k) % n)
        if w > n // 2:
            w -= n
        rec.update(tau=tau, k=k, angleDegrees=primitive['angleDegrees'], predictedWinding=w,
                   primitiveOp=primitive['op'],
                   ops=sorted({(r['op'], round(r['tau'], 6), round(r['angleDegrees'], 3)) for r in rec['ops']}))
        rec['ops'] = [dict(op=o, tau=t, angleDegrees=g) for o, t, g in rec['ops']]
        out.append(rec)
    out.sort(key=lambda r: (r['lattice'][1], r['lattice'][0]))
    return out


def charges_at_centres(Ahat, entry: Entry, channel: int = 0, tolerance: float = 0.02) -> list:
    """Match measured vortices to the rotation-centre classes of the entry.

    For each centre from :func:`rotation_centres`, sum the charges of the vortices whose
    loop encloses it (within ``tolerance`` of a cell in lattice coordinates), and compare
    with the prediction.  Returns a list of dicts with ``measuredCharge``,
    ``predictedWinding``, ``agrees``, ``amplitudeAtCentre``.
    """
    A = np.asarray(Ahat, complex)
    if A.ndim == 3:
        A = A[channel]
    N = A.shape[-1]
    scale = float(np.max(abs(A))) or 1.0
    vortices = find_vortices(A, entry)
    nodes = node_winding(A, entry)
    out = []
    for centre in rotation_centres(entry):
        cu, cv = centre['lattice']
        total, members = 0, []
        for vx in vortices:
            du = (vx['lattice'][0] - cu + .5) % 1.0 - .5
            dv = (vx['lattice'][1] - cv + .5) % 1.0 - .5
            if abs(du) <= 1.0 / N + tolerance and abs(dv) <= 1.0 / N + tolerance:
                total += vx['charge']
                members.append(vx)
        iu, iv = int(round(cu * N)) % N, int(round(cv * N)) % N
        on_node = abs(cu * N - round(cu * N)) < 1e-6 and abs(cv * N - round(cv * N)) < 1e-6
        amp = float(abs(A[iv, iu])) if on_node else float('nan')
        ring = int(nodes[iv, iu]) if on_node else None
        if on_node:
            total = ring
        n = centre['order']
        agrees = ((total - centre['predictedWinding']) % n) == 0
        out.append(dict(lattice=centre['lattice'], cartesian=centre['cartesian'], order=n,
                        tau=centre['tau'], k=centre['k'],
                        predictedWinding=centre['predictedWinding'], measuredCharge=int(total),
                        agrees=bool(agrees), vortexCount=len(members),
                        ringWinding=ring, amplitudeAtCentre=amp,
                        relativeAmplitudeAtCentre=amp / scale, centreOnNode=bool(on_node)))
    return out


# ---------------------------------------------------------------- 8. audit
def audit(frames: np.ndarray, T: float, entry: Entry, params: dict, L=40.0,
          model='brusselator', full=True) -> dict:
    """The repository acceptance audit on a movie: ``admit.certify`` with the repo ``LIMITS``.

    Builds the metadata ``config`` the certifier expects (including ``dx`` and the stencil
    name), then runs the structural checks (exact phase relations at every saved frame,
    same-time contrast/visibility, variation floors, primitive-period resolution, temporal
    tail) plus the independent unprojected RK4 replay at two timestep limits and the
    forward triangle bounds.  ``full=False`` uses the lighter model-generic
    ``rdlab.audit`` instead.

    Returns ``dict(passed=..., certificate=..., summary=...)``.
    """
    frames = np.asarray(frames, float)
    M, C, N, _ = frames.shape
    h = L / N
    config = dict(N=N, M=M, L=float(L), period=float(T), groupId=entry.id, model=model,
                  params={**params, 'dx': h,
                          'stencil': 'triangular-six' if entry.lattice == 'triangular' else 'five-point'},
                  ops=entry.ops)
    if full:
        cert = admit.certify(frames, config, entry.group)
    else:
        cert = rdlab.audit(model, frames, params, entry.group, L, T, entry.lattice)
    dyn = cert.get('independentDynamics') or {}
    relation = cert.get('phaseRelations') or {}
    if relation.get('operations'):
        sym_max = max(r['maximum'] for r in relation['operations'])
    elif 'max' in relation:
        sym_max = relation['max']                      # the op that failed
    else:
        sym_max = cert.get('symmetryMax')              # rdlab.audit's key (full=False)
    summary = dict(passed=bool(cert.get('passed')),
                   symmetryMax=sym_max,
                   phaseRelationsPassed=relation.get('passed'),
                   spatialRms=cert.get('spatialRms'), temporalRms=cert.get('temporalRms'),
                   minimum=cert.get('minimum'), maximum=cert.get('maximum'),
                   visibilityPassed=(cert.get('visibility', {}) or {}).get('passed'),
                   tailEnergyFraction=(cert.get('temporalResolution', {}) or {}).get('tailEnergyFraction'),
                   trajectoryRms=[c.get('trajectoryRms') for c in dyn.get('checks', [])],
                   closureRms=[c.get('closureRms') for c in dyn.get('checks', [])],
                   dynamicsPassed=dyn.get('passed'),
                   forwardBoundsPassed=(cert.get('forwardTargetPhaseBounds', {}) or {}).get('passed'),
                   limits=dict(LIMITS))
    return dict(passed=bool(cert.get('passed')), certificate=cert, summary=summary, config=config)


# ---------------------------------------------------------------- 9. pictures
EMBER_STOPS = np.array([[0, 18, 9, 39], [.22, 65, 12, 94], [.43, 99, 25, 116], [.58, 171, 45, 90],
                        [.69, 240, 111, 32], [.78, 252, 181, 42], [.89, 253, 219, 94],
                        [1, 252, 242, 158]], float)
CERAMIC_STOPS = np.array([[0, 91, 64, 57], [.15, 171, 111, 87], [.33, 247, 159, 119],
                          [.48, 239, 175, 130], [.59, 77, 41, 97], [.68, 37, 47, 120],
                          [.77, 117, 125, 180], [.86, 208, 213, 235], [1, 252, 249, 238]], float)
CONCENTRATION_STOPS = np.array([[0, 18, 18, 24], [1, 245, 245, 251]], float)
MONO_STOPS = np.array([[0, 0, 0, 0], [1, 255, 255, 255]], float)
PALETTES = dict(ember=EMBER_STOPS, ceramic=CERAMIC_STOPS, concentration=CONCENTRATION_STOPS,
                mono=MONO_STOPS)
# The published g227 record's u range and monochrome cut, as standalone/brusselator-p3
# hard-codes them (public/renderer.mjs:26 and :30).
G227_U_RANGE = (0.5700383186340332, 1.9851957559585571)
MONO_THRESHOLD = 0.426


def upsample_field(grid: np.ndarray, factor: int = 2) -> np.ndarray:
    """Band-limited (Fourier) upsampling of a periodic lattice field, as the site does on load."""
    grid = np.asarray(grid, float)
    if factor == 1:
        return grid
    return rdlab.resample_complex(grid.astype(complex), int(grid.shape[-1] * factor)).real


def sample_cartesian(grid: np.ndarray, entry: Entry, size=320, tiles=2.0, centre=(0.0, 0.0),
                     y_up=True, upsample=1) -> np.ndarray:
    """Interpolate a periodic ``(N,N)`` lattice field on a Cartesian pixel raster.

    ``tiles`` lattice lengths across the image, centred on Cartesian ``centre``.  The
    triangular lattice is sampled with the repository's own piecewise-linear triangle
    interpolation (rhombus cut along the short diagonal), so pictures match the site.
    ``upsample=2`` first doubles the mesh spectrally (what the site's renderer does before
    its bicubic fetch), which smooths the picture without changing the field.
    """
    grid = upsample_field(np.asarray(grid, float), upsample)
    n = grid.shape[-1]
    y, x = np.indices((size, size))
    X = ((x + .5) / size - .5) * tiles + centre[0]
    Y = ((y + .5) / size - .5) * tiles + centre[1]
    if y_up:
        Y = -Y
    uv = to_lattice(entry, np.stack([X, Y], axis=-1))
    xf = (uv[..., 0] * n) % n
    yf = (uv[..., 1] * n) % n
    ix = np.floor(xf).astype(int)
    iy = np.floor(yf).astype(int)
    fx, fy = xf - ix, yf - iy
    if entry.lattice == 'triangular':
        q00 = grid[iy, ix]
        q10 = grid[iy, (ix + 1) % n]
        q01 = grid[(iy + 1) % n, ix]
        q11 = grid[(iy + 1) % n, (ix + 1) % n]
        return np.where(fx >= fy, (1 - fx) * q00 + (fx - fy) * q10 + fy * q11,
                        (1 - fy) * q00 + (fy - fx) * q01 + fx * q11)
    return sum(grid[(iy + dy) % n, (ix + dx) % n] * (fx if dx else 1 - fx) * (fy if dy else 1 - fy)
               for dy in (0, 1) for dx in (0, 1))


def colorize(values: np.ndarray, palette='ember', lo=None, hi=None) -> np.ndarray:
    """Map scalars to RGB uint8 with one of the site's palettes.

    ``'ember'``, ``'ceramic'``, ``'concentration'`` are the site's exact stops; ``'mono'`` is
    a plain black-to-white ramp (``render(..., palette='mono')`` instead thresholds, which is
    what the standalone monochrome page does)."""
    values = np.asarray(values, float)
    stops = MONO_STOPS if palette == 'mono' else PALETTES[palette]
    lo = float(values.min()) if lo is None else float(lo)
    hi = float(values.max()) if hi is None else float(hi)
    t = np.clip((values - lo) / (hi - lo if hi > lo else 1.0), 0, 1)
    return np.stack([np.interp(t, stops[:, 0], stops[:, i]) for i in (1, 2, 3)], axis=-1).astype(np.uint8)


def render(frame_u: np.ndarray, entry: Entry, path=None, palette='ember', size=480, tiles=2.0,
           centre=(0.0, 0.0), value_range=None, threshold=0.0, upsample=1) -> np.ndarray:
    """Render one channel of one frame over ``tiles`` periodic cells; returns the RGB array.

    ``palette='ember'`` reproduces the site's look (its exact colour stops, and the
    published record's u range when ``value_range`` is left to the data; pass
    ``value_range=lab.G227_U_RANGE`` for the standalone page's fixed range).
    ``palette='mono'`` is the black/white style: white where the field exceeds
    ``threshold`` (pass ``w = u(t) - u(t + T/2)`` and the page's 0.426 cut for the
    monochrome viewer's picture).
    """
    values = sample_cartesian(frame_u, entry, size=size, tiles=tiles, centre=centre,
                              upsample=upsample)
    if palette == 'mono':
        rgb = np.where((values > threshold)[..., None], np.uint8(255), np.uint8(0)) * np.ones(3, np.uint8)
    else:
        lo, hi = (value_range if value_range else (None, None))
        rgb = colorize(values, palette, lo, hi)
    if path:
        from PIL import Image
        Image.fromarray(np.ascontiguousarray(rgb.astype(np.uint8))).save(path)
    return rgb.astype(np.uint8)


def render_phase(Ahat, entry: Entry, path=None, channel=0, size=480, tiles=2.0,
                 centre=(0.0, 0.0), vortices=None, marker=5, gamma=0.6, upsample=1) -> np.ndarray:
    """Phase picture of a complex field: hue = ``arg Ahat``, brightness = ``|Ahat|``.

    ``vortices=True`` marks the vortices found by :func:`find_vortices` (white for
    positive charge, black for negative); a list of vortex dicts is also accepted.
    """
    A = np.asarray(Ahat, complex)
    if A.ndim == 3:
        A = A[channel]
    import matplotlib.colors as mcolors
    # interpolate the complex field itself (interpolating the wrapped phase would tear)
    re = sample_cartesian(A.real, entry, size=size, tiles=tiles, centre=centre, upsample=upsample)
    im = sample_cartesian(A.imag, entry, size=size, tiles=tiles, centre=centre, upsample=upsample)
    ph = np.arctan2(im, re)
    mag = np.hypot(re, im)
    mag = (mag / (mag.max() or 1.0)) ** gamma
    hsv = np.stack([(ph / (2 * np.pi)) % 1.0, np.ones_like(mag), mag], axis=-1)
    rgb = (mcolors.hsv_to_rgb(hsv) * 255).astype(np.uint8)
    if vortices is not None and vortices is not False:
        found = find_vortices(A, entry) if vortices is True else vortices
        for vx in found:
            xy = np.asarray(vx['cartesian'], float)
            for du in range(-2, 3):
                for dv in range(-2, 3):
                    p = xy + du * entry.basis[0] + dv * entry.basis[1]
                    px = int(round(((p[0] - centre[0]) / tiles + .5) * size - .5))
                    py = int(round(((-(p[1]) - centre[1]) / tiles + .5) * size - .5))
                    if not (0 <= px < size and 0 <= py < size):
                        continue
                    colour = np.array([255, 255, 255] if vx['charge'] > 0 else [0, 0, 0], np.uint8)
                    y0, y1 = max(0, py - marker), min(size, py + marker + 1)
                    x0, x1 = max(0, px - marker), min(size, px + marker + 1)
                    yy, xx = np.ogrid[y0:y1, x0:x1]
                    ring = (abs(yy - py) + abs(xx - px)) <= marker
                    rgb[y0:y1, x0:x1][ring] = colour
    if path:
        from PIL import Image
        Image.fromarray(np.ascontiguousarray(rgb)).save(path)
    return rgb


def save_movie(frames: np.ndarray, path, entry: Entry, channel=0, palette='ember', size=360,
               tiles=2.0, fps=12, value_range=None, threshold=None, half_period_difference=False,
               upsample=1):
    """Write an MP4/GIF of a movie.  ``(M,2,N,N)`` or ``(M,N,N)``.

    ``half_period_difference=True`` renders ``w = u(t) - u(t + T/2)`` (the monochrome
    viewer's field); with ``palette='mono'`` and ``threshold`` this reproduces the site's
    black-and-white picture.
    """
    import imageio.v2 as imageio
    frames = np.asarray(frames, float)
    series = frames[:, channel] if frames.ndim == 4 else frames
    if half_period_difference:
        M = series.shape[0]
        series = series - np.roll(series, -(M // 2), axis=0)
    if value_range is None and palette != 'mono':
        value_range = (float(series.min()), float(series.max()))
    images = [render(s, entry, palette=palette, size=size, tiles=tiles, value_range=value_range,
                     threshold=(0.0 if threshold is None else threshold), upsample=upsample)
              for s in series]
    path = str(path)
    if path.endswith('.gif'):
        imageio.mimsave(path, images, duration=1.0 / fps, loop=0)
    else:
        imageio.mimsave(path, images, fps=fps, macro_block_size=None)
    return path


# ---------------------------------------------------------------- misc
def json_safe(obj):
    """Recursively convert numpy scalars/arrays so ``json.dump`` accepts the result."""
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_safe(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return json_safe(obj.tolist())
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.complexfloating, complex)):
        return dict(re=float(np.real(obj)), im=float(np.imag(obj)))
    if isinstance(obj, (bool, int, float, str)) or obj is None:
        return obj
    if isinstance(obj, Entry):
        return obj.id
    return str(obj)


def write_json(path, obj, indent=1):
    Path(path).write_text(json.dumps(json_safe(obj), indent=indent))
    return str(path)


if __name__ == '__main__':
    e = load_entry('g227')
    print(json.dumps(dict(entry=e.id, lattice=e.lattice, m=e.m, generator=e.generator,
                          kernel=e.kernel, records=[p.name for p in records_for('g227')]), indent=1))
