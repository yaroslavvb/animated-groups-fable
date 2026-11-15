#!/bin/bash
# round 1d: the weighted gauge, lambda found for the target (margin fixed): how lean, which kappa
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/swell/lab
L=dev/patterns/designs/swell/lab/lab.mjs
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lambda=0,margin=0.1,lean=0.7,tipMin=0.05,kappa=0.5' --out $O/r1d-lean07-k05.png | cut -c1-110
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lambda=0,margin=0.1,lean=0.55,tipMin=0.05,kappa=0.5' --out $O/r1d-lean055-k05.png | cut -c1-110
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lambda=0,margin=0.1,lean=0.55,tipMin=0.05,kappa=0.2' --out $O/r1d-lean055-k02.png | cut -c1-110
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lambda=0,margin=0.1,lean=0.4,tipMin=0.05,kappa=0.3' --out $O/r1d-lean04-k03.png | cut -c1-110
