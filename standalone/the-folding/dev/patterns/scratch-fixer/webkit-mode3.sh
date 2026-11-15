#!/bin/bash
# webkit-mode3.sh (fixer, 13 Nov 2026) — the sources to the M5, webkit-mode3.mjs there (WebKit), the pictures back to
# OUT/fixer/webkit/, the copy on the M5 removed.   bash dev/patterns/scratch-fixer/webkit-mode3.sh
set -u
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer/webkit
R=/tmp/folding-fixer-webkit
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 m5)
mkdir -p "$O"
"${SSH[@]}" "mkdir -p $R/dev/patterns/designs" || exit 3
rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/src" "m5:$R/" || exit 3
rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/dev/patterns/app.html" "m5:$R/dev/patterns/" || exit 3
rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/dev/patterns/designs/demo" "$W/dev/patterns/designs/stress" "m5:$R/dev/patterns/designs/" || exit 3
"${SSH[@]}" "cd $R && ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --input-type=module -" < "$W/dev/patterns/scratch-fixer/webkit-mode3.mjs"
code=$?
rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "m5:$R/shots/" "$O/" || true
"${SSH[@]}" "rm -rf /tmp/folding-fixer-webkit"
echo "webkit-mode3.sh: exit $code; pictures in $O"
exit $code
