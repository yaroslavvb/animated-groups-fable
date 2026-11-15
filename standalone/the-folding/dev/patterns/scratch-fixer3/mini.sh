#!/bin/bash
# dev/patterns/scratch-fixer3/mini.sh — the fixer's (15 Nov 2026) way to run ONE node script on the mini (arm64, the
# V8 of Chrome on the mini and of the suite), in a fresh copy of the workspace as it is now; whatever the script writes
# to ../out (beside the copy) comes back to OUT/fixer3/mini-out/. The copy is removed afterwards.
#   bash dev/patterns/scratch-fixer3/mini.sh <script.mjs> [args ...]        (run in the copy's root)
set -uo pipefail
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer3/mini-out
TAG="fx3-$$-$(date +%s)"
R="drive.unsynced/artifacts/the-folding-suite/$TAG"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 mini)
mkdir -p "$OUT"
"${SSH[@]}" "mkdir -p ~/$R/W ~/$R/out" || { echo "mini.sh: the mini does not answer" >&2; exit 3; }
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'qa' --exclude 'dist' --exclude 'tools/.mini-pool.json' \
  --exclude 'dev/patterns/scratch-review-*' -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/" "mini:$R/W/" || { echo "mini.sh: rsync failed" >&2; exit 3; }
ARGS=""
for a in "$@"; do ARGS="$ARGS '$a'"; done
"${SSH[@]}" "cd ~/$R/W && NODE=''; for n in \"\$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node\" /opt/homebrew/bin/node; do if [ -x \"\$n\" ] && \"\$n\" --version >/dev/null 2>&1; then NODE=\"\$n\"; break; fi; done; echo \"mini: \$(uname -m) node \$(\"\$NODE\" --version)\"; \"\$NODE\" $ARGS; exit \$?"
code=$?
rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "mini:$R/out/" "$OUT/" 2>/dev/null || true
"${SSH[@]}" "rm -rf ~/$R"
echo "mini.sh: exit $code"
exit $code
