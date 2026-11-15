#!/bin/bash
# bash dev/remote.sh <jobs.txt> [parallel]
# Runs each line of <jobs.txt> (the arguments of one `node` call, run in the design folder, e.g.
#   dev/search.mjs *442 --ms 90000 --out dev/out/s442.json )
# on aifoundry1, [parallel] at a time (default 8), under run_remote's memory and time caps; then copies the remote
# dev/out/ back to ~/drive.unsynced/artifacts/the-folding-patterns/tomoe/polish/out/. Nothing heavy runs on this Mac.
set -uo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
W="$(cd "$HERE/../../../.." && pwd)"
HOST=aifoundry1
R=tomoe-search
P="${2:-8}"
OUT="$HOME/drive.unsynced/artifacts/the-folding-patterns/tomoe/polish/out"
E="ssh -o BatchMode=yes -o ConnectTimeout=10"
$E $HOST "mkdir -p $R/W/src $R/W/dev/patterns/designs/tomoe/dev/out" || { echo "remote.sh: $HOST does not answer" >&2; exit 3; }
rsync -a --delete -e "$E" "$W/src/" "$HOST:$R/W/src/" || exit 3
rsync -a -e "$E" "$W/dev/patterns/kit.js" "$HOST:$R/W/dev/patterns/kit.js" || exit 3
rsync -a --delete --exclude 'dev/out' --exclude 'dev/r1' -e "$E" "$HERE/" "$HOST:$R/W/dev/patterns/designs/tomoe/" || exit 3
rsync -a -e "$E" "$1" "$HOST:$R/jobs.txt" || exit 3
"$HOME/git0/flush-util/run_remote" --host "$HOST" --max-gb 6 --timeout 900 -- bash "$R/W/dev/patterns/designs/tomoe/dev/remote-run.sh" "$P"
code=$?
mkdir -p "$OUT"
rsync -a -e "$E" "$HOST:$R/W/dev/patterns/designs/tomoe/dev/out/" "$OUT/" || true
echo "remote.sh: exit $code; results in $OUT"
exit $code
