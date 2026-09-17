"""
The coarsening identity:  (1/2) * (atlas of the level-1 supertile) == A44 ?

The level-1 supertile is a marked chair at scale 2 (verified in verify.py step 4).
We enumerate EVERY pose of a second supertile that is legal at the FINE level
(8+8 chairs, no overlap, every shared unit facet matching) and ask whether the
translation is always even and the halved pose always lies in A44.

Run: python3 force4.py
"""
import json, time
from itertools import product
from chair import *

MARKS = marking_to_facet_marks(M24)
FRAMES = child_frames(M24)
OUT = {}


def hdr(s):
    print(); print('=' * 78); print(s); print('=' * 78)


BASE = Tile((IDENT, (0, 0, 0)), MARKS)
A44 = set()
for L in PROPER_L:
    for t in product(range(-4, 5), repeat=3):
        tl = Tile((L, t), MARKS)
        if BASE.cells & tl.cells or not contacts(BASE, tl):
            continue
        if pair_legal(BASE, tl)[0]:
            A44.add((L, t))
print('A44 (fine atlas, proper frames):', len(A44))


def supertile(sp):
    return [Tile(pose_compose(sp, FRAMES[k]), MARKS) for k in FRAMES]


S0 = supertile((IDENT, (0, 0, 0)))
S0cells = set()
for t in S0:
    S0cells |= t.cells
print('supertile cells:', len(S0cells))

hdr('SUPERTILE ATLAS (exhaustive over 24 proper frames, |t| <= 9)')
t0 = time.time()
found = []
odd = []
for L in PROPER_L:
    for t in product(range(-9, 10), repeat=3):
        sp = (L, t)
        S1 = supertile(sp)
        c1 = set()
        bad = False
        for tl in S1:
            if tl.cells & S0cells:
                bad = True
                break
            c1 |= tl.cells
        if bad:
            continue
        # adjacency?
        if not any(add(c, d) in c1 for c in S0cells for d in DIRS):
            continue
        ok = True
        for a in S0:
            for b in S1:
                if not pair_legal(a, b)[0]:
                    ok = False
                    break
            if not ok:
                break
        if ok:
            found.append(sp)
            if any(x % 2 for x in t):
                odd.append(sp)
print('legal supertile neighbours: %d   (%.1fs)' % (len(found), time.time() - t0))
print('   with ODD translation (would break registration):', len(odd))
half = set((L, tuple(x // 2 for x in t)) for (L, t) in found if not any(x % 2 for x in t))
print('   halved poses: %d distinct' % len(half))
print('   halved atlas == A44 :', half == A44)
print('   halved atlas subset of A44:', half <= A44, '   superset:', half >= A44)
if half != A44:
    print('   in A44 not realised:', sorted(A44 - half)[:5])
    print('   realised but not in A44:', sorted(half - A44)[:5])
OUT['supertile_atlas'] = len(found)
OUT['odd_translations'] = len(odd)
OUT['halved_equals_A44'] = bool(half == A44)
OUT['halved_count'] = len(half)

json.dump(OUT, open('force4_out.json', 'w'), indent=1)
print('\nwrote force4_out.json')
