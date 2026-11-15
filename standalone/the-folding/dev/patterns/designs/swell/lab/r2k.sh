#!/bin/bash
# round 2k: the general rule. V1 one LAMBDA; V2 heads fill their room (lamHead 1), wide channel beside heads; V3 softer
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/swell/lab
L=dev/patterns/designs/swell/lab/lab.mjs
node $L --px 330 --cols 6 --site 1 --bare 1 --set 'solve=wHead,lamHead=1,lamTail=0.6,lamBay=0.3,wTail=0.07' --out $O/r2k-v2.png | cut -c1-175
node $L --px 330 --cols 6 --site 1 --bare 1 --set 'solve=wHead,lamHead=0.85,lamTail=0.6,lamBay=0.35,wTail=0.07' --out $O/r2k-v3.png | cut -c1-175
