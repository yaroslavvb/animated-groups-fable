"""Map Tsiokos's 24 panel IDs onto our 24 facets and compare the 3-class partitions."""
import json
from fractions import Fraction
from chair import *
d = json.load(open('tiling-matching-system.json'))
MARKS = marking_to_facet_marks(M24)
cls = {}
import ast
classes = {'A': {'panels': [0,2,7,9,11,14,20,21]}, 'B': {'panels': [1,4,6,8,12,15,18,19]}, 'C': {'panels': [3,5,10,13,16,17,22,23]}}
for name, v in classes.items():
    for p in v['panels']:
        cls[p] = name
rows = []
for p in d['panels']:
    ax = p['normal_axis']; sg = p['outward_sign']
    ctr = [Fraction(s) for s in p['panel_centre']]
    dirv = [0, 0, 0]; dirv[ax] = sg; dirv = tuple(dirv)
    # the cell is the one on the inside of the panel
    cell = []
    for i in range(3):
        if i == ax:
            cell.append(int(ctr[i]) - (1 if sg == 1 else 0))
        else:
            cell.append(int(ctr[i] - Fraction(1, 2)))
    cell = tuple(cell)
    assert cell in K, (p['panel'], cell)
    f = (cell, dirv)
    assert f in FACETS, (p['panel'], f)
    rows.append((p['panel'], cls[p['panel']], MARKS[f][0], f, p['is_notch_panel']))
print('%-6s %-9s %-6s %-30s %s' % ('panel', 'Tsiokos', 'ours', 'facet (cell,dir)', 'notch'))
for r in sorted(rows):
    print('%-6d %-9s %-6s %-30s %s' % (r[0], r[1], r[2], str(r[3]), r[4]))
from collections import Counter
pair = Counter((r[1], r[2]) for r in rows)
print()
print('cross-tabulation Tsiokos class x our symbol:', dict(pair))
ok = len(pair) == 3
print('the two 3-class partitions coincide exactly:', ok)
print('dictionary:', {a: b for (a, b) in pair})
