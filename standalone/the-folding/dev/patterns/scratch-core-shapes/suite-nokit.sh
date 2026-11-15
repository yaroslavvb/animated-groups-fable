#!/bin/bash
# scratch (core-shapes): test/shapes.test.js on the mini in a copy of the workspace WITHOUT dev/patterns/kit.js (what
# tools/test-all.mjs sends: src/, test/, tools/): the comparison with the kit must be skipped, everything else must pass.
set -uo pipefail
W="$(cd "$(dirname "$0")/../../.." && pwd)"
TAG="run-nokit-$$-$(date +%s)"
R="drive.unsynced/artifacts/the-folding-suite/$TAG"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 mini)
"${SSH[@]}" "mkdir -p ~/$R" || { echo "the mini does not answer" >&2; exit 3; }
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'qa' --exclude 'dist' --exclude 'dev' --exclude 'lab22x' --exclude 'notes' --exclude 'tools/.mini-pool.json' \
  -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/" "mini:$R/" || { echo "rsync failed" >&2; exit 3; }
"${SSH[@]}" "cd ~/$R && NODE=''; for n in \"\$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node\" /opt/homebrew/bin/node /usr/local/bin/node; do if [ -x \"\$n\" ] && \"\$n\" --version >/dev/null 2>&1; then NODE=\"\$n\"; break; fi; done; \
  ls; \"\$NODE\" --test --test-reporter=tap test/shapes.test.js > report.txt 2>&1; code=\$?; grep -n '^not ok\\|^ok .*# SKIP\\|^# \\(tests\\|pass\\|fail\\|skipped\\)' report.txt; cd ~; rm -rf ~/$R; exit \$code"
code=$?
echo "suite-nokit.sh: exit $code"
exit $code
