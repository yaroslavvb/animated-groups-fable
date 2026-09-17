"""
The grouping theorem: exhaustive analysis of the 33 complete first shells.

For a chair X in a legal registered tiling write
    nu(X)  = the chair covering X's notch cell         (always exists, 7 choices)
    pre(X) = { Z : nu(Z) = X }                         (the chairs X plugs)
Both are read off X's first shell.  We enumerate every complete legal first shell
and tabulate (|pre|, slot of nu).  Run: python3 force3.py
"""
import json, time
from itertools import product
from collections import Counter
from chair import *

MARKS = marking_to_facet_marks(M24)
FRAMES = child_frames(M24)
NOTCH = (1, 1, 1)
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
    return ((tuple(pinv), tuple(s[pinv[a]] for a in range(3))),
            lin((tuple(pinv), tuple(s[pinv[a]] for a in range(3))),
                (-t[0], -t[1], -t[2])))


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
            ATLAS.append(tl)
A44 = [t.pose for t in ATLAS]
n = len(ATLAS)
CENTRAL = FRAMES['dent']
ROLE = {rel(FRAMES[a], CENTRAL): a for a in K}

SHELL = sorted({add(c, d) for c in K for d in DIRS} - set(K))
COMPAT = [[False] * n for _ in range(n)]
for i in range(n):
    for j in range(i + 1, n):
        COMPAT[i][j] = COMPAT[j][i] = pair_legal(ATLAS[i], ATLAS[j])[0]
COVERS = [frozenset(t.cells) & frozenset(SHELL) for t in ATLAS]
CELLCAND = {c: [i for i in range(n) if c in COVERS[i]] for c in SHELL}

shells = []


def search(chosen, covered, cells):
    rem = [c for c in SHELL if c not in covered]
    if not rem:
        shells.append(tuple(sorted(chosen)))
        return
    best, bestc = None, None
    for c in rem:
        cand = [i for i in CELLCAND[c]
                if all(COMPAT[i][j] for j in chosen) and not (ATLAS[i].cells & cells)]
        if best is None or len(cand) < len(best):
            best, bestc = cand, c
            if not cand:
                return
    for i in best:
        search(chosen + [i], covered | COVERS[i], cells | ATLAS[i].cells)


search([], set(), set())
hdr('1. COMPLETE FIRST SHELLS')
print('complete legal first shells:', len(shells))

rows = []
for s in shells:
    filler = [i for i in s if NOTCH in ATLAS[i].cells]
    assert len(filler) == 1
    slot = ROLE[ATLAS[filler[0]].pose]
    # pre(X): shell chairs whose OWN notch cell is inside X
    pre = [i for i in s if pose_apply_cell(ATLAS[i].pose, NOTCH) in BASE.cells]
    rows.append((len(s), str(slot), len(pre), s, tuple(sorted(pre))))

print()
print('| #chairs | slot of nu(X) | |pre(X)| | count |')
print('|---|---|---|---|')
tab = Counter((r[0], r[1], r[2]) for r in rows)
for k in sorted(tab, key=lambda z: (z[2], z[1], z[0])):
    print('| %d | %s | %d | %d |' % (k[0], k[1], k[2], tab[k]))
print()
print('|pre(X)| values that occur:', sorted(set(r[2] for r in rows)))
OUT['first_shells'] = len(shells)
OUT['pre_values'] = sorted(set(r[2] for r in rows))
OUT['table'] = [{'chairs': k[0], 'nu_slot': k[1], 'pre': k[2], 'count': v}
                for k, v in sorted(tab.items(), key=lambda z: (z[0][2], z[0][1]))]

hdr('2. THE CENTRE CRITERION')
seven = [r for r in rows if r[2] == 7]
notseven = [r for r in rows if r[2] != 7]
print('shells with |pre(X)| == 7 (X is a CENTRE)       :', len(seven))
print('shells with |pre(X)| != 7                        :', len(notseven),
      ' values', sorted(set(r[2] for r in notseven)))
# in a centre shell, are the 7 preimages + X exactly a supertile?
ok = True
for r in seven:
    pre = r[4]
    poses = set(ATLAS[i].pose for i in pre) | {(IDENT, (0, 0, 0))}
    S = supertile_children_pose = {k: pose_compose(
        (IDENT, (0, 0, 0)), FRAMES[k]) for k in FRAMES}
    # X is central: the supertile with X central is  X o (I,(1,1,1))^-1
    sp = (IDENT, (-1, -1, -1))
    want = set(pose_compose(sp, FRAMES[k]) for k in FRAMES)
    if want != poses:
        ok = False
print('in every such shell, {X} u pre(X) is exactly an 8-chair supertile:', ok)
OUT['centre_shells'] = len(seven)
OUT['centre_shell_is_supertile'] = bool(ok)

# consistency of the rule
hdr('3. IS THE GROUPING RULE CONSISTENT?')
print("Rule:  X is a centre  iff  |pre(X)| = 7 ;")
print("       group(X) = {X} u pre(X)      if X is a centre,")
print("       group(X) = {nu(X)} u pre(nu(X)) otherwise.")
print()
# (i) a centre's slot: what does a centre's OWN nu say?
print('slots of nu(X) over the centre shells :', Counter(r[1] for r in seven))
print('slots of nu(X) over the other shells  :', Counter(r[1] for r in notseven))
# (ii) can a chair be a centre AND have |pre| in 1..6 ?  answered above.
# (iii) in a non-centre shell, is nu(X) forced to be a centre?  This cannot be
# decided from X's own shell; state it as a limitation.

hdr('4. COMPETING GROUPS UNDER THE CORRECTED RULE')
# exhaustive over legal pairs (X, X') with both NON-centres: their parents must
# agree or be cell-disjoint-and-coarse-legal.


def supertile_pose(ypose):
    L, t = ypose
    w = lin(L, (1, 1, 1))
    return (L, (t[0] - w[0], t[1] - w[1], t[2] - w[2]))


def supertile_cells(sp):
    out = set()
    for k in FRAMES:
        out |= set(pose_apply_cell(pose_compose(sp, FRAMES[k]), c) for c in K)
    return out


FILLERS = sorted(ROLE)
A44S = set(A44)
tested = legal = same = disj = coarse = 0
fail = []
for Xp in A44:
    for fX in FILLERS:
        Yp = fX
        for fZ in FILLERS:
            Zp = pose_compose(Xp, fZ)
            tested += 1
            ps = list(dict.fromkeys([(IDENT, (0, 0, 0)), Yp, Xp, Zp]))
            # rule out the configurations where one of the four chairs is itself
            # claimed as a centre by another: i.e. require Yp != X and Zp != Xp
            # and, crucially, that X is not the notch filler of X' and vice versa
            if Zp == (IDENT, (0, 0, 0)) or Yp == Xp:
                continue          # X' plugs X, or X plugs X': one of them is a centre
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
            legal += 1
            S1, S2 = supertile_pose(Yp), supertile_pose(Zp)
            if S1 == S2:
                same += 1
                continue
            c1, c2 = supertile_cells(S1), supertile_cells(S2)
            if c1 & c2:
                fail.append((Xp, fX, fZ, 'OVERLAP'))
                continue
            disj += 1
            r = rel(S1, S2)
            if any(x % 2 for x in r[1]):
                fail.append((Xp, fX, fZ, 'ODD'))
                continue
            rh = (r[0], tuple(x // 2 for x in r[1]))
            if rh in A44S:
                coarse += 1
            else:
                fail.append((Xp, fX, fZ, 'NOT-IN-A44'))
print('legal 4-chair configurations with X, X\' both non-centres: %d / %d tested'
      % (legal, tested))
print('   same parent                       :', same)
print('   different, cell-disjoint parents  :', disj)
print('      of those, halved rel. pose in A44:', coarse)
print('   failures                          :', len(fail), Counter(f[3] for f in fail))
OUT['competing_groups_corrected'] = {'tested': tested, 'legal': legal, 'same': same,
                                     'disjoint': disj, 'coarse_ok': coarse,
                                     'failures': len(fail),
                                     'failure_kinds': dict(Counter(f[3] for f in fail))}
if fail:
    print('   examples:', fail[:5])

json.dump(OUT, open('force3_out.json', 'w'), indent=1)
print()
print('wrote force3_out.json')
