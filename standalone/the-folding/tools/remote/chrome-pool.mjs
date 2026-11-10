// chrome-pool.mjs — runs ON THE MINI. Starts N headless Chromes as Playwright browser servers, each listening on
// 127.0.0.1 only (reached from the Intel through an ssh -L tunnel, never over the network), writes their endpoints to
// pool.json next to this file, and exits after LIFETIME or after IDLE minutes without any client connected.
//
//   node chrome-pool.mjs [N=5] [lifetimeHours=5] [idleMinutes=45]
//
// Started and restarted by tools/remote/start-pool.sh on the Intel.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PLAYWRIGHT = process.env.PLAYWRIGHT_MJS ||
  path.join(process.env.HOME, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const N = Number(process.argv[2] || 5);
const LIFETIME_MS = Number(process.argv[3] || 5) * 3600e3;
const IDLE_MS = Number(process.argv[4] || 45) * 60e3;
const dir = path.dirname(fileURLToPath(import.meta.url));
const poolFile = path.join(dir, 'pool.json');

const log = (...a) => console.log(new Date().toISOString(), ...a);
const { chromium } = await import(PLAYWRIGHT);
const servers = [];
let stopping = false;

async function stop(why) {
  if (stopping) return;
  stopping = true;
  log('stopping:', why);
  try { fs.rmSync(poolFile, { force: true }); } catch { /* ignore */ }
  await Promise.all(servers.map((s) => s.close().catch(() => {})));
  process.exit(0);
}
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => stop(sig));

for (let i = 0; i < N; i++) {
  const s = await chromium.launchServer({
    executablePath: CHROME, headless: true, host: '127.0.0.1', port: 0,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });
  s.on('close', () => { if (!stopping) stop('browser ' + i + ' closed unexpectedly'); });
  servers.push(s);
}
const info = { pid: process.pid, started: new Date().toISOString(), endpoints: servers.map((s) => s.wsEndpoint()) };
fs.writeFileSync(poolFile, JSON.stringify(info), { mode: 0o600 });
log('pool up:', N, 'browsers');

const ports = servers.map((s) => new URL(s.wsEndpoint()).port);
let lastBusy = Date.now();
setInterval(() => {
  let busy = false;
  try {
    const out = execFileSync('/usr/sbin/netstat', ['-anp', 'tcp'], { encoding: 'utf8' });
    busy = out.split('\n').some((l) => l.includes('ESTABLISHED') && ports.some((p) => l.includes('127.0.0.1.' + p + ' ')));
  } catch { busy = true; }
  if (busy) lastBusy = Date.now();
  if (Date.now() - lastBusy > IDLE_MS) stop('idle');
}, 60e3).unref();
setTimeout(() => stop('lifetime'), LIFETIME_MS).unref();
setInterval(() => {}, 1 << 30); // keep the event loop alive
