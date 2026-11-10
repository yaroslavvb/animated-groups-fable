#!/bin/bash
# add-browsers.sh — start a SECOND pool of headless Chromes on the mini and append its endpoints to tools/.mini-pool.json,
# without touching the browsers already in use (slots 0..N-1 keep their endpoints; the new ones become slots N..).
#   bash tools/remote/add-browsers.sh [count=3] [lifetimeHours=5] [idleMinutes=45]
# start-pool.sh later rewrites .mini-pool.json with its own pool only; the extra pool then idles out by itself.
set -euo pipefail
W="$(cd "$(dirname "$0")/../.." && pwd)"
N="${1:-3}"; LIFE="${2:-5}"; IDLE="${3:-45}"
R="drive.unsynced/artifacts/the-folding-remote-extra"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=8 mini)
"${SSH[@]}" "mkdir -p ~/$R"
scp -q -o BatchMode=yes "$W/tools/remote/chrome-pool.mjs" "mini:$R/chrome-pool.mjs"
"${SSH[@]}" "cd ~/$R && NODE=\"\"; for n in "\$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" /opt/homebrew/bin/node /usr/local/bin/node; do if [ -x \"\$n\" ] && \"\$n\" --version >/dev/null 2>&1; then NODE=\"\$n\"; break; fi; done; if [ -f pool.pid ]; then kill \$(cat pool.pid) 2>/dev/null || true; fi; rm -f pool.json; \
  nohup "\$NODE" chrome-pool.mjs $N $LIFE $IDLE > pool.log 2>&1 < /dev/null & echo \$! > pool.pid; \
  for i in \$(seq 1 80); do [ -s pool.json ] && break; sleep 0.5; done; cat pool.json" > "$W/tools/.mini-pool-extra.json"
node -e '
const fs = require("fs");
const [main, extra] = process.argv.slice(1);
const a = JSON.parse(fs.readFileSync(main, "utf8")), b = JSON.parse(fs.readFileSync(extra, "utf8"));
const base = a.endpoints.slice(0, a.baseCount || a.endpoints.length);
const merged = { ...a, baseCount: base.length, extraPid: b.pid, endpoints: base.concat(b.endpoints) };
fs.writeFileSync(main + ".tmp", JSON.stringify(merged), { mode: 0o600 });
fs.renameSync(main + ".tmp", main);
console.log("mini pool now", merged.endpoints.length, "browsers (" + base.length + " + " + b.endpoints.length + " extra)");
' "$W/tools/.mini-pool.json" "$W/tools/.mini-pool-extra.json"
