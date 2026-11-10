// browser.mjs — one door to a headless Chrome for every tool and script of this project.
//
//   import { openBrowser } from '../tools/browser.mjs';
//   const B = await openBrowser();                 // { browser, where: 'mini'|'local', url(relPath), close() }
//   try {
//     const page = await B.browser.newPage({ viewport: { width: 1280, height: 720 } });
//     await page.goto(B.url('dist/index.html'));
//     ...
//   } finally { await B.close(); }
//
// Where it runs: the pool of Chromes on the mini (tools/remote/start-pool.sh) when one of its slots is free, else a
// Chrome on this Mac (2 slots machine-wide). Pages are served from THIS Mac's files by a small static server, so they
// are always current; the mini's Chrome reaches that server through an ssh reverse tunnel, and this script reaches the
// mini's Chrome through a forward tunnel (the two machines' firewalls block direct connections; nothing listens on
// the network). FOLDING_BROWSER=local forces this Mac, FOLDING_BROWSER=mini refuses to fall back.

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acquireSlot } from './chrome-slot.mjs';

export const PLAYWRIGHT = process.env.PLAYWRIGHT_MJS ||
  '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
export const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const CHROME_ARGS = ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'];

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');
const POOL_FILE = path.join(here, '.mini-pool.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

function staticServer(root) {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const c = net.connect(port, '127.0.0.1');
    c.once('connect', () => { c.destroy(); resolve(true); });
    c.once('error', () => resolve(false));
  });
}

function readPool() {
  try {
    const p = JSON.parse(fs.readFileSync(POOL_FILE, 'utf8'));
    return p && Array.isArray(p.endpoints) && p.endpoints.length ? p : null;
  } catch { return null; }
}

async function tunnel(remoteWsPort, localServerPort) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const L = await freePort();
    const R = 20000 + Math.floor(Math.random() * 30000);
    const ssh = spawn('ssh', ['-N', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ConnectTimeout=8',
      '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
      '-L', `${L}:127.0.0.1:${remoteWsPort}`, '-R', `${R}:127.0.0.1:${localServerPort}`, 'mini'],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '', exited = false;
    ssh.stderr.on('data', (d) => { err += d; });
    ssh.on('exit', () => { exited = true; });
    const t0 = Date.now();
    while (!exited && Date.now() - t0 < 10000) {
      if (await canConnect(L)) return { ssh, L, R };
      await new Promise((r) => setTimeout(r, 100));
    }
    try { ssh.kill(); } catch { /* gone */ }
    if (!/remote port forwarding failed|Address already in use/i.test(err)) throw new Error('ssh tunnel failed: ' + err.trim().slice(0, 200));
  }
  throw new Error('ssh tunnel: no free remote port');
}

export async function openBrowser({ root = ROOT, where = process.env.FOLDING_BROWSER || 'auto', quiet = false } = {}) {
  const say = (m) => { if (!quiet) console.error('[browser] ' + m); };
  const { server, port } = await staticServer(root);
  const { chromium } = await import(PLAYWRIGHT);

  if (where !== 'local') {
    const pool = readPool();
    const release = pool ? await acquireSlot('mini', pool.endpoints.length, { wait: where === 'mini' }) : null;
    if (release) {
      let tun = null;
      try {
        const ep = new URL(pool.endpoints[release.index]);
        tun = await tunnel(ep.port, port);
        const browser = await chromium.connect(`ws://127.0.0.1:${tun.L}${ep.pathname}`, { timeout: 15000 });
        // the forward tunnel is up; make sure the reverse one serves pages before handing the browser out
        const base = `http://127.0.0.1:${tun.R}/`;
        const ctx = await browser.newContext();
        let ok = false;
        for (let i = 0; i < 40 && !ok; i++) {
          try { ok = (await ctx.request.get(base + 'package.json', { timeout: 2000 })).ok(); } catch { /* not yet */ }
          if (!ok) await new Promise((r) => setTimeout(r, 150));
        }
        await ctx.close();
        if (!ok) throw new Error('reverse tunnel did not serve');
        let closed = false;
        const t = tun;
        return {
          browser, where: 'mini', url: (rel = '') => base + String(rel).replace(/^\//, ''),
          close: async () => {
            if (closed) return; closed = true;
            try { await browser.close(); } catch { /* gone */ }
            try { t.ssh.kill(); } catch { /* gone */ }
            server.close(); release();
          },
        };
      } catch (e) {
        if (tun) { try { tun.ssh.kill(); } catch { /* gone */ } }
        release();
        if (where === 'mini') { server.close(); throw e; }
        say('mini pool unavailable (' + String(e.message || e).slice(0, 160) + '); using a Chrome on this Mac');
      }
    } else if (where === 'mini') {
      server.close();
      throw new Error('no mini pool: run bash tools/remote/start-pool.sh');
    }
  }

  const release = await acquireSlot('chrome');
  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: CHROME_ARGS });
  } catch (e) { release(); server.close(); throw e; }
  let closed = false;
  return {
    browser, where: 'local', url: (rel = '') => `http://127.0.0.1:${port}/` + String(rel).replace(/^\//, ''),
    close: async () => {
      if (closed) return; closed = true;
      try { await browser.close(); } catch { /* gone */ }
      server.close(); release();
    },
  };
}
