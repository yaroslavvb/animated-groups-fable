// chrome-slot.mjs — machine-wide caps on the heavy processes of this project (slots are counted on THIS Mac).
//   chrome  2 slots  a headless Chrome running on this Mac (this Mac allows at most 4 busy workers) — CHROME_SLOTS overrides
//   mini    N slots  one Chrome of the pool on the mini (N = number of pool endpoints; slot i <-> endpoint i)
//   suite   1 slot   a local `node --test` run (remote runs, on a lab box or the mini, need no local slot)
//
//   import { acquireChromeSlot, acquireSlot } from '../tools/chrome-slot.mjs';
//   const release = await acquireChromeSlot();          // = acquireSlot('chrome')
//   try { ... chromium.launch(...) ... } finally { release(); }
//   release.index is the slot number (used to pick the mini endpoint).
// Prefer tools/browser.mjs (openBrowser), which uses the mini pool first and falls back to a local slot.
//
// Slots are directories under the OS temp dir; a slot whose owner process is gone (or older than 15 min) is reclaimed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const POOLS = { chrome: Number(process.env.CHROME_SLOTS || 2), suite: 1, mini: 5 };
const STALE_MS = 15 * 60 * 1000;

function tryTake(DIR, i) {
  const p = path.join(DIR, 'slot-' + i);
  try {
    fs.mkdirSync(p);
    fs.writeFileSync(path.join(p, 'pid'), String(process.pid));
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
    };
    release.index = i;
    process.on('exit', release);
    process.on('SIGINT', () => { release(); process.exit(130); });
    process.on('SIGTERM', () => { release(); process.exit(143); });
    return release;
  } catch {
    try {
      const st = fs.statSync(p);
      let pid = 0;
      try { pid = Number(fs.readFileSync(path.join(p, 'pid'), 'utf8')); } catch { /* being written */ }
      let alive = false;
      if (pid) { try { process.kill(pid, 0); alive = true; } catch { alive = false; } }
      if ((pid && !alive) || Date.now() - st.mtimeMs > STALE_MS) fs.rmSync(p, { recursive: true, force: true });
    } catch { /* slot vanished meanwhile */ }
    return null;
  }
}

/** Wait for a free slot of `pool` (n overrides the pool size). With { wait: false } returns null at once if none is free. */
export async function acquireSlot(pool = 'chrome', n = undefined, { wait = true } = {}) {
  const N = n || POOLS[pool] || 1;
  const DIR = path.join(os.tmpdir(), 'the-folding-slots-' + pool);
  fs.mkdirSync(DIR, { recursive: true });
  let waitedLog = 0;
  const t0 = Date.now();
  for (;;) {
    for (let i = 0; i < N; i++) {
      const r = tryTake(DIR, i);
      if (r) return r;
    }
    if (!wait) return null;
    if (Date.now() - t0 > (waitedLog + 1) * 30000) { waitedLog++; console.error(`[slots] waiting for a free ${pool} slot (${waitedLog * 30} s)`); }
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
  }
}

export function acquireChromeSlot() { return acquireSlot('chrome'); }
