// webkit-mode3.mjs (fixer, 13 Nov 2026) — the renderer's print mode 3 (a shape print's distance texture) in WebKit,
// Safari's engine, on the SOURCES (the app review: "the mode 3 shader was never compiled in WebKit, and it sits in the
// surface shader that every pattern shares"). WebKit is on the M5, not on the mini. The files go there first, then this
// script runs there on stdin; it serves the copy itself (127.0.0.1) and writes pictures to the copy's shots/ folder:
//   rsync -a src dev/patterns/app.html dev/patterns/designs/demo dev/patterns/designs/stress  (see webkit-mode3.sh)
//   ssh m5 'cd /tmp/folding-fixer-webkit && ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --input-type=module -' < this file
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const { webkit } = await import(process.env.HOME + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root = process.cwd(), out = path.join(root, 'shots');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname), f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (err, buf) => { if (err) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(buf); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
let browser, bad = 0;
try {
  browser = await webkit.launch();
  for (const [name, vp, dpr] of [['laptop', { width: 1180, height: 760 }, 1], ['phone', { width: 390, height: 780 }, 2]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    const msgs = [];
    page.on('pageerror', (e) => msgs.push('PAGE ERROR ' + String(e && e.message).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(m.type().toUpperCase() + ' ' + m.text().slice(0, 300)); });
    await page.goto(base + 'dev/patterns/app.html?designs=demo,stress#g=333&pat=demo', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__designs && window.__designs.ready && window.__folding && window.__folding.ready, null, { timeout: 60000 });
    for (const [g, pat, t] of [['333', 'demo', 0], ['*632', 'demo', 0.6], ['o', 'stress', 0.6], ['22x', 'demo', 1], ['333', 'checker', 0.6], ['*632', 'rings', 0.6]]) {
      const st = await page.evaluate(([gid, p, tt]) => {
        const F = window.__folding;
        F.setGroup(gid); F.setPattern(p); F.setT(tt);
        const s = F.getState(), R = F.renderer, gl = R.gl;
        // the surface program: its link status, and what the GL says
        let program = null;
        try { const pr = gl && gl.getParameter(gl.CURRENT_PROGRAM); program = pr ? gl.getProgramParameter(pr, gl.LINK_STATUS) : null; } catch (e) { program = 'error ' + e.message; }
        const px = new Uint8Array(4);
        if (gl) gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { g: gid, pat: s.pattern, kind: s.printKind, print: s.print, errors: s.errors, list: F.errors.slice(-3), webgl: !!gl, ok: R.ok, uploads: R.stats.printUploads,
          glError: gl ? gl.getError() : null, program, centre: Array.from(px), ua: navigator.userAgent.slice(-40) };
      }, [g, pat, t]);
      await page.waitForTimeout(300);
      const file = path.join(out, `${name}-${pat}-${g.replace(/\*/g, 's')}-t${String(t).replace('.', '')}.png`);
      await page.screenshot({ path: file });
      console.log(name + ' ' + JSON.stringify(st));
      if (st.errors || !st.webgl || st.glError || (pat !== 'checker' && pat !== 'rings' && st.kind !== 'shapes')) bad++;
    }
    for (const m of msgs) console.log(name + ' ' + m);
    if (msgs.some((m) => !m.startsWith('WARNING'))) bad++;
    await ctx.close();
  }
} finally { if (browser) await browser.close(); server.close(); }
console.log(bad ? `webkit-mode3: ${bad} problems` : 'webkit-mode3: all clean');
