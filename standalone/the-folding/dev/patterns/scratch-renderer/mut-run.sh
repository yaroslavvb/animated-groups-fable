#!/bin/bash
# scratch: run the two renderer test files of every tree under mut/ on the mini (as dev/patterns/suite.sh does: a copy
# of this workspace, removed afterwards). Prints, per planted fault, how many tests fail (it must be at least one).
set -uo pipefail
W="$(cd "$(dirname "$0")/../../.." && pwd)"
TAG="mut-$$-$(date +%s)"
R="drive.unsynced/artifacts/the-folding-suite/$TAG"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 mini)
"${SSH[@]}" "mkdir -p ~/$R" || { echo "the mini does not answer" >&2; exit 3; }
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'qa' --exclude 'dist' --exclude 'tools/.mini-pool.json' \
  -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/" "mini:$R/" || { echo "rsync failed" >&2; exit 3; }
"${SSH[@]}" "cd ~/$R && NODE=''; for n in \"\$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node\" /opt/homebrew/bin/node /usr/local/bin/node; do if [ -x \"\$n\" ] && \"\$n\" --version >/dev/null 2>&1; then NODE=\"\$n\"; break; fi; done; \
  for d in dev/patterns/scratch-renderer/mut/*/; do \"\$NODE\" --test --test-reporter=tap \"\${d}test/render3d.test.js\" \"\${d}test/render3d-dom.test.js\" > r.txt 2>&1; echo \"\$(grep -c '^not ok' r.txt) failing  \$(basename \$d)  \$(grep '^not ok' r.txt | head -n 2 | cut -c1-110 | tr '\n' '|')\"; done; cd ~; rm -rf ~/$R"
