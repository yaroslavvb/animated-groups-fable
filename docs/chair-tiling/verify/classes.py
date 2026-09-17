"""
The 18 markings that satisfy (a)+(b)+(c), scored against CGS's drawing.

The scoring is done on the LEVEL-1 SUPERTILE, because that is what the main
figure of the photograph shows: nine 2x2 back faces of sub-chairs on the three
outer L-faces z=4, y=4, x=4 of S = [0,4]^3 \\ [2,4]^3.  Every item below is one
unit facet of S in global coordinates together with the symbol the drawing puts
in it (tiling-sketch.md sections 2.2 and 3.1-3.2).

AXES.  CGS wrote the axes on the photograph himself, beside the single-tile
figure: "+x" with an arrow to the LOWER LEFT, "+y" with an arrow to the RIGHT,
z upright.  That is the convention used here and by the viewer, so every item
below is read off the drawing with no freedom left.  The first transcription of
the photograph interchanged x and y, which mirrored the whole reconstruction;
the table below is the corrected reading.  The clearest single item is the
notch of the single-tile figure: the OPEN V is on the screen-left wall (+y) and
the SOLID head on the screen-right wall (+x).

Run: python3 classes.py
"""
import json
from itertools import permutations, product
from collections import Counter
from chair import *

PERMS = list(permutations(TYPES))
SITEKEYS = list(K) + ['dent']

# ---------------------------------------------------------------- evidence
# (cell, direction) of S  ->  (symbol, confidence)   confidence: 3 high, 2 med, 1 low
PZ = (0, 0, 1); PY = (0, 1, 0); PX = (1, 0, 0)
SUPER_EV = {
    # --- plane z = 4 -------------------------------------------------------
    ((1, 0, 3), PZ): ('F', 3),   # T1 filled at (2,0,4)
    ((0, 1, 3), PZ): ('H', 3),   # T1 hollow at (0,2,4)
    ((0, 2, 3), PZ): ('F', 3),   # T2 filled at (0,2,4)
    ((1, 3, 3), PZ): ('H', 3),   # T2 hollow at (2,4,4)
    ((3, 1, 3), PZ): ('F', 2),   # T3 filled at (4,2,4)
    ((2, 0, 3), PZ): ('H', 2),   # T3 hollow at (2,0,4)
    # --- plane x = 4 -------------------------------------------------------
    ((3, 1, 0), PX): ('F', 2),   # Y1 filled at (4,2,0)
    ((3, 0, 1), PX): ('H', 2),   # Y1 hollow at (4,0,2)
    ((3, 3, 1), PX): ('F', 3),   # Y2 filled at (4,4,2)
    ((3, 2, 0), PX): ('H', 3),   # Y2 hollow at (4,2,0)
    ((3, 0, 2), PX): ('F', 1),   # Y3 filled at (4,0,2)
    ((3, 1, 3), PX): ('H', 1),   # Y3 hollow at (4,2,4)
    # --- plane y = 4 -------------------------------------------------------
    ((0, 3, 1), PY): ('F', 3),   # X1 filled at (0,4,2)
    ((1, 3, 0), PY): ('H', 3),   # X1 hollow at (2,4,0)
    ((2, 3, 0), PY): ('F', 3),   # X2 filled at (2,4,0)
    ((3, 3, 1), PY): ('H', 3),   # X2 hollow at (4,4,2)
    ((1, 3, 3), PY): ('F', 2),   # X3 filled at (2,4,4)
    ((0, 3, 2), PY): ('H', 2),   # X3 hollow at (0,4,2)
    # --- the nine pale-blue arrows (position SEEN with high confidence) ------
    ((1, 1, 3), PZ): ('B', 3), ((1, 2, 3), PZ): ('B', 3), ((2, 1, 3), PZ): ('B', 3),
    ((3, 1, 1), PX): ('B', 3), ((3, 2, 1), PX): ('B', 3), ((3, 1, 2), PX): ('B', 3),
    ((1, 3, 1), PY): ('B', 3), ((2, 3, 1), PY): ('B', 3), ((1, 3, 2), PY): ('B', 3),
}
# single-chair figure, canonical C = [0,2]^3 \ [1,2]^3   (cell, dir) -> symbol
CHAIR_EV = {
    ((0, 1, 1), (1, 0, 0)): ('F', 3),   # notch x-wall (screen right): solid purple
    ((1, 0, 1), (0, 1, 0)): ('H', 3),   # notch y-wall (screen left):  open purple V
    ((1, 1, 0), (0, 0, 1)): ('B', 3),   # notch z-wall (screen below): blue arrow
    ((0, 1, 1), (0, 0, 1)): ('F', 3),   # L-face z=2, filled head at (0,2,2)
    ((1, 0, 1), (0, 0, 1)): ('H', 3),   # L-face z=2, hollow head at (2,0,2)
    ((0, 0, 1), (0, 0, 1)): ('B', 3),   # L-face z=2, blue arrow at (0,0,2)
}


def stars_from(a):
    return {SITEKEYS[i]: a[i] for i in range(8)}


def check(stars, levels=(1, 2)):
    marks = marking_to_facet_marks(stars)
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
        allc = {}
        for i, tl in enumerate(tiles):
            for c in tl.cells:
                if c in allc:
                    return None
                allc[c] = i
        for c, i in allc.items():
            for d in DIRS:
                c2 = add(c, d)
                j = allc.get(c2)
                if j is None or j == i:
                    continue
                m1 = tiles[i].marks.get((c, d))
                m2 = tiles[j].marks.get((c2, (-d[0], -d[1], -d[2])))
                if m1 is None or m2 is None or m1[1] != m2[1] or COMP[m1[0]] != m2[0]:
                    return None
        s = 2 ** level
        got = {}
        for f in FACETS:
            c, d = f
            v = site(f)
            V = scale(s, v)
            fc = tuple((s * c[i]) if V[i] == s * c[i] else s * c[i] + s - 1
                       for i in range(3))
            got[f] = (tiles[allc[fc]].marks[(fc, d)][0], v)
        if got != marks:
            return None
    return fr


def atlas_of(stars):
    marks = marking_to_facet_marks(stars)
    base = Tile((IDENT, (0, 0, 0)), marks)
    prop, impr = set(), set()
    for L in ALL_L:
        for t in product(range(-4, 5), repeat=3):
            tl = Tile((L, t), marks)
            if base.cells & tl.cells or not contacts(base, tl):
                continue
            if pair_legal(base, tl)[0]:
                (prop if det(L) == 1 else impr).add((L, t))
    return prop, impr


def score(stars, fr):
    marks = marking_to_facet_marks(stars)
    tiles = [Tile(p, marks) for p in supertile_poses(fr, 1)]
    S = {}
    for tl in tiles:
        S.update(tl.marks)
    hit = tot = whit = wtot = 0
    for key, (sym, w) in SUPER_EV.items():
        got = S.get(key)
        tot += 1
        wtot += w
        if got and got[0] == sym:
            hit += 1
            whit += w
    for key, (sym, w) in CHAIR_EV.items():
        got = marks.get(key)
        tot += 1
        wtot += w
        if got and got[0] == sym:
            hit += 1
            whit += w
    return hit, tot, whit, wtot


TS = set()
d = json.load(open('tiling-matching-system.json'))
for c in d['contact_atlas_A44']['contacts']:
    TS.add(((tuple(c['perm']), tuple(c['signs'])), tuple(c['translation'])))

sols = []
for a in product(PERMS, repeat=8):
    st = stars_from(a)
    fr = check(st)
    if fr is not None:
        sols.append((a, fr))
print('markings satisfying (a)+(b)+(c) at levels 1 and 2:', len(sols))
print()
print('%-3s %-30s %-6s %-5s %-5s %-8s %-12s %s'
      % ('#', 'stars 000/001/010/011/100/101/110/dent', 'proper', '|A+|', '|A-|',
         '==A44', 'sketch', 'weighted'))
rows = []
m24a = tuple(M24[k] for k in SITEKEYS)
for i, (a, fr) in enumerate(sols):
    st = stars_from(a)
    allprop = all(det(fr[k][0]) == 1 for k in fr)
    prop, impr = atlas_of(st)
    h, t, wh, wt = score(st, fr)
    rows.append(dict(i=i, stars=[list(x) for x in a], all_proper=allprop,
                     Aplus=len(prop), Aminus=len(impr), eqA44=(prop == TS),
                     hit=h, tot=t, whit=wh, wtot=wt, is_M24=(a == m24a)))
    print('%-3d %-30s %-6s %-5d %-5d %-8s %2d/%-9d %d/%d %s'
          % (i, '/'.join(''.join(x) for x in a), allprop, len(prop), len(impr),
             prop == TS, h, t, wh, wt, '  <-- M24' if a == m24a else ''))

print()
best = max(r['whit'] for r in rows)
print('best weighted sketch agreement: %d/%d, achieved by #%s'
      % (best, rows[0]['wtot'], [r['i'] for r in rows if r['whit'] == best]))
print('solutions whose proper atlas equals Tsiokos A44:',
      [r['i'] for r in rows if r['eqA44']])
print('solutions with all-proper child frames:',
      [r['i'] for r in rows if r['all_proper']])
json.dump({'n': len(sols), 'rows': rows}, open('classes_out.json', 'w'), indent=1)
print('wrote classes_out.json')
