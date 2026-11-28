#!/bin/bash
set -u
C=/Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/dev/integration/closeups.mjs
S=/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/common/page-shot.mjs
SITE=file:///Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/site/index.html
OUT=/Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/dev/final/shots
node "$C" j1-3333 '#k=3333&tw=0.15&j=1' --az 70 2>&1 | tail -1
node "$C" j2-3333 '#k=3333&tw=0.15&j=2' --az 70 2>&1 | tail -1
node "$C" flip-3333 '#k=3333&tw=0.15' --az 70 --pre "window.__pqrs.activate('02|13'); await new Promise(r=>setTimeout(r,1500)); return window.__pqrs.state().hash;" 2>&1 | tail -2
node "$C" e-2222 '#k=2222&tw=0.25' --az 70 2>&1 | tail -1
mv /Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/dev/integration/shots/close-j1-3333-* /Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/dev/integration/shots/close-j2-3333-* /Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/dev/integration/shots/close-flip-3333-* /Users/solid/git/agf-pqrs-pillows/standalone/pqrs-pillows/dev/integration/shots/close-e-2222-* "$OUT"/
node "$S" "$SITE#k=2345&tw=0.12" "$OUT/page-desk-2345.png" --size 1280x900 --wait 3500 2>&1 | tail -1
node "$S" "$SITE#k=3333&tw=0.15" "$OUT/page-phone-3333.png" --phone --full --wait 3500 2>&1 | tail -1
