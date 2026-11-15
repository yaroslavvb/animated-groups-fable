// dev/patterns/scratch-review-webkit/fp-lib.mjs — the motif of every print the page shows, in one engine, for comparing
// engines (the reviewer, 15 Nov 2026: Paisley's *632 and o looked different in WebKit). Also the Math functions the
// pattern finds use, on fixed inputs, to see whether the engines' libm differ.
//   runFp({ browser, url, out, engine }) -> writes out/fp-<engine>.json
import fs from 'node:fs';
import path from 'node:path';

export const ALL = ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
export const PATS = ['paisley', 'soft', 'tomoe', 'comma', 'checker', 'rings'];

const MOTIFS = ([ids, pats]) => {
  const F = window.__folding, out = {}, ms = {};
  for (const p of pats) {
    F.setPattern(p);
    for (const id of ids) {
      F.warmer.stop();
      const t0 = performance.now();
      F.setGroup(id);
      ms[p + ' ' + id] = performance.now() - t0;
      F.warmer.stop();
      const pr = F.scene().print;
      if (!pr) { out[p + ' ' + id] = null; continue; }
      if (pr.kind === 'shapes') out[p + ' ' + id] = { kind: pr.kind, verts: pr.verts, netArea: pr.netArea, info: pr.info, polys: pr.polys.map((P) => ({ hole: !!P.hole, pts: Array.from(P.pts) })) };
      else out[p + ' ' + id] = { kind: pr.kind, name: pr.name, forms: pr.forms || null, origin: pr.origin || null, a: pr.a || null, b: pr.b || null, width: pr.width || null };
    }
  }
  return { out, ms };
};

// the Math functions of the finds on fixed inputs (a little LCG): their results, exactly
const MATH = (n) => {
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const res = {};
  const fns = {
    cos: (x) => Math.cos(x * 20 - 10), sin: (x) => Math.sin(x * 20 - 10), atan2: (x, y) => Math.atan2(y * 2 - 1, x * 2 - 1),
    acos: (x) => Math.acos(x * 2 - 1), pow: (x, y) => Math.pow(x * 3, y * 4), hypot: (x, y) => Math.hypot(x * 3 - 1.5, y * 3 - 1.5),
    sqrt: (x) => Math.sqrt(x * 10), exp: (x) => Math.exp(x * 20 - 10), log: (x) => Math.log(x * 10 + 1e-3), atan: (x) => Math.atan(x * 20 - 10),
    asin: (x) => Math.asin(x * 2 - 1), tan: (x) => Math.tan(x * 3 - 1.5), cbrt: (x) => Math.cbrt(x * 10 - 5),
  };
  for (const [k, f] of Object.entries(fns)) { s = 12345; const a = []; for (let i = 0; i < n; i++) a.push(f(rnd(), rnd())); res[k] = a; }
  return res;
};

export async function runFp({ browser, url, out, engine }) {
  fs.mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const log = [];
  page.on('console', (m) => log.push([m.type(), m.text().slice(0, 300)]));
  page.on('pageerror', (e) => log.push(['pageerror', String(e && e.message).slice(0, 300)]));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  const motifs = await page.evaluate(MOTIFS, [ALL, PATS]);
  const math = await page.evaluate(MATH, 4000);
  const ua = await page.evaluate(() => navigator.userAgent);
  fs.writeFileSync(path.join(out, `fp-${engine}.json`), JSON.stringify({ engine, version: browser.version(), ua, motifs, math, log }));
  await ctx.close();
  return { n: Object.keys(motifs.out).length };
}
