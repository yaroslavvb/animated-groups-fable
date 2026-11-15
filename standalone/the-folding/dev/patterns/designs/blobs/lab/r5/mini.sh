#!/bin/bash
# lab/r5/mini.sh <out file> <script under lab/> [args...] — copy what the lab needs to the mini and run the script there
# under run_remote (memory and time capped, nice); its stdout goes to <out file>, its stderr to the terminal.
#   bash lab/r5/mini.sh /path/out.txt search.mjs --id 632 --init lab/r5/v632c.json --local 1
# (The lab boxes did not answer on 13 Nov 2026 evening; nothing heavy runs on the Intel.) Paths given to the script are
# relative to the blobs folder, which is the working directory on the mini.
set -uo pipefail
LAB="$(cd "$(dirname "$0")/.." && pwd)"
BLOBS="$(cd "$LAB/.." && pwd)"
W="$(cd "$BLOBS/../../../.." && pwd)"
R="drive.unsynced/artifacts/the-folding-blobs-lab/run-$$-$(date +%s)"          # a copy of its own per run
OUT="$1"; shift
SCRIPT="$1"; shift
SSHO='ssh -o BatchMode=yes -o ConnectTimeout=10'
$SSHO mini "mkdir -p ~/$R/src ~/$R/dev/patterns/designs/blobs" < /dev/null || { echo "mini.sh: the mini does not answer" >&2; exit 3; }
rsync -a --delete -e "$SSHO" "$W/src/" "mini:$R/src/" || exit 3
rsync -a -e "$SSHO" "$W/package.json" "mini:$R/package.json" || exit 3
rsync -a -e "$SSHO" "$W/dev/patterns/kit.js" "mini:$R/dev/patterns/kit.js" || exit 3
rsync -a --delete -e "$SSHO" "$BLOBS/" "mini:$R/dev/patterns/designs/blobs/" || exit 3
mkdir -p "$(dirname "$OUT")"
RUN=(/opt/homebrew/bin/node "lab/$SCRIPT")
case "$SCRIPT" in *.sh) RUN=(/bin/bash "lab/$SCRIPT") ;; esac
"$HOME/git0/flush-util/run_remote" --host mini --max-gb "${BLOBS_GB:-2}" --timeout "${BLOBS_TIMEOUT:-900}" --cd "$R/dev/patterns/designs/blobs" -- \
  "${RUN[@]}" "$@" > "$OUT" < /dev/null
code=$?
$SSHO mini "rm -rf ~/$R" < /dev/null
echo "mini.sh: exit $code, $(wc -c < "$OUT") bytes in $OUT"
exit $code
