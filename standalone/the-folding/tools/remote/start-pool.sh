#!/bin/bash
# start-pool.sh — (re)start the pool of headless Chromes on the mini and fetch its endpoints into tools/.mini-pool.json.
#   bash tools/remote/start-pool.sh [N=5] [lifetimeHours=5] [idleMinutes=45]
# The pool listens on the mini's 127.0.0.1 only; tools/browser.mjs reaches it through an ssh tunnel per run.
set -euo pipefail
W="$(cd "$(dirname "$0")/../.." && pwd)"
N="${1:-5}"; LIFE="${2:-5}"; IDLE="${3:-45}"
R="drive.unsynced/artifacts/${POOL_DIR:-the-folding-remote}"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=8 mini)

"${SSH[@]}" "mkdir -p ~/$R"
scp -q -o BatchMode=yes "$W/tools/remote/chrome-pool.mjs" "mini:$R/chrome-pool.mjs"
"${SSH[@]}" "cd ~/$R && NODE=\"\"; for n in "\$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" /opt/homebrew/bin/node /usr/local/bin/node; do if [ -x \"\$n\" ] && \"\$n\" --version >/dev/null 2>&1; then NODE=\"\$n\"; break; fi; done; if [ -f pool.pid ]; then kill \$(cat pool.pid) 2>/dev/null || true; fi; rm -f pool.json; \
  nohup "\$NODE" chrome-pool.mjs $N $LIFE $IDLE > pool.log 2>&1 < /dev/null & echo \$! > pool.pid; \
  for i in \$(seq 1 80); do [ -s pool.json ] && break; sleep 0.5; done; cat pool.json" > "$W/tools/.mini-pool.json"
chmod 600 "$W/tools/.mini-pool.json"
if [ ! -s "$W/tools/.mini-pool.json" ]; then
  echo "pool did not come up; log:" >&2
  "${SSH[@]}" "tail -20 ~/$R/pool.log" >&2
  exit 1
fi
node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log("mini pool: pid", p.pid, "-", p.endpoints.length, "browsers, started", p.started)' "$W/tools/.mini-pool.json"
