"""The LITERAL sketch reading M21 (three far-corner facets blank) and why it fails."""
from itertools import product
from chair import *
M24M = marking_to_facet_marks(M24)
M21M = {f: v for f, v in M24M.items() if site(f) != (0, 0, 0)}
print('M21: %d marked facets, %d blank (the three at the far corner (0,0,0))'
      % (len(M21M), 24 - len(M21M)))
base = Tile((IDENT, (0, 0, 0)), M21M)
sh = Tile((IDENT, (1, 1, 1)), M21M)
for blank_ok in (False, True):
    ok, n = pair_legal(base, sh, blank_ok=blank_ok)
    print('  (c) translation by (1,1,1): legal=%s (blank_ok=%s), shared facets=%d'
          % (ok, blank_ok, n))
fr = child_frames(M24)
poses = supertile_poses(fr, 1)
tiles = [Tile(p, M21M) for p in poses]
allc = {}
for i, t in enumerate(tiles):
    for c in t.cells:
        allc[c] = i
bad = miss = 0
for c, i in allc.items():
    for d in DIRS:
        c2 = add(c, d)
        j = allc.get(c2)
        if j is None or j == i:
            continue
        m1 = tiles[i].marks.get((c, d))
        m2 = tiles[j].marks.get((c2, (-d[0], -d[1], -d[2])))
        if m1 is None or m2 is None:
            miss += 1
        elif m1[1] != m2[1] or COMP[m1[0]] != m2[0]:
            bad += 1
print('  (a) level-1 supertile: %d directed contacts where one side is blank, '
      '%d type/site violations' % (miss, bad))
# the supertile's own marks at its 8 sites: are they all present?
s = 2
absent = []
for f in FACETS:
    c, d = f
    v = site(f); V = scale(s, v)
    fc = tuple((s * c[i]) if V[i] == s * c[i] else s * c[i] + s - 1 for i in range(3))
    if (fc, d) not in tiles[allc[fc]].marks:
        absent.append(f)
print('  (b) coarse read: %d of the 24 parent marks are missing' % len(absent))
