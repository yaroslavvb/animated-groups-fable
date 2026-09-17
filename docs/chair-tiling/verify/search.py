"""
Exhaustive search over the whole space of 3-symbol corner markings of the chair.

A marking assigns to each of the 8 sites a bijection {x,y,z} -> {F,H,B}: 6^8 =
1 679 616 markings.  We ask which of them satisfy the properties CGS stated:

  (c) the pure translation by (1,1,1) is legal   ("shift the tile forward")
  (b) the level-1 supertile, read at double scale, reproduces the marking
  (a) every interior contact of the level-1 (and level-2) supertile matches

and then how many of the survivors are equivalent to M24 under the obvious
symmetries (relabel F<->H, and conjugate by the 6 coordinate permutations that
preserve the bare chair).

Run: python3 search.py
"""
import json, time
from itertools import permutations, product
from chair import *

PERMS = list(permutations(TYPES))          # 6 stars
SITEKEYS = list(K) + ['dent']


def stars_from(assign):
    return {SITEKEYS[i]: assign[i] for i in range(8)}


def check(stars, levels=(1,)):
    marks = marking_to_facet_marks(stars)
    # (c) translation legality
    base = Tile((IDENT, (0, 0, 0)), marks)
    sh = Tile((IDENT, (1, 1, 1)), marks)
    ok, n = pair_legal(base, sh)
    if not ok or n != 3:
        return None
    fr = child_frames(stars, allow_improper=True)
    if fr is None:
        return None
    for level in levels:
        poses = supertile_poses(fr, level)
        tiles = [Tile(p, marks) for p in poses]
        allcells = {}
        for i, tl in enumerate(tiles):
            for c in tl.cells:
                if c in allcells:
                    return None
                allcells[c] = i
        for c, i in allcells.items():
            for d in DIRS:
                c2 = add(c, d)
                j = allcells.get(c2)
                if j is None or j == i:
                    continue
                m1 = tiles[i].marks.get((c, d))
                m2 = tiles[j].marks.get((c2, (-d[0], -d[1], -d[2])))
                if m1 is None or m2 is None or m1[1] != m2[1] or COMP[m1[0]] != m2[0]:
                    return None
        # (b) coarse read
        s = 2 ** level
        got = {}
        for f in FACETS:
            c, d = f
            v = site(f)
            V = scale(s, v)
            fc = []
            for i in range(3):
                lo = s * c[i]
                fc.append(lo if V[i] == lo else lo + s - 1)
            fc = tuple(fc)
            i = allcells[fc]
            got[f] = (tiles[i].marks[(fc, d)][0], v)
        if got != marks:
            return None
    return fr


t0 = time.time()
sols = []
tested = 0
for assign in product(PERMS, repeat=8):
    tested += 1
    stars = stars_from(assign)
    fr = check(stars)
    if fr is not None:
        sols.append((assign, fr))
print('tested %d markings, %d satisfy (a)+(b)+(c) at level 1   (%.1fs)'
      % (tested, len(sols), time.time() - t0))

# level-2 re-check of the survivors
sols2 = [(a, f) for (a, f) in sols if check(stars_from(a), levels=(1, 2)) is not None]
print('of those, %d also satisfy (a)+(b) at level 2' % len(sols2))

# how many have all-proper child frames?
prop = [(a, f) for (a, f) in sols2 if all(det(f[k][0]) == 1 for k in f)]
print('of those, %d have all eight child frames orientation-preserving' % len(prop))

# equivalence classes under: relabel F<->H ; relabel by any permutation of the 3
# symbols ; conjugation by the 6 symmetries of the bare chair
SHAPE_SYMS = []
for L in ALL_L:
    for t in product(range(-3, 4), repeat=3):
        if frozenset(pose_apply_cell((L, t), c) for c in K) == frozenset(K):
            SHAPE_SYMS.append((L, t))


def conj(stars, pose):
    """Push the marking forward by a symmetry of the bare chair."""
    marks = marking_to_facet_marks(stars)
    out = {}
    L, t = pose
    for (c, d), (ty, v) in marks.items():
        c2 = pose_apply_cell(pose, c)
        d2 = lin(L, d)
        out[(c2, d2)] = ty
    # rebuild stars
    ns = {}
    for f in FACETS:
        v = site(f)
        key = SITE_KEY[v]
        ns.setdefault(key, [None, None, None])
        ns[key][facet_axis(f)] = out[f]
    return {k: tuple(v) for k, v in ns.items()}


def relabel(stars, sigma):
    return {k: tuple(sigma[t] for t in v) for k, v in stars.items()}


SIGMAS = [dict(zip(TYPES, p)) for p in permutations(TYPES)]
canon = {}
for a, f in sols2:
    st = stars_from(a)
    orb = set()
    for pose in SHAPE_SYMS:
        cs = conj(st, pose)
        for sg in SIGMAS:
            orb.add(tuple(sorted((str(k), relabel(cs, sg)[k]) for k in cs)))
    key = min(orb)
    canon.setdefault(key, []).append(a)
print('equivalence classes of solutions under (6 chair symmetries) x (6 symbol '
      'relabellings): %d' % len(canon))
print('class sizes:', sorted(len(v) for v in canon.values()))

m24_assign = tuple(M24[k] for k in SITEKEYS)
found = any(m24_assign == a for a, f in sols2)
print('M24 is among the solutions:', found)
# which class is M24 in?
st = M24
orb = set()
for pose in SHAPE_SYMS:
    cs = conj(st, pose)
    for sg in SIGMAS:
        orb.add(tuple(sorted((str(k), relabel(cs, sg)[k]) for k in cs)))
k24 = min(orb)
print('M24 class size (number of markings in its class):', len(canon.get(k24, [])))
print('all solutions are in M24\'s class:', len(canon) == 1)

json.dump({'tested': tested, 'level1_solutions': len(sols),
           'level2_solutions': len(sols2), 'all_proper': len(prop),
           'equivalence_classes': len(canon),
           'class_sizes': sorted(len(v) for v in canon.values()),
           'M24_found': bool(found)},
          open('search_out.json', 'w'), indent=1)
print('wrote search_out.json')
