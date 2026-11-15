#!/bin/bash
# round 5: the kaleidoscopes, snails (6-point spines, no lobes) and 4-point spines with one lobe, round-5 penalties
cd "$(dirname "$0")/../.."
W='{"bareHinge":6,"wiggle":1.5,"loop":0.5,"bareMax":0.44}'
for id in '*333' '*442' '*632'; do
  /opt/homebrew/bin/node lab/search.mjs --id "$id" --samples 450 --top 5 --iters 600 --h 0.022 --pts 6 --lobes 0 --snail 0.6 --cover 0.55 --all 1 --seed 5 --w "$W"
  /opt/homebrew/bin/node lab/search.mjs --id "$id" --samples 450 --top 5 --iters 600 --h 0.022 --pts 4 --lobes 1 --cover 0.55 --all 1 --seed 6 --w "$W"
done
