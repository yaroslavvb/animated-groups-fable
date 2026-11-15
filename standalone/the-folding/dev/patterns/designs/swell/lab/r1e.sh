#!/bin/bash
# round 1e: the rule with an even channel: LAMBDA given, the channel found for the target
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/swell/lab
L=dev/patterns/designs/swell/lab/lab.mjs
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lambda=0.5,lean=0.5,tipMin=0.05,kappa=0.4' --out $O/r1e-lam05.png | cut -c1-140
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lambda=0.65,lean=0.5,tipMin=0.05,kappa=0.4' --out $O/r1e-lam065.png | cut -c1-140
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lambda=0.8,lean=0.5,tipMin=0.05,kappa=0.4' --out $O/r1e-lam08.png | cut -c1-140
node $L --ids 'o,2222,442,333' --px 420 --site 1 --set 'lambda=1,lean=0.5,tipMin=0.05,kappa=0.4' --out $O/r1e-lam1.png | cut -c1-140
