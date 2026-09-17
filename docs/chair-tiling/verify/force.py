"""Forcing search for the marked 3-D chair.  Run: python3 force.py [--allow-reflections]"""
import sys, json, time
from itertools import product
from chair import *

ALLOW_REFL = '--allow-reflections' in sys.argv
LSET = ALL_L if ALLOW_REFL else PROPER_L
MARKS = marking_to_facet_marks(M24)
OUT = {'allow_reflections': ALLOW_REFL}


def hdr(s):
    print()
    print('=' * 78)
    print(s)
    print('=' * 78)


def inv(pose):
    L, t = pose
    p, s = L
    pinv = [0, 0, 0]
    for a in range(3):
        pinv[p[a]] = a
    sinv = tuple(s[pinv[a]] for a in range(3))
    Linv = (tuple(pinv), sinv)
    return (Linv, lin(Linv, (-t[0], -t[1], -t[2])))


BASE = Tile((IDENT, (0, 0, 0)), MARKS)

# ---------------------------------------------------------------- shell
SHELL = sorted({add(c, d) for c in K for d in DIRS} - set(K))
hdr('1. FIRST SHELL OF A CHAIR')
print('shell cells (face-adjacent, outside):', len(SHELL))
print(SHELL)
OUT['shell_cells'] = len(SHELL)

# ---------------------------------------------------------------- atlas
t0 = time.time()
ATLAS = []
for L in LSET:
    for t in product(range(-4, 5), repeat=3):
        tl = Tile((L, t), MARKS)
        if BASE.cells & tl.cells:
            continue
        if not contacts(BASE, tl):
            continue
        ok, n = pair_legal(BASE, tl)
        if ok:
            ATLAS.append(tl)
print('atlas size (%s frames): %d   (%.1fs)'
      % ('48' if ALLOW_REFL else '24 proper', len(ATLAS), time.time() - t0))
OUT['atlas_size'] = len(ATLAS)

# pairwise legality among atlas members
n = len(ATLAS)
COMPAT = [[False] * n for _ in range(n)]
for i in range(n):
    for j in range(i + 1, n):
        ok, _ = pair_legal(ATLAS[i], ATLAS[j])
        COMPAT[i][j] = COMPAT[j][i] = ok
COVERS = [frozenset(tl.cells) & frozenset(SHELL) for tl in ATLAS]
CELLCAND = {c: [i for i in range(n) if c in COVERS[i]] for c in SHELL}
print('candidates per shell cell: min %d max %d'
      % (min(len(v) for v in CELLCAND.values()), max(len(v) for v in CELLCAND.values())))

# ---------------------------------------------------------------- first shells
hdr('2. COMPLETE FIRST SHELLS (exhaustive)')
shells = []
t0 = time.time()


def search(chosen, covered):
    rem = [c for c in SHELL if c not in covered]
    if not rem:
        shells.append(tuple(sorted(chosen)))
        return
    # pick the cell with fewest legal candidates
    best, bestc = None, None
    for c in rem:
        cand = [i for i in CELLCAND[c]
                if all(COMPAT[i][j] for j in chosen)
                and not (ATLAS[i].cells & covered_cells(chosen))]
        if best is None or len(cand) < len(best):
            best, bestc = cand, c
            if not cand:
                break
    if not best:
        return
    for i in best:
        search(chosen + [i], covered | COVERS[i])


_cc_cache = {}


def covered_cells(chosen):
    key = tuple(chosen)
    v = _cc_cache.get(key)
    if v is None:
        v = set()
        for i in chosen:
            v |= ATLAS[i].cells
        _cc_cache[key] = v
    return v


search([], set())
print('complete legal first shells: %d   (%.1fs)' % (len(shells), time.time() - t0))
print('chairs per shell:', sorted(set(len(s) for s in shells)))
OUT['first_shells'] = len(shells)
OUT['chairs_per_shell'] = sorted(set(len(s) for s in shells))

# ---------------------------------------------------------------- notch filler
hdr('3. THE NOTCH FILLER')
NOTCH = (1, 1, 1)
fillers = [i for i in range(n) if NOTCH in ATLAS[i].cells]
print('atlas poses covering the notch cell:', len(fillers))
frames = child_frames(M24)
# the 7 relative poses (child_a)^{-1} o central, i.e. how the central child looks
# from the corner child a
CENTRAL = frames['dent']
role_of = {}
for a in K:
    rel = pose_compose(inv(frames[a]), CENTRAL)
    role_of[rel] = a
print('predicted notch fillers from the substitution (one per child slot):', len(role_of))
for i in fillers:
    p = ATLAS[i].pose
    print('   %-46s  role a=%s' % (str(p), role_of.get(p, '??')))
ok_roles = set(ATLAS[i].pose for i in fillers) == set(role_of)
print('atlas notch fillers == substitution notch fillers:', ok_roles)
OUT['notch_fillers'] = len(fillers)
OUT['notch_fillers_are_exactly_the_substitution_ones'] = bool(ok_roles)

# distribution over complete shells
dist = {}
for s in shells:
    f = [i for i in s if NOTCH in ATLAS[i].cells]
    assert len(f) == 1
    dist[role_of[ATLAS[f[0]].pose]] = dist.get(role_of[ATLAS[f[0]].pose], 0) + 1
print('over the %d complete first shells, the notch filler slot is:' % len(shells))
for k in sorted(dist, key=str):
    print('   a=%s : %d shells' % (str(k), dist[k]))
OUT['notch_slot_distribution'] = {str(k): v for k, v in dist.items()}

# ---------------------------------------------------------------- supertile forcing
hdr('4. DOES THE FIRST SHELL FORCE THE 8-CHAIR SUPERTILE?')
# for a chair X whose notch filler is Y with role a, the supertile is the unique
# level-1 supertile in which X sits in slot a.  Its 8 chairs, expressed in X's frame:
SUPER = {}
for a in K:
    Ainv = inv(frames[a])
    SUPER[a] = {k: pose_compose(Ainv, frames[k]) for k in frames}

stats = {'all8': 0, 'partial': {}}
missing_hist = {}
for s in shells:
    poses = set(ATLAS[i].pose for i in s) | {(IDENT, (0, 0, 0))}
    f = [i for i in s if NOTCH in ATLAS[i].cells][0]
    a = role_of[ATLAS[f].pose]
    want = set(SUPER[a].values())
    miss = want - poses
    missing_hist[len(miss)] = missing_hist.get(len(miss), 0) + 1
    if not miss:
        stats['all8'] += 1
print('first shells in which all 8 chairs of the forced supertile are present:',
      stats['all8'], '/', len(shells))
print('histogram of how many of the 8 are missing:', dict(sorted(missing_hist.items())))
# which of the 8 are ever missing?
never = {}
for s in shells:
    poses = set(ATLAS[i].pose for i in s) | {(IDENT, (0, 0, 0))}
    f = [i for i in s if NOTCH in ATLAS[i].cells][0]
    a = role_of[ATLAS[f].pose]
    for k, p in SUPER[a].items():
        if p not in poses:
            never[str(k)] = never.get(str(k), 0) + 1
print('slots sometimes absent from the first shell:', never)
OUT['first_shell_forces_supertile'] = {'all8': stats['all8'], 'total': len(shells),
                                       'missing_hist': {str(k): v for k, v in missing_hist.items()}}

# a weaker, always-true statement: are the present chairs always a SUBSET of the
# supertile's chairs plus chairs of neighbouring supertiles?
hdr('5. SUPERTILE COMPATIBILITY OF EVERY LEGAL PAIR')
# For every legal neighbour Z of X, is Z a chair of some level-1 supertile that is
# compatible with the supertile forced through X?  Test the sharper statement:
# can two DIFFERENT chairs both be "centres" in one legal patch?
# X is a centre  <=>  the 7 chairs of ~ SUPER-with-X-central are present.
central_patch = {k: pose_compose(inv(CENTRAL), frames[k]) for k in frames}
print('the 8 chairs of the supertile, seen from its CENTRAL child:')
for k in list(K) + ['dent']:
    print('   %-12s %s' % (str(k), central_patch[k]))

# if X is a corner child (slot a) of a supertile, could X simultaneously be the
# central child of another supertile?  Check overlap/legality.
conflict = {}
for a in K:
    Sa = SUPER[a]                       # the 8 chairs of X's supertile, in X's frame
    tilesS = {k: Tile(p, MARKS) for k, p in Sa.items()}
    # the hypothetical supertile with X central:
    tilesC = {k: Tile(p, MARKS) for k, p in central_patch.items()}
    bad = 0
    ov = 0
    for k1, t1 in tilesC.items():
        if t1.pose == (IDENT, (0, 0, 0)):
            continue
        for k2, t2 in tilesS.items():
            if t2.pose == (IDENT, (0, 0, 0)) or t1.pose == t2.pose:
                continue
            if t1.cells & t2.cells:
                ov += 1
            else:
                ok, _ = pair_legal(t1, t2)
                if not ok:
                    bad += 1
    conflict[str(a)] = {'cell_overlaps': ov, 'mark_conflicts': bad}
    print('slot a=%-12s  X-as-centre vs X-as-corner-child: %d cell overlaps, %d mark conflicts'
          % (str(a), ov, bad))
OUT['centre_vs_corner_conflict'] = conflict

json.dump(OUT, open('force_out%s.json' % ('_refl' if ALLOW_REFL else ''), 'w'), indent=1)
print()
print('wrote force_out.json')
