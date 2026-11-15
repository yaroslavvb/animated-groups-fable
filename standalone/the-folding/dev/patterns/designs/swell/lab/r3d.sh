#!/bin/bash
# round 3d: back to one LAMBDA (the comma reads as a comma), judged WITHOUT the comma's outline drawn over it
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/swell/lab
L=dev/patterns/designs/swell/lab/lab.mjs
node $L --px 330 --cols 6 --bare 1 --out $O/r3d-far0.png | cut -c1-150
node $L --px 330 --cols 6 --bare 1 --set 'far=0.2' --out $O/r3d-far02.png | cut -c1-150
