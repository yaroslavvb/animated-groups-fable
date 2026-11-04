#!/usr/bin/env python3
"""Inclusions among the atlas's fixed coordinate representatives modulo Z^3."""
import json
from pathlib import Path
D = Path(__file__).resolve().parents[1] / 'docs'
groups = json.loads((D / 'data/clockwork-coloring-correspondence.json').read_text())['groups']
crystals = {g['id']: g for g in json.loads((D / 'data/crystal-examples.json').read_text())['groups']}
def operations(g):
    def mod(x):
        return round(x % 1, 5) % 1
    return frozenset(tuple(v for row in o['M'] for v in row) + tuple(mod(x) for x in o['v']) + (mod(o['tau']),) for o in g['render']['ops'])
sets = {g['id']: operations(g) for g in groups}
assert len(sets) == 68 and all(len(s) for s in sets.values())
assert len(set(sets.values())) == 68
edges = [(a, b) for a in sets for b in sets if sets[a] < sets[b] and not any(sets[a] < sets[c] < sets[b] for c in sets)]
result = {'groups': [{'id':g['id'], 'symbol': '◦' if g['id'] == 'g1' else g['symbol'], 'number': crystals[g['id']]['it_number'], 'family':g['parent']['hm'], 'order':len(sets[g['id']])} for g in groups], 'edges': edges}
(D / 'data/polar-inclusions.json').write_text(json.dumps(result, indent=2) + '\n')
