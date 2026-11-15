#!/bin/bash
# round 1b: how fat should the comma be before it swells? lean x (lambda free | lambda fixed)
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/swell/lab
L=dev/patterns/designs/swell/lab/lab.mjs
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lean=0.7,tipMin=0.12' --out $O/r1b-lean07.png | cut -c1-150
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lean=0.45,tipMin=0.12' --out $O/r1b-lean045.png | cut -c1-150
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lean=0.7,tipMin=0.12,lambda=0.7' --out $O/r1b-lean07-lam07.png | cut -c1-150
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lean=0.45,tipMin=0.12,lambda=0.8' --out $O/r1b-lean045-lam08.png | cut -c1-150
