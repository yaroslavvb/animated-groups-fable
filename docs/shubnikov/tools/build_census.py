#!/usr/bin/env python3
"""Build docs/shubnikov/data/census.json.

The census.  For each of the 68 forward film groups G (docs/scott-gray/
wallpaper-groups.json) and each n in {2, 3, 4, 6}, the onto homomorphisms
sigma: G -> Z_n are enumerated from the geometric model of G and split into
classes under the affine normaliser (time orientation kept, mirrors and
Galilean shears allowed) and colour relabelling by units of Z_n -- the
equivalence E_fwd of the week-38 census.  The classes are matched one for one,
in order, against docs/reports/symmetry-meeting-notes-week-38/verify/colour/
cx_d2.json: 307 + 89 + 241 + 353 = 990.

The pictures.  Each class gets a complex field

    Psi(x, t) = sum_p  b_p exp(2 pi i (p.x + nu_p t)),

a finite sum of travelling plane waves.  The wavevectors p lie on a ring
|p| ~ rho (the preferred wavelength of a Turing instability) in the twisted
lattice Z^2 + u/n, and the frequencies nu_p lie in nu_0 + {-1, 0, 1}, where
nu_0 = sigma(t)/n mod 1 -- clock-locked, so the film closes exactly after
m = n/gcd(sigma(t), n) periods.  The coefficients satisfy

    b_{M^T p, nu} = exp(2 pi i (p.v - sigma(g)/n + nu tau)) b_{p, nu}

for every coset representative g = (M, v, tau) of G, which is exactly the
statement Psi(g.z) = exp(2 pi i sigma(g)/n) Psi(z).  Colour = phase sector:
kappa(z) = floor(n arg Psi(z) / 2 pi), so kappa(g.z) = kappa(z) + sigma(g).

The audit.  Every orbit of modes gets its own modulus (all distinct) and a
phase k/P with P prime, so the full symmetry group of Psi -- every spacetime
isometry, with or without time reversal, acting by a constant phase on Psi or
on its complex conjugate -- is decided in exact rational arithmetic.  A class
is kept only when that group is exactly G with colour shifts exactly sigma.

Usage:
    python3 build_census.py            # rebuild data/census.json
    python3 build_census.py --check    # rebuild in memory, compare, exit 1 on drift
    python3 build_census.py --only g94 # (debug) restrict to some films
"""
import argparse
import hashlib
import itertools
import json
import math
import os
import random
import sys
import time
from fractions import Fraction as F
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.normpath(os.path.join(HERE, '..', '..'))
REPO = os.path.dirname(DOCS)
VERIFY = os.path.join(DOCS, 'reports', 'symmetry-meeting-notes-week-38', 'verify', 'colour')
sys.path.insert(0, VERIFY)
sys.path.insert(0, os.path.join(REPO, 'enumerate'))

import cx_geom as X          # noqa: E402
import cx_homgeom as HG      # noqa: E402
from exact import smith_normal_form   # noqa: E402

WALLPAPER = os.path.join(DOCS, 'scott-gray', 'wallpaper-groups.json')
CX_D2 = os.path.join(VERIFY, 'cx_d2.json')
LIFTS = os.path.join(DOCS, 'data', 'clockwork-lifts.json')
OUT = os.path.join(DOCS, 'shubnikov', 'data', 'census.json')

NS = (2, 3, 4, 6)
ORDER = ['p1', 'p2', 'pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg', 'cmm',
         'p4', 'p4m', 'p4g', 'p3', 'p3m1', 'p31m', 'p6', 'p6m']

# ---- field model -------------------------------------------------------------
MODEL = {
    'rho': 2.0,          # ring radius, in waves per parent-lattice edge
    'width': 0.5,        # half-width of the ring
    'sigma': 0.3,        # Gaussian fall-off of the amplitude away from the ring
    'offsets': [0, 1, -1],   # frequencies nu_0 + offset (cycles per film period)
    'offsetWeight': 0.6,     # amplitude of the two side frequencies
    'maxModes': 72,          # after orbit expansion
    'minModes': 12,
    'phaseDen': 7919,        # coefficient phases are k / 7919 turns (7919 is prime)
    'window': 2.5,           # parent-lattice edges across a card
}
GRAM = {'square': ((F(1), F(0)), (F(0), F(1))),
        'triangular': ((F(1), F(-1, 2)), (F(-1, 2), F(1)))}


def ginv(lattice):
    (a, b), (c, d) = GRAM[lattice]
    det = a * d - b * c
    return ((d / det, -b / det), (-c / det, a / det))


def norm2(p, gi):
    return p[0] * (gi[0][0] * p[0] + gi[0][1] * p[1]) + p[1] * (gi[1][0] * p[0] + gi[1][1] * p[1])


def holohedry(lattice):
    g = GRAM[lattice]
    out = []
    for a, b, c, d in itertools.product((-1, 0, 1), repeat=4):
        if a * d - b * c not in (1, -1):
            continue
        M = ((a, b), (c, d))
        # M^T g M == g
        MtgM = [[sum(M[k][i] * g[k][l] * M[l][j] for k in range(2) for l in range(2))
                 for j in range(2)] for i in range(2)]
        if all(MtgM[i][j] == g[i][j] for i in range(2) for j in range(2)):
            out.append(M)
    return out


def frac_str(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else '%d/%d' % (x.numerator, x.denominator)


def gcd(a, b):
    while b:
        a, b = b, a % b
    return abs(a)


def lcm(a, b):
    return a * b // gcd(a, b) if a and b else max(a, b)


# ---- census ------------------------------------------------------------------
def census_film(gid):
    """Classes of onto sigma: G -> Z_n for one film, in cx_d2.json order."""
    ent = X.entries()[gid]
    G0 = X.Group(ent, with_time=True, use_fix=False)   # the census' generator reading
    G1 = X.Group(ent, with_time=True, use_fix=True)    # corrected named generators
    assert G0.ops == G1.ops
    Nf = X.normaliser(G0, D=12, box=2, allow_mirror=True, allow_time_flip=False, ellbox=2)
    pres = X.action_set(G0, Nf)
    out = {}
    for n in NS:
        ons = [p for p in HG.homs(G0, n) if HG.onto(G0, p, n)]
        a = [p for p in ons if p[2] % n == 0]
        b = [p for p in ons if p[2] % n]
        res = []
        for key, orbs in (('ct0', X.orbits(G0, a, n, None, pres=pres)),
                          ('ctne', X.orbits(G0, b, n, None, pres=pres))):
            for orb in orbs:
                phi = orb[0]
                res.append({
                    'key': key, 'size': len(orb), 'ct': phi[2] % n, 'phi': phi,
                    'colCensus': {g: G0.ev(phi, G0.gens[g]) % n for g in G0.gen_order},
                    'col': {g: G1.ev(phi, G1.gens[g]) % n for g in G1.gen_order},
                })
        out[n] = res
    return gid, len(pres), out


# ---- the field ---------------------------------------------------------------
def nu0_of(ct, n):
    if ct % n == 0:
        return F(0)
    f = F(ct % n, n)
    return f if f <= F(1, 2) else f - 1


def expand(G, n, phi, p, nu):
    """Orbit of the mode (p, nu) under the coset reps, with exact phase offsets.

    Returns {p': theta} with b_{p'} = exp(2 pi i theta) b_p, or None if the
    stabiliser forces the coefficient to vanish."""
    c = phi[3]
    orb = {}
    for i, (M, v, tau) in enumerate(G.ops):
        chi = F(c[i], n) - nu * tau
        pp = (M[0][0] * p[0] + M[1][0] * p[1], M[0][1] * p[0] + M[1][1] * p[1])
        th = (p[0] * v[0] + p[1] * v[1] - chi) % 1
        if pp in orb:
            if orb[pp] != th:
                return None
        else:
            orb[pp] = th
    return orb


def candidate_orbits(G, ent, n, phi, rho, width):
    u0, u1, ct = phi[0], phi[1], phi[2]
    gi = ginv(ent['lattice'])
    nu0 = nu0_of(ct, n)
    R = int(math.ceil(rho + width)) + 2
    seen = set()
    orbits = []
    for q0 in range(-R, R + 1):
        for q1 in range(-R, R + 1):
            p = (F(q0) + F(u0, n), F(q1) + F(u1, n))
            r = math.sqrt(float(norm2(p, gi)))
            if abs(r - rho) > width:
                continue
            for off in MODEL['offsets']:
                nu = nu0 + off
                if (p, nu) in seen:
                    continue
                orb = expand(G, n, phi, p, nu)
                if orb is None:
                    seen.add((p, nu))
                    continue
                for pp in orb:
                    seen.add((pp, nu))
                rep = min(orb)
                # re-base the phases on the canonical representative
                base = orb[rep]
                orbits.append({'rep': rep, 'nu': nu, 'off': off, 'r': r,
                               'modes': {pp: (th - base) % 1 for pp, th in orb.items()}})
    return orbits


def choose_modes(orbits, rng, rho, sigma):
    """Weights, distinct moduli, exact phases; greedy cap on expanded modes."""
    for o in orbits:
        w = math.exp(-((o['r'] - rho) / sigma) ** 2)
        if o['off'] != 0:
            w *= MODEL['offsetWeight']
        o['w'] = w * rng.uniform(0.6, 1.4)
    orbits = sorted(orbits, key=lambda o: -o['w'])
    kept, total = [], 0
    for o in orbits:
        if total + len(o['modes']) > MODEL['maxModes']:
            continue
        kept.append(o)
        total += len(o['modes'])
    top = kept[0]['w'] if kept else 1
    used = set()
    for o in kept:
        # 4 significant digits, relative to the strongest orbit; all distinct
        m = F(round(o['w'] / top * 10000), 10000)
        while m in used or m <= 0:
            m += F(1, 10000)
        used.add(m)
        o['mod'] = m
        o['k'] = rng.randrange(MODEL['phaseDen'])
    return kept


def smith_prep(rows):
    """Smith form of the (integer-scaled) row matrix, reused for every right-hand side."""
    D = 1
    for r in rows:
        for x in r:
            D = lcm(D, F(x).denominator)
    A = [[int(x * D) for x in r] for r in rows]
    S, U, V = smith_normal_form(A)
    m = 4
    d = [S[i][i] if i < min(len(S), m) else 0 for i in range(m)]
    rank = sum(1 for x in d if x != 0)
    covol = None
    if rank == m:
        covol = F(D ** m)
        for x in d:
            covol /= x
    return {'D': D, 'd': d, 'U': U, 'V': V, 'rank': rank, 'covol': covol, 'rows': len(rows)}


def smith_rhs(prep, rhs):
    """A particular real solution w of rows . w == rhs (mod 1), or None."""
    U, V, d, D, m = prep['U'], prep['V'], prep['d'], prep['D'], 4
    Uc = [sum(U[i][k] * rhs[k] for k in range(prep['rows'])) for i in range(prep['rows'])]
    if not all((Uc[i] % 1) == 0 for i in range(prep['rank'], prep['rows'])):
        return None
    y = [F(Uc[i]) / d[i] for i in range(m)]
    return [F(D) * sum(V[i][k] * y[k] for k in range(m)) for i in range(m)]


def audit(G, ent, n, phi, kept):
    """Exact full symmetry group check.  Returns dict with 'ok' and details."""
    support = {}
    for oi, o in enumerate(kept):
        for pp, th in o['modes'].items():
            support[(pp, o['nu'])] = (oi, th)
    keys = list(support)
    rows = [(p[0], p[1], nu, F(-1)) for (p, nu) in keys]
    # 1. the period lattice: rank 4 and covolume 1/h (h = centring ops)
    prep = smith_prep(rows)
    rank, covol = prep['rank'], prep['covol']
    h = sum(1 for (M, v, tau) in G.ops if M == X.I2)
    if rank < 4:
        return {'ok': False, 'why': 'continuous symmetry (rank %d)' % rank}
    if covol != F(1, h):
        return {'ok': False, 'why': 'extra translations (covolume %s, expected 1/%d)' % (covol, h)}
    pg = {M for (M, v, tau) in G.ops}
    found = []
    for M in holohedry(ent['lattice']):
        for s in (1, -1):
            for conj in (False, True):
                rhs = []
                good = True
                for (p, nu) in keys:
                    oi, th = support[(p, nu)]
                    tp = (M[0][0] * p[0] + M[1][0] * p[1], M[0][1] * p[0] + M[1][1] * p[1])
                    tnu = s * nu
                    if conj:
                        tp, tnu = (-tp[0], -tp[1]), -tnu
                    t = support.get((tp, tnu))
                    if t is None or t[0] != oi:
                        good = False
                        break
                    if conj:
                        rhs.append((-t[1] - th - F(2 * kept[oi]['k'], MODEL['phaseDen'])) % 1)
                    else:
                        rhs.append((t[1] - th) % 1)
                if not good:
                    continue
                w = smith_rhs(prep, rhs)
                if w is None:
                    continue
                beta = w[3]
                if (beta * n).denominator != 1:
                    continue     # a phase symmetry, but not a colour permutation
                found.append((M, s, conj, w))
    expected = {(M, 1, False) for M in pg}
    got = {(M, s, conj) for (M, s, conj, w) in found}
    if got != expected:
        extra = sorted(got - expected)
        miss = sorted(expected - got)
        return {'ok': False, 'why': 'symmetry mismatch extra=%s missing=%s' % (extra, miss)}
    return {'ok': True, 'modes': len(keys), 'orbits': len(kept),
            'pointGroup': len(pg), 'centring': h}


def field_for(gid, n, idx, phi):
    ent = X.entries()[gid]
    G = X.Group(ent, with_time=True, use_fix=True)
    mesh = ent['meshMultiple']
    seed = int(hashlib.sha256(('%s:%d:%d' % (gid, n, idx)).encode()).hexdigest()[:12], 16)
    tries = []
    for attempt in range(24):
        rho = MODEL['rho'] * math.sqrt(mesh)
        # widen the ring every third attempt: a single shell of the twisted
        # lattice can carry an extra symmetry that the next shell breaks
        width = MODEL['width'] + 0.25 * (attempt // 3)
        rng = random.Random(seed + attempt)
        orbits = candidate_orbits(G, ent, n, phi, rho, width)
        kept = choose_modes(orbits, rng, rho, MODEL['sigma'] * width / MODEL['width'])
        nm = sum(len(o['modes']) for o in kept)
        offs = {o['off'] for o in kept}
        if nm < MODEL['minModes'] or len(offs) < 2:
            tries.append('attempt %d: %d modes, offsets %s' % (attempt, nm, sorted(offs)))
            continue
        a = audit(G, ent, n, phi, kept)
        if a['ok']:
            a['attempt'] = attempt
            a['rho'] = round(rho, 6)
            a['width'] = round(width, 6)
            a['sigma'] = round(MODEL['sigma'] * width / MODEL['width'], 6)
            reps = []
            for o in kept:
                p = o['rep']
                q0 = p[0] - F(phi[0], n)
                q1 = p[1] - F(phi[1], n)
                assert q0.denominator == 1 and q1.denominator == 1
                reps.append([int(q0), int(q1), o['off'], frac_str(o['mod']), o['k']])
            return {'modes': reps, 'audit': a}
        tries.append('attempt %d: %s' % (attempt, a['why']))
    raise RuntimeError('%s n=%d #%d: no faithful field: %s' % (gid, n, idx, '; '.join(tries[-6:])))


def field_job(args):
    gid, n, idx, phi = args
    return (gid, n, idx), field_for(gid, n, idx, phi)


# ---- assembly ----------------------------------------------------------------
def sha256(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def build(only=None, jobs=None):
    t0 = time.time()
    ents = X.entries()
    d2 = json.load(open(CX_D2))
    rows = {r['id']: r for r in d2['rows']}
    film_ids = [r['id'] for r in d2['rows']]
    if only:
        film_ids = [g for g in film_ids if g in only]
    with Pool(jobs) as pool:
        census = dict((gid, (norm, per)) for gid, norm, per in
                      pool.imap_unordered(census_film, film_ids))
    print('census %.1fs' % (time.time() - t0), file=sys.stderr)

    # match against cx_d2.json, in order
    classes = []
    for gid in film_ids:
        norm, per = census[gid]
        row = rows[gid]
        assert norm == row['norm'], (gid, norm, row['norm'])
        for n in NS:
            cell = row['n'][str(n)]
            want = [(k, r) for k in ('ct0', 'ctne') for r in cell['reps'][k]]
            got = per[n]
            assert len(want) == len(got), (gid, n)
            for idx, ((k, r), c) in enumerate(zip(want, got)):
                assert k == c['key'] and r['size'] == c['size'] and r['ct'] == c['ct'] \
                    and r['col'] == c['colCensus'], (gid, n, idx, r, c)
                classes.append((gid, n, idx, c))
    totals = {n: sum(1 for c in classes if c[1] == n) for n in NS}
    print('matched', len(classes), totals, file=sys.stderr)

    jobs_in = [(gid, n, idx, c['phi']) for (gid, n, idx, c) in classes]
    with Pool(jobs) as pool:
        fields = dict(pool.imap_unordered(field_job, jobs_in, chunksize=4))
    print('fields %.1fs' % (time.time() - t0), file=sys.stderr)

    lifts = json.load(open(LIFTS))['groups']
    films = {}
    for gid in film_ids:
        ent = ents[gid]
        G = X.Group(ent, with_time=True, use_fix=True)
        row = rows[gid]
        films[gid] = {
            'family': ent['family'], 'orbifold': ent['orbifold'], 'signature': ent['signature'],
            'N': ent['phaseOrder'], 'mesh': ent['meshMultiple'], 'lattice': ent['lattice'],
            'basis': ent['basis'], 'sg': lifts[gid]['sg'], 'sgName': lifts[gid]['sgName'],
            'norm': row['norm'], 'normP3': row['norm_proper3'],
            'ops': [[[list(r) for r in M], [frac_str(v[0]), frac_str(v[1])], frac_str(tau)]
                    for (M, v, tau) in G.ops],
            'gens': [{'name': g['name'], 'kind': g['kind'], 'timeShift': g['timeShift'],
                      'M': g['M'], 'v': [frac_str(X.frac(x)) for x in G.gens[g['name']][1]]}
                     for g in ent['namedGenerators']],
            'counts': {str(n): len(census[gid][1][n]) for n in NS},
            'countsP3': {str(n): row['n'][str(n)]['cls_ct0_p3'] + row['n'][str(n)]['cls_ctne_p3']
                         for n in NS},
        }
    out_classes = []
    for (gid, n, idx, c) in classes:
        phi = c['phi']
        ct = c['ct']
        m = n // gcd(ct, n) if ct else 1
        u = [phi[0] % n, phi[1] % n]
        f = fields[(gid, n, idx)]
        out_classes.append({
            'id': '%s-n%d-%d' % (gid, n, idx + 1),
            'gid': gid, 'n': n, 'key': c['key'], 'size': c['size'], 'ct': ct,
            'm': m, 'd': n // m, 'u': u, 'c': list(phi[3]), 'col': c['col'],
            'nu0': frac_str(nu0_of(ct, n)),
            'modes': f['modes'], 'audit': f['audit'],
        })
    fams = {}
    for fam in ORDER:
        fg = [g for g in film_ids if ents[g]['family'] == fam]
        if not fg:
            continue
        cl = [c for c in out_classes if films[c['gid']]['family'] == fam]
        fams[fam] = {'orbifold': ents[fg[0]]['orbifold'], 'lattice': ents[fg[0]]['lattice'],
                     'films': fg, 'total': len(cl),
                     'byN': {str(n): sum(1 for c in cl if c['n'] == n) for n in NS},
                     'ct0': sum(1 for c in cl if c['ct'] == 0)}
    doc = {
        'schema': 'shubnikov-census-v1',
        'equivalence': 'E_fwd',
        'sources': {
            'cx_d2': {'path': os.path.relpath(CX_D2, DOCS), 'sha256': sha256(CX_D2)},
            'wallpaperGroups': {'path': os.path.relpath(WALLPAPER, DOCS), 'sha256': sha256(WALLPAPER)},
        },
        'model': MODEL,
        'order': [f for f in ORDER if f in fams],
        'totals': {'all': len(out_classes),
                   'byN': {str(n): totals[n] for n in NS},
                   'ct0': sum(1 for c in out_classes if c['ct'] == 0),
                   'byM': {str(k): sum(1 for c in out_classes if c['m'] == k) for k in (1, 2, 3, 4, 6)},
                   'rigid': sum(1 for c in out_classes if c['size'] == 1),
                   'byNP3': {str(n): sum(films[g]['countsP3'][str(n)] for g in films) for n in NS}},
        'families': fams,
        'films': films,
        'classes': out_classes,
    }
    print('done %.1fs' % (time.time() - t0), file=sys.stderr)
    return doc


def dump(doc):
    # compact, one class per line
    head = dict(doc)
    classes = head.pop('classes')
    s = json.dumps(head, ensure_ascii=False, separators=(',', ':'))
    lines = [json.dumps(c, ensure_ascii=False, separators=(',', ':')) for c in classes]
    return s[:-1] + ',"classes":[\n' + ',\n'.join(lines) + '\n]}\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--jobs', type=int, default=None)
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    doc = build(only=set(a.only) if a.only else None, jobs=a.jobs)
    text = dump(doc)
    if a.check:
        old = open(a.out, encoding='utf-8').read() if os.path.exists(a.out) else ''
        if old != text:
            print('census.json is stale', file=sys.stderr)
            sys.exit(1)
        print('census.json up to date (%d classes)' % len(doc['classes']))
        return
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    open(a.out, 'w', encoding='utf-8').write(text)
    print('wrote %s (%d classes, %d bytes)' % (a.out, len(doc['classes']), len(text.encode())))


if __name__ == '__main__':
    main()
