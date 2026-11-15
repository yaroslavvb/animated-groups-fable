#!/bin/bash
# round 6: trim the bare disc of **, *2222 and 442 (0.46-0.48) without changing their look: local search, small steps
cd "$(dirname "$0")/../.."
W='{"bareHinge":8,"wiggle":1.5,"loop":0.5,"bareMax":0.42}'
/opt/homebrew/bin/node lab/search.mjs --id '**' --init lab/r5/init-d.json --local 1 --stepScale 0.3 --iters 700 --h 0.02 --pts 4 --all 1 --seed 7 --w "$W"
/opt/homebrew/bin/node lab/search.mjs --id '*2222' --init lab/r5/init-d.json --local 1 --stepScale 0.3 --iters 700 --h 0.02 --pts 6 --all 1 --seed 7 --w "$W"
/opt/homebrew/bin/node lab/search.mjs --id '442' --init lab/r5/init-d.json --local 1 --stepScale 0.3 --iters 700 --h 0.02 --pts 4 --all 1 --seed 7 --w "$W"
