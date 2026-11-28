#!/bin/bash
# closeups.sh: the Surface pane of site/index.html with the final solver, a few states, two views each.
set -u
C=/Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/dev/integration/closeups.mjs
OUT=/Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/dev/final/shots
run() { node "$C" "$@" 2>&1 | tail -2; }
run f-3333 '#k=3333' --az -20,70 --both
run f-3333-tw02 '#k=3333&tw=0.2' --az -20,70
run f-2345 '#k=2345' --az -20,160
run f-2223 '#k=2223' --az -20,160
run f-4444 '#k=4444' --az -20,70
mv /Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/dev/integration/shots/close-f-* "$OUT"/
ls "$OUT"
