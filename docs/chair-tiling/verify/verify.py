"""Verifier for the marked 3-D chair.  Run:  python3 verify.py"""
import sys, json, time
from itertools import product, permutations
from chair import *

OUT = {}


def hdr(s):
    print()
    print('=' * 78)
    print(s)
    print('=' * 78)


# ------------------------------------------------------------------ 0. basics
hdr('0. CONVENTIONS')
print('cells K            :', K)
print('facets             : %d  (outer %d, notch %d)'
      % (len(FACETS), len(FACETS) - 3, 3))
print('sites              : %d  ->  %s' % (len(SITES), [SITE_KEY[v] for v in SITES]))
marks24 = marking_to_facet_marks(M24)
cnt = {t: 0 for t in TYPES}
for f, (ty, v) in marks24.items():
    cnt[ty] += 1
print('M24 type census    :', cnt)
OUT['facet_count'] = len(FACETS)
OUT['type_census_M24'] = cnt

# print the full table
print()
print('%-28s %-6s %-10s %-4s %s' % ('facet (cell, dir)', 'axis', 'kind', 'mark', 'site'))
KINDS = {}
for f in sorted(FACETS):
    c, d = f
    kind = 'notch' if add(c, d) == NOTCH_CELL else ('outer')
    KINDS[f] = kind
    ty, v = marks24[f]
    print('%-28s %-6s %-10s %-4s %s' % (str(f), 'xyz'[facet_axis(f)], kind, ty, v))

# ------------------------------------------------ 1. stated structural facts
hdr('1. STRUCTURAL PROPERTIES OF M24')
ok_star = all(sorted(M24[k]) == ['B', 'F', 'H'] for k in M24)
print('every site carries one F, one H and one B :', ok_star)
compl = all(M24['dent'][i] == COMP[M24[FAR][i]] for i in range(3))
print('dent star = complement of far-corner star :', compl)
sym = []
for L in ALL_L:
    t_ok = None
    # does some pose fix the chair AND the marking?
    for t in product(range(-3, 4), repeat=3):
        pose = (L, t)
        cells = frozenset(pose_apply_cell(pose, c) for c in K)
        if cells != frozenset(K):
            continue
        tl = Tile(pose, marks24)
        base = Tile((IDENT, (0, 0, 0)), marks24)
        if tl.marks == base.marks:
            t_ok = t
    if t_ok is not None:
        sym.append((L, t_ok))
print('isometries preserving chair+marking       :', len(sym), '(expect 1 = identity)')
shape_sym = 0
for L in ALL_L:
    for t in product(range(-3, 4), repeat=3):
        if frozenset(pose_apply_cell((L, t), c) for c in K) == frozenset(K):
            shape_sym += 1
print('isometries preserving the bare chair       :', shape_sym, '(expect 6 = S3)')
OUT['marking_symmetry_group_order'] = len(sym)
OUT['shape_symmetry_group_order'] = shape_sym

# ------------------------------------------------ 2. child frames
hdr('2. SUBSTITUTION: the 8 child frames forced by self-similarity')
frames = child_frames(M24, allow_improper=True)
assert frames is not None, 'no consistent child frames'
for k in list(K) + ['dent']:
    L, t = frames[k]
    print('%-12s  perm=%s signs=%s  t=%s  det=%+d' % (str(k), L[0], L[1], t, det(L)))
print('all children are proper rotations:', all(det(frames[k][0]) == 1 for k in frames))
OUT['child_frames'] = {str(k): {'perm': list(frames[k][0][0]),
                                'signs': list(frames[k][0][1]),
                                'translation': list(frames[k][1]),
                                'det': det(frames[k][0])} for k in frames}

# ------------------------------------------------ 3. (a) substitution consistency
hdr('3. (a) SUBSTITUTION CONSISTENCY at levels 1, 2, 3')
res_a = {}
for level in (1, 2, 3):
    t0 = time.time()
    poses = supertile_poses(frames, level)
    tiles = [Tile(p, marks24) for p in poses]
    # cell partition check
    allcells = {}
    dup = 0
    for i, tl in enumerate(tiles):
        for c in tl.cells:
            if c in allcells:
                dup += 1
            allcells[c] = i
    side = 2 ** (level + 1)
    want = set()
    for c in product(range(side), repeat=3):
        # the level-`level` supertile is  2^level * C
        s = 2 ** level
        a = tuple(x // s for x in c)
        if a != (1, 1, 1):
            want.add(c)
    part_ok = (dup == 0 and set(allcells) == want)
    # contacts
    bad = []
    ncon = 0
    byidx = {}
    for c, i in allcells.items():
        byidx.setdefault(i, set()).add(c)
    for c, i in allcells.items():
        for d in DIRS:
            c2 = add(c, d)
            j = allcells.get(c2)
            if j is None or j == i:
                continue
            ncon += 1
            m1 = tiles[i].marks.get((c, d))
            m2 = tiles[j].marks.get((c2, (-d[0], -d[1], -d[2])))
            if m1 is None or m2 is None or m1[1] != m2[1] or COMP[m1[0]] != m2[0]:
                bad.append((c, d, m1, m2))
    print('level %d: %d chairs, %d cells, partition=%s, %d directed interior contacts, %d violations  (%.1fs)'
          % (level, len(tiles), len(allcells), part_ok, ncon, len(bad), time.time() - t0))
    if bad[:3]:
        print('   e.g.', bad[:3])
    res_a[level] = {'chairs': len(tiles), 'cells': len(allcells),
                    'partition_ok': bool(part_ok),
                    'directed_interior_contacts': ncon, 'violations': len(bad)}
OUT['substitution_consistency'] = res_a

# ------------------------------------------------ 4. (b) self-similarity of the exterior
hdr('4. (b) SELF-SIMILARITY: the supertile read at double scale reproduces M')


def coarse_read(tiles, level):
    """Read the level-`level` supertile's marking at scale 2^level.
    Returns dict facet -> (type, site) in the COARSE (chair) coordinates."""
    s = 2 ** level
    allcells = {}
    for i, tl in enumerate(tiles):
        for c in tl.cells:
            allcells[c] = i
    out = {}
    for f in FACETS:
        c, d = f
        v = site(f)                    # coarse site
        V = scale(s, v)                # the same site in fine coordinates
        # the fine facet inside the coarse facet f having V as a corner:
        # its cell is the fine cell of the supertile touching V inside coarse cell c,
        # and its direction is d.
        ax = facet_axis(d if False else f)
        # fine cell: within coarse cell c (fine range [s*c, s*c+s)), pick the corner
        # cell nearest V
        fc = []
        for i in range(3):
            lo = s * c[i]
            if V[i] == lo:
                fc.append(lo)
            elif V[i] == lo + s:
                fc.append(lo + s - 1)
            else:
                raise AssertionError('site not a corner of the coarse cell')
        fc = tuple(fc)
        i = allcells.get(fc)
        assert i is not None, (f, fc)
        m = tiles[i].marks.get((fc, d))
        assert m is not None, (f, fc, d)
        out[f] = (m[0], v)
    return out


res_b = {}
for level in (1, 2):
    poses = supertile_poses(frames, level)
    tiles = [Tile(p, marks24) for p in poses]
    got = coarse_read(tiles, level)
    same = (got == marks24)
    diff = [(f, got[f], marks24[f]) for f in FACETS if got[f] != marks24[f]]
    print('level %d supertile coarse-read == M24 :' % level, same,
          '' if same else diff[:4])
    res_b[level] = {'reproduces_M': bool(same), 'mismatches': len(diff)}
OUT['self_similarity'] = res_b

# also: the concave-corner statement CGS made
poses1 = supertile_poses(frames, 1)
tiles1 = [Tile(p, marks24) for p in poses1]
central = [t for t in tiles1 if t.pose[1] == (1, 1, 1)][0]
cm = {}
for (c, d), (ty, v) in central.marks.items():
    if v == (2, 2, 2):
        cm['xyz'[[i for i in range(3) if d[i] != 0][0]]] = ty
print("central child's dent star at (2,2,2)      :", cm,
      '  parent dent star:', dict(zip('xyz', M24['dent'])))
OUT['central_child_dent_star'] = cm

# ------------------------------------------------ 5. (c) dent/back complementarity
hdr('5. (c) DENT vs BACK COMPLEMENTARITY  ("shift the tile forward")')
base = Tile((IDENT, (0, 0, 0)), marks24)
shifted = Tile((IDENT, (1, 1, 1)), marks24)
ok, n = pair_legal(base, shifted)
print('C and C+(1,1,1): legal =', ok, ', shared facets =', n)
print('  notch cell (1,1,1) covered by the shifted copy:',
      (1, 1, 1) in shifted.cells)
for c1, d in contacts(base, shifted):
    c2 = add(c1, d)
    m1 = base.marks[(c1, d)]
    m2 = shifted.marks[(c2, (-d[0], -d[1], -d[2]))]
    print('   facet %s dir %s : %s  vs  %s' % (c1, d, m1, m2))
OUT['dent_translation_legal'] = bool(ok)
OUT['dent_translation_shared_facets'] = n

# ------------------------------------------------ 6. contact atlas
hdr('6. CONTACT ATLAS: every legal neighbour of one chair')


def atlas(marks, Ls=ALL_L, rng=range(-4, 5)):
    base = Tile((IDENT, (0, 0, 0)), marks)
    out = []
    for L in Ls:
        for t in product(rng, repeat=3):
            pose = (L, t)
            tl = Tile(pose, marks)
            if base.cells & tl.cells:
                continue
            if not contacts(base, tl):
                continue
            ok, n = pair_legal(base, tl)
            if ok:
                out.append((pose, n))
    return out


t0 = time.time()
A = atlas(marks24)
print('legal neighbour poses (48 frames, |t|<=4): %d   (%.1fs)' % (len(A), time.time() - t0))
prop = [a for a in A if det(a[0][0]) == 1]
print('  proper (rotation) neighbours  :', len(prop))
print('  improper (reflected) neighbours:', len(A) - len(prop))
byframe = {}
for (L, t), n in A:
    byframe.setdefault(L, []).append((t, n))
print('  distinct relative frames      :', len(byframe))
ident_frame = [(t, n) for (L, t), n in A if L == IDENT]
print('  neighbours with the IDENTITY frame:', sorted(ident_frame))
OUT['atlas'] = {'total': len(A), 'proper': len(prop), 'improper': len(A) - len(prop),
                'distinct_frames': len(byframe),
                'identity_frame_translations': sorted([list(t) for t, n in ident_frame])}

# which legal neighbours actually occur in the level-3 supertile?
poses3 = supertile_poses(frames, 3)
tiles3 = [Tile(p, marks24) for p in poses3]
occurring = set()
for i in range(len(tiles3)):
    for j in range(len(tiles3)):
        if i == j:
            continue
        if not contacts(tiles3[i], tiles3[j]):
            continue
        # relative pose  P_i^{-1} P_j
        Li, ti = tiles3[i].pose
        Lj, tj = tiles3[j].pose
        # inverse of (Li,ti)
        p, s = Li
        pinv = [0, 0, 0]
        for a in range(3):
            pinv[p[a]] = a
        sinv = tuple(s[pinv[a]] for a in range(3))
        Linv = (tuple(pinv), sinv)
        tinv = lin(Linv, (-ti[0], -ti[1], -ti[2]))
        rel = pose_compose((Linv, tinv), (Lj, tj))
        occurring.add(rel)
print('relative poses actually occurring in the level-3 supertile:', len(occurring))
print('  all of them are in the atlas:', occurring <= set(p for p, n in A))
OUT['atlas_occurring_level3'] = len(occurring)

# ------------------------------------------------ 7. (d) forcing
hdr('7. (d) FORCING')

# (d1) who can fill the notch?
fillers = [(pose, n) for (pose, n) in A if (1, 1, 1) in
           Tile(pose, marks24).cells]
print('(d1) legal neighbour poses whose body contains the notch cell (1,1,1):',
      len(fillers))
for pose, n in fillers:
    print('     ', pose, ' shared facets:', n)
OUT['d1_notch_fillers'] = [{'perm': list(p[0][0]), 'signs': list(p[0][1]),
                            'translation': list(p[1])} for p, n in fillers]

# (d1') the same without the matching rule -- bare shape only
bare = 0
basecells = frozenset(K)
for L in ALL_L:
    for t in product(range(-4, 5), repeat=3):
        cells = frozenset(pose_apply_cell((L, t), c) for c in K)
        if cells & basecells:
            continue
        if (1, 1, 1) in cells:
            bare += 1
print("(d1') poses of a BARE chair that cover the notch without overlapping:", bare)
OUT['d1_bare_notch_fillers'] = bare

# (d2) recognition: in any legal patch, is the group structure forced?
# Exhaustive local statement, see spec.
print()
print('(d2) see force.py')
OUT['generated'] = time.strftime('%Y-%m-%dT%H:%M:%S')
json.dump(OUT, open('verify_out.json', 'w'), indent=1)
print()
print('wrote verify_out.json')
