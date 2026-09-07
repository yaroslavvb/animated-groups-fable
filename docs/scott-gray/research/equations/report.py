#!/usr/bin/env python3
"""Print the per-equation coverage of the merged catalog (Markdown), for README.md."""
import json
from collections import Counter, defaultdict
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
NAMES = {'gray-scott': 'Gray–Scott', 'ginzburg-landau': 'Ginzburg–Landau', 'brusselator': 'Brusselator'}

def main():
    groups = json.loads((ROOT / 'wallpaper-groups.json').read_text()); atlas = json.loads((ROOT / 'data/wallpaper-atlas.json').read_text())
    by = defaultdict(Counter); fields = defaultdict(set)
    for r in atlas['orbits']:
        m = r['config'].get('model', 'gray-scott'); by[r['groupId']][m] += 1; fields[m].add(r['fieldSha256'])
    shift = [g for g in groups['groups'] if g['hasTimeShift']]
    print(f"Records: {len(atlas['orbits'])} over {len({r['groupId'] for r in atlas['orbits']})} entries; distinct saved fields " + ', '.join(f"{NAMES[m]} {len(fields[m])}" for m in NAMES))
    for m in NAMES:
        covered = [g['id'] for g in shift if by[g['id']][m]]
        print(f"- {NAMES[m]}: {len(covered)} of {len(shift)} nonzero-offset entries" + (f"; missing {', '.join(g['id'] for g in shift if not by[g['id']][m])}" if len(covered) < len(shift) else ''))
    print('\n| Wallpaper group | Entry | Signature | ' + ' | '.join(NAMES.values()) + ' |'); print('| --- | --- | --- | ' + ' | '.join('---:' for _ in NAMES) + ' |')
    for g in groups['groups']:
        print(f"| {g['family']} | {g['id']} | {g['signature'].replace('*', '∗')}{'' if g['hasTimeShift'] else ' (zero offset)'} | " + ' | '.join(str(by[g['id']][m] or '—') for m in NAMES) + ' |')

if __name__ == '__main__': main()
