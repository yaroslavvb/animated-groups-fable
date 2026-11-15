#!/bin/bash
# polish/remote.sh <jobs file> <out dir> [host] — run the lab's searches on a lab box (aifoundry1 by default), not on
# the Intel: copies src/ and this design's folder there, runs every line of <jobs file> (one shell command each, run
# from the blobs folder, its stdout into <out dir>/<n>.txt) at most 12 at a time under run_remote (memory and time
# capped, nice 19), brings <out dir> back and removes the copy. polish-soft, 14 Nov 2026.
set -uo pipefail
JOBS="$1"; OUT="$2"; H="${3:-aifoundry1}"
BLOBS="$(cd "$(dirname "$0")/.." && pwd)"
W="$(cd "$BLOBS/../../../.." && pwd)"
TAG="ps-$$-$(date +%s)"
R="polish-soft/$TAG"
SSHO='ssh -o BatchMode=yes -o ConnectTimeout=10'
$SSHO "$H" "mkdir -p ~/$R/W/dev/patterns/designs/blobs ~/$R/out" < /dev/null || { echo "remote.sh: $H does not answer" >&2; exit 3; }
rsync -a -e "$SSHO" "$W/src/" "$H:$R/W/src/" || exit 3
rsync -a -e "$SSHO" "$W/package.json" "$H:$R/W/package.json" || exit 3
rsync -a -e "$SSHO" "$W/dev/patterns/kit.js" "$H:$R/W/dev/patterns/kit.js" || exit 3
rsync -a -e "$SSHO" --exclude '*.png' "$BLOBS/" "$H:$R/W/dev/patterns/designs/blobs/" || exit 3
rsync -a -e "$SSHO" "$JOBS" "$H:$R/jobs.txt" || exit 3
rsync -a -e "$SSHO" "$BLOBS/polish/driver.sh" "$H:$R/driver.sh" || exit 3
"$HOME/git0/flush-util/run_remote" --host "$H" --max-gb 8 --timeout "${PS_TIMEOUT:-1200}" --cd "$R" -- /bin/bash driver.sh < /dev/null
code=$?
mkdir -p "$OUT"
rsync -a -e "$SSHO" "$H:$R/out/" "$OUT/" || echo "remote.sh: copy back failed" >&2
rsync -a -e "$SSHO" "$H:$R/jobs.numbered" "$OUT/jobs.numbered" || true
$SSHO "$H" "rm -rf ~/$R" < /dev/null
echo "remote.sh: exit $code; results in $OUT"
exit $code
