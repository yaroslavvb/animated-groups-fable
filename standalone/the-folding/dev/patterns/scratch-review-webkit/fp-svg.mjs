// dev/patterns/scratch-review-webkit/fp-svg.mjs — Paisley's motif as Chrome makes it (filled) and as WebKit makes it
// (red outline), and node on the Intel (x86, blue dashes) where it differs from Chrome: one panel per group, as a PNG.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-webkit/fp-svg.mjs [key]
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser } from '../../../tools/browser.mjs';
import { GROUPS } from '../../../src/groups.js';

const OUT = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit', key = process.argv[2] || 'paisley';
const ld = (e) => JSON.parse(fs.readFileSync(path.join(OUT, 'fp', `fp-${e}.json`), 'utf8')).motifs.out;
const C = ld('chromium'), K = ld('webkit'), N = ld('node');
const path2 = (polys) => polys.map((P) => { let d = ''; for (let i = 0; i < P.pts.length; i += 2) d += (i ? 'L' : 'M') + P.pts[i].toFixed(4) + ' ' + (-P.pts[i + 1]).toFixed(4); return d + 'Z'; }).join(' ');
let html = '<!doctype html><meta charset="utf-8"><style>body{margin:0;font:14px system-ui;background:#fff}div.g{display:inline-block;margin:6px;text-align:center;vertical-align:top}svg{border:1px solid #ddd;background:#fff}</style>';
html += `<p style="margin:8px">${key}: Chrome (filled teal) | WebKit (red outline) | node on the Intel, x86 (blue dashes, only where it is not Chrome's)</p>`;
for (const g of GROUPS) {
  const c = C[`${key} ${g.id}`], k = K[`${key} ${g.id}`], n = N[`${key} ${g.id}`];
  if (!c || !k) continue;
  const all = [...c.polys, ...k.polys].flatMap((P) => P.pts);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < all.length; i += 2) { x0 = Math.min(x0, all[i]); x1 = Math.max(x1, all[i]); y0 = Math.min(y0, -all[i + 1]); y1 = Math.max(y1, -all[i + 1]); }
  const pad = 0.05 * Math.max(x1 - x0, y1 - y0), w = 300, sw = (x1 - x0 + 2 * pad) / w;
  const same = JSON.stringify(c.polys) === JSON.stringify(k.polys), nDiff = JSON.stringify(n.polys) !== JSON.stringify(c.polys);
  html += `<div class="g"><svg width="${w}" height="${Math.round(w * (y1 - y0 + 2 * pad) / (x1 - x0 + 2 * pad))}" viewBox="${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}">` +
    `<path d="${path2(c.polys)}" fill="#9ad5cc" stroke="#2c7a6f" stroke-width="${1.2 * sw}" fill-rule="nonzero"/>` +
    (nDiff ? `<path d="${path2(n.polys)}" fill="none" stroke="#1f5fd1" stroke-width="${1.6 * sw}" stroke-dasharray="${5 * sw} ${4 * sw}"/>` : '') +
    `<path d="${path2(k.polys)}" fill="none" stroke="#d1301f" stroke-width="${1.6 * sw}"/></svg><br>${g.id} ${same ? '(the same)' : ''}${nDiff ? ' x86 differs' : ''}</div>`;
}
fs.writeFileSync(path.join(OUT, `motif-${key}-engines.html`), html);
fs.copyFileSync('/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/package.json', path.join(OUT, 'package.json'));
const B = await openBrowser({ root: OUT, where: process.env.FOLDING_BROWSER || 'mini' });
try {
  const page = await B.browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(B.url(`motif-${key}-engines.html`), { waitUntil: 'load' });
  await page.screenshot({ path: path.join(OUT, `motif-${key}-engines.png`), fullPage: true });
  console.log('wrote ' + path.join(OUT, `motif-${key}-engines.png`));
} finally { await B.close(); }
