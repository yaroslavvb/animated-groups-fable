#!/bin/sh
# Full verification run.  ~2.5 min total on an M-series Mac, python3, no deps.
set -e
cd "$(dirname "$0")"
python3 verify.py            # conventions, (a) (b) (c), atlas
python3 force.py             # 22-cell shell, 33 complete first shells, notch fillers
python3 force.py --allow-reflections
python3 force2.py            # competing groups, nu-map on 4096 chairs, coarse atlas
python3 force3.py            # the grouping theorem from the 33 shells
python3 force4.py            # the coarsening identity (1/2)(supertile atlas) = A44
python3 m21.py               # why the literal 21-mark reading fails
python3 search.py            # exhaustive search over all 6^8 markings  (~85 s)
python3 classes.py           # the 18 solutions scored against the drawing (~40 s)
python3 panelmap.py          # Tsiokos's 24 panels -> our 24 facets
python3 export.py            # writes ../marking.json
