"""Sharper forcing statements: competing groups, coarsening, and the nu-map on
the substitution tiling.  Run: python3 force2.py"""
import json, time
from itertools import product
from chair import *

MARKS = marking_to_facet_marks(M24)
FRAMES = child_frames(M24)
OUT = {}


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


def rel(p1, p2):
    return pose_compose(inv(p1), p2)


BASE = Tile((IDENT, (0, 0, 0)), MARKS)
ATLAS = []
for L in PROPER_L:
    for t in product(range(-4, 5), repeat=3):
        tl = Tile((L, t), MARKS)
        if BASE.cells & tl.cells or not contacts(BASE, tl):
            continue
        if pair_legal(BASE, tl)[0]:
            ATLAS.append((L, t))
A44 = set(ATLAS)
NOTCH = (1, 1, 1)
CENTRAL = FRAMES['dent']
ROLE = {rel(FRAMES[a], CENTRAL): a for a in K}
FILLERS = sorted(ROLE)
assert len(FILLERS) == 7
assert set(FILLERS) <= A44


def supertile_pose(ypose):
    """The (scale-2) pose of the supertile whose central child is at ypose."""
    L, t = ypose
    w = lin(L, (1, 1, 1))
    return (L, (t[0] - w[0], t[1] - w[1], t[2] - w[2]))


def supertile_children(spose):
    return {k: pose_compose(spose, FRAMES[k]) for k in FRAMES}


def supertile_cells(spose):
    out = set()
    for p in supertile_children(spose).values():
        out |= set(pose_apply_cell(p, c) for c in K)
    return out


# ------------------------------------------------------------ 1. consistency
hdr('1. THE CANDIDATE PARENT IS A FUNCTION OF THE NOTCH FILLER ALONE')
print('For X at pose p with notch filler Y at pose q, the parent supertile is')
print('S = (L_q, t_q - L_q(1,1,1)) and X is its child in slot ROLE(p^-1 q).')
chk = True
for a in K:
    Y = pose_compose(FRAMES[a], FILLERS[FILLERS.index(rel(FRAMES[a], CENTRAL))])
    # equivalently CENTRAL
    S = supertile_pose(CENTRAL)
    if supertile_children(S)[a] != FRAMES[a]:
        chk = False
print('consistency X in slot a of S(nu(X)) for all 7 slots:', chk)
print('=> two chairs with the SAME notch filler always get the SAME parent.')
OUT['parent_is_function_of_filler'] = bool(chk)

# ------------------------------------------------------------ 2. competing groups
hdr('2. NO COMPETING GROUPS  (exhaustive over legal 4-chair configurations)')
t0 = time.time()
tested = 0
legal_cfg = 0
same_parent = 0
disjoint = 0
coarse_ok = 0
odd_offset = 0
bad = []
for Xp in [(IDENT, (0, 0, 0))] + ATLAS:
    if Xp == (IDENT, (0, 0, 0)):
        continue
    for fX in FILLERS:                       # notch filler of the root, in root frame
        Yp = fX
        for fZ in FILLERS:                   # notch filler of X', in X' frame
            Zp = pose_compose(Xp, fZ)
            tested += 1
            tiles = {'X': (IDENT, (0, 0, 0)), 'Y': Yp, 'Xp': Xp, 'Zp': Zp}
            ps = list(dict.fromkeys(tiles.values()))
            T = [Tile(p, MARKS) for p in ps]
            ok = True
            for i in range(len(T)):
                for j in range(i + 1, len(T)):
                    if not pair_legal(T[i], T[j])[0]:
                        ok = False
                        break
                if not ok:
                    break
            if not ok:
                continue
            legal_cfg += 1
            S1 = supertile_pose(Yp)
            S2 = supertile_pose(Zp)
            if S1 == S2:
                same_parent += 1
                continue
            c1, c2 = supertile_cells(S1), supertile_cells(S2)
            if c1 & c2:
                bad.append((Xp, fX, fZ, 'OVERLAP', len(c1 & c2)))
                continue
            disjoint += 1
            r = rel(S1, S2)
            # the two supertiles are scale-2 chairs: their relative translation must
            # be even, and halved it must be a legal contact of the SAME atlas
            if any(x % 2 for x in r[1]):
                odd_offset += 1
                bad.append((Xp, fX, fZ, 'ODD-OFFSET', r))
                continue
            rh = (r[0], tuple(x // 2 for x in r[1]))
            if rh in A44:
                coarse_ok += 1
            else:
                bad.append((Xp, fX, fZ, 'NOT-IN-A44', rh))
print('configurations tested (X, nu(X), X\', nu(X\')) : %d' % tested)
print('   of which legal 4-chair patches            : %d' % legal_cfg)
print('   with the SAME parent supertile            : %d' % same_parent)
print('   with different, cell-disjoint parents     : %d' % disjoint)
print('        ... whose halved relative pose is in A44 : %d' % coarse_ok)
print('   parents overlapping / odd offset / other  : %d' % len(bad))
if bad:
    from collections import Counter
    print('   failure kinds:', Counter(b[3] for b in bad))
    print('   e.g.', bad[:3])
print('   (%.1fs)' % (time.time() - t0))
OUT['competing_groups'] = {'tested': tested, 'legal': legal_cfg,
                           'same_parent': same_parent, 'disjoint_parents': disjoint,
                           'halved_rel_pose_in_A44': coarse_ok, 'failures': len(bad)}

# ------------------------------------------------------------ 3. nu on the tiling
hdr('3. THE NOTCH MAP nu ON THE LEVEL-4 SUBSTITUTION TILING')
poses = supertile_poses(FRAMES, 4)
tiles = [Tile(p, MARKS) for p in poses]
print('level-4 supertile: %d chairs' % len(tiles))
owner = {}
for i, tl in enumerate(tiles):
    for c in tl.cells:
        owner[c] = i
nu = {}
for i, tl in enumerate(tiles):
    notch = pose_apply_cell(tl.pose, NOTCH)
    j = owner.get(notch)
    nu[i] = j
undef = sum(1 for i in nu if nu[i] is None)
print('chairs whose notch cell lies outside the patch:', undef)
pre = {}
for i, j in nu.items():
    if j is not None:
        pre.setdefault(j, []).append(i)
from collections import Counter
cnt = Counter(len(v) for v in pre.values())
zero = len(tiles) - len(pre)
print('number of nu-preimages: 0 ->', zero, ', ', dict(sorted(cnt.items())))
# which chairs are the true central children of level-1 supertiles?
lvl1 = supertile_poses(FRAMES, 4)
# recompute the level-1 grouping directly from the recursive construction
groups = []


def build(level, outer):
    if level == 0:
        return [outer]
    k = 2 ** (level - 1)
    out = []
    for key, (L, t) in FRAMES.items():
        out += build(level - 1, pose_compose(outer, (L, scale(k, t))))
    return out


Q = [(IDENT, (0, 0, 0))]
for nlev in range(1, 4):
    k = 2 ** nlev
    Q = [pose_compose((L, scale(k, t)), q) for (L, t) in FRAMES.values() for q in Q]
lvl1_groups = [{kk: pose_compose(q, FRAMES[kk]) for kk in FRAMES} for q in Q]
pose2idx = {tl.pose: i for i, tl in enumerate(tiles)}
centres = set()
for g in lvl1_groups:
    centres.add(pose2idx[g['dent']])
print('true central children in the patch:', len(centres))
seven = set(j for j, v in pre.items() if len(v) == 7)
print('chairs with exactly 7 nu-preimages     :', len(seven))
print('  {7 preimages} == {central children}  :', seven == centres,
      ' (subset:', seven <= centres, ')')
# interior test: restrict to chairs all of whose 7 potential preimages are inside
print('  central children with <7 preimages (boundary effects):',
      len(centres - seven))
OUT['nu_map'] = {'chairs': len(tiles), 'preimage_hist': {str(k): v for k, v in sorted(cnt.items())},
                 'zero_preimages': zero, 'central_children': len(centres),
                 'exactly7': len(seven), 'seven_subset_of_central': bool(seven <= centres)}

# ------------------------------------------------------------ 4. coarse atlas
hdr('4. COARSENING: the supertile atlas halves onto A44')
# relative poses between adjacent level-1 supertiles inside the level-4 patch
sup_cells = []
for g in lvl1_groups:
    cs = set()
    for p in g.values():
        cs |= set(pose_apply_cell(p, c) for c in K)
    sup_cells.append(cs)
sup_pose = []
for g in lvl1_groups:
    sup_pose.append(supertile_pose(g['dent']))
relset = set()
for i in range(len(lvl1_groups)):
    for j in range(len(lvl1_groups)):
        if i == j:
            continue
        adj = any(add(c, d) in sup_cells[j] for c in sup_cells[i] for d in DIRS)
        if not adj:
            continue
        r = rel(sup_pose[i], sup_pose[j])
        relset.add(r)
print('level-1 supertiles in the patch:', len(lvl1_groups))
print('distinct relative poses between adjacent supertiles:', len(relset))
even = [r for r in relset if all(x % 2 == 0 for x in r[1])]
print('   all with even translation:', len(even) == len(relset))
half = set((r[0], tuple(x // 2 for x in r[1])) for r in even)
print('   halved poses, all in A44 :', half <= A44, ' (%d of them)' % len(half))
print('   A44 entries realised     : %d / 44' % len(half & A44))
OUT['coarse_atlas'] = {'supertiles': len(lvl1_groups), 'relative_poses': len(relset),
                       'all_even': bool(len(even) == len(relset)),
                       'halved_subset_of_A44': bool(half <= A44),
                       'realised': len(half & A44)}

json.dump(OUT, open('force2_out.json', 'w'), indent=1)
print()
print('wrote force2_out.json')
