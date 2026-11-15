# scratch: summarise the --json reports of app-sheet.mjs (errors, validator problems, whether the print took)
#   python3 -I dev/patterns/designs/feet/scratch/appjson.py <file.json> ...
import json
import sys

for f in sys.argv[1:]:
    d = json.load(open(f))
    rows = d if isinstance(d, list) else d.get('rows') or d.get('groups') or []
    if not isinstance(rows, list) or (rows and not isinstance(rows[0], dict)):
        print(f, 'unexpected shape:', json.dumps(d)[:300])
        continue
    bad = [(r.get('id'), r.get('errors'), r.get('problems'), r.get('took')) for r in rows
           if r.get('errors') or r.get('problems') or not r.get('took')]
    print(f.split('/')[-1], len(rows), 'groups; bad:', bad, '; stabilizers', sorted(set(r.get('stabilizer') for r in rows)))
