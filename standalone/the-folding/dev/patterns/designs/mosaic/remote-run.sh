#!/bin/bash
# remote-run.sh — run one node script of this folder on the mini (capped by run_remote: memory, time, nice 19), on a
# copy of src/ and dev/patterns/kit.js and this folder; the copy is removed afterwards. Nothing heavy runs on this Mac.
#   bash dev/patterns/designs/mosaic/remote-run.sh <script.mjs> [args...]
set -uo pipefail
W="$(cd "$(dirname "$0")/../../../.." && pwd)"
TAG="mosaic-$$-$(date +%s)"
R="drive.unsynced/artifacts/the-folding-mosaic-run/${TAG:?}"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 mini)
"${SSH[@]}" "mkdir -p ~/$R/dev/patterns/designs" || { echo "remote-run.sh: the mini does not answer" >&2; exit 3; }
RS=(rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10')
"${RS[@]}" "$W/package.json" "$W/src" "mini:$R/" || exit 3
"${RS[@]}" "$W/dev/patterns/kit.js" "mini:$R/dev/patterns/" || exit 3
"${RS[@]}" --exclude 'rout' "$W/dev/patterns/designs/mosaic" "mini:$R/dev/patterns/designs/" || exit 3
~/git0/flush-util/run_remote --host mini --cd "$R" --max-gb 4 --timeout 900 -- /opt/homebrew/bin/node "dev/patterns/designs/mosaic/$1" "${@:2}"
code=$?
"${SSH[@]}" "rm -rf ~/drive.unsynced/artifacts/the-folding-mosaic-run/${TAG:?}"
exit $code
