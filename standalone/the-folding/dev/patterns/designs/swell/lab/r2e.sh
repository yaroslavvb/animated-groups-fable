#!/bin/bash
# round 2e: the comma competes with itself (a slit in the bay), LAMBDA high
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/swell/lab
L=dev/patterns/designs/swell/lab/lab.mjs
node $L --px 330 --cols 6 --site 1 --bare 1 --set 'lambda=1,lean=0.75,kappa=0.4,target=0.57' --out $O/r2e-lam1.png | cut -c1-120
node $L --px 330 --cols 6 --site 1 --bare 1 --set 'lambda=0.8,lean=0.75,kappa=0.4,target=0.57' --out $O/r2e-lam08.png | cut -c1-120
