// dev/patterns/scratch-review-webkit/contact-tile.mjs — tile-lib.mjs's pictures, Chrome | WebKit, as one PNG.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-webkit/contact-tile.mjs
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser } from '../../../tools/browser.mjs';

const OUT = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit', C = 'chrome-tile', K = 'webkit-tile';
const files = fs.readdirSync(path.join(OUT, C)).filter((f) => f.endsWith('.jpg')).sort();
let h = '<!doctype html><meta charset="utf-8"><style>body{margin:0;font:13px system-ui}td{padding:2px;text-align:center;vertical-align:top}img{display:block}</style><table>';
for (let i = 0; i < files.length; i += 2) {
  h += '<tr>';
  for (const f of files.slice(i, i + 2)) {
    const w = f.startsWith('R-') ? 420 : 300;
    h += `<td><img src="${C}/${f}" width="${w}">chrome ${f}</td><td>${fs.existsSync(path.join(OUT, K, f)) ? `<img src="${K}/${f}" width="${w}">` : 'missing'}webkit</td>`;
  }
  h += '</tr>';
}
fs.writeFileSync(path.join(OUT, 'contact-tile.html'), h + '</table>');
const B = await openBrowser({ root: OUT, where: process.env.FOLDING_BROWSER || 'mini' });
try {
  const page = await B.browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.goto(B.url('contact-tile.html'), { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.screenshot({ path: path.join(OUT, 'contact-tile.png'), fullPage: true });
  const diff = await page.evaluate(async (files) => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const out = [];
    for (const f of files) {
      const [A, Bi] = await Promise.all([load('chrome-tile/' + f), load('webkit-tile/' + f)]);
      if (!A || !Bi) { out.push([f, 'missing']); continue; }
      const w = Math.min(A.naturalWidth, Bi.naturalWidth), h = Math.min(A.naturalHeight, Bi.naturalHeight);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(A, 0, 0); const a = x.getImageData(0, 0, w, h).data; x.clearRect(0, 0, w, h); x.drawImage(Bi, 0, 0); const b = x.getImageData(0, 0, w, h).data;
      let big = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) big++;
      out.push([f, Math.round(big / (w * h) * 10000) / 10000, `${A.naturalWidth}x${A.naturalHeight} ${Bi.naturalWidth}x${Bi.naturalHeight}`]);
    }
    return out;
  }, files);
  for (const d of diff) console.log(d.join('  '));
} finally { await B.close(); }
