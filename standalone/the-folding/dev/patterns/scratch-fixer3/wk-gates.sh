#!/bin/bash
# dev/patterns/scratch-fixer3/wk-gates.sh — the fixer (15 Nov 2026): wait for the M5 (it drops off the tailnet now and
# then; up to 40 minutes), then the WebKit layout gate on the built page (dev/recut/webkit-layout.sh), then every print's
# motif in WebKit (wk-fp.sh). Logs in OUT/fixer3/. Run it with run_in_background.
set -u
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer3
up() { ssh -o ConnectTimeout=10 -o BatchMode=yes m5 true 2>/dev/null; }
for i in $(seq 1 120); do if up; then break; fi; sleep 20; done
up || { echo "$(date +%H:%M:%S) the M5 never answered"; exit 2; }
echo "$(date +%H:%M:%S) the M5 answers"
cd "$W" || exit 1
bash dev/recut/webkit-layout.sh > "$OUT/gate-webkit-dist.txt" 2>&1
echo "$(date +%H:%M:%S) webkit-layout.sh: exit $?"
tail -4 "$OUT/gate-webkit-dist.txt"
bash dev/patterns/scratch-fixer3/wk-fp.sh > "$OUT/wk-fp.log" 2>&1
echo "$(date +%H:%M:%S) wk-fp.sh: exit $?"
tail -3 "$OUT/wk-fp.log"
