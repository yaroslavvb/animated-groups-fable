#!/bin/bash
# round 3e: how much comma, how much swell (no outline drawn over the marks)
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/swell/lab
L=dev/patterns/designs/swell/lab/lab.mjs
node $L --px 330 --cols 6 --bare 1 --set 'lean=1,target=0.52' --out $O/r3e-A.png | cut -c1-120
node $L --px 330 --cols 6 --bare 1 --set 'lean=0.85,target=0.54' --out $O/r3e-B.png | cut -c1-120
