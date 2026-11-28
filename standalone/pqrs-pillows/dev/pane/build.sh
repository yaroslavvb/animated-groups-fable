#!/bin/bash
# build.sh — the pane owner's harness page, with the shared build, into dev/pane/index.html
cd /Users/solid/git/agf-pqrs-pillows/standalone/classification-of-surfaces || exit 1
node build.mjs --template ../pqrs-pillows/dev/pane/harness.template.html --entry ../pqrs-pillows/dev/pane/harness.js \
  --css src/styles.css,../two-features-two-handles/src/page.css,../pqrs-pillows/dev/pane/harness.css \
  --out ../pqrs-pillows/dev/pane/index.html
