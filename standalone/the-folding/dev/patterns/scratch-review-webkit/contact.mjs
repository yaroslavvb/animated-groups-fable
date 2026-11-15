// dev/patterns/scratch-review-webkit/contact.mjs — Chrome's and WebKit's pictures of the same states side by side
// (contact sheets as PNG, made in the mini's Chrome), and how much the two differ, pixel by pixel.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-webkit/contact.mjs [chromeDir] [webkitDir]
// Writes OUT/review-webkit/contact-*.png and diff.json.
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser } from '../../../tools/browser.mjs';
import { PATS, GROUPS_SHOT } from './lib.mjs';

const OUT = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit';
const C = process.argv[2] || 'chrome', K = process.argv[3] || 'webkit-review';
const safe = (id) => id.replace(/\*/g, 's');
fs.copyFileSync('/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/package.json', path.join(OUT, 'package.json'));

const css = 'body{margin:0;font:13px system-ui;background:#fff;color:#222}table{border-collapse:collapse}td{padding:2px;vertical-align:top;text-align:center}img{display:block}th{font-weight:600;padding:4px}';
const cell = (src, w) => fs.existsSync(path.join(OUT, src)) ? `<td><img src="${src}" width="${w}"><div>${src.split('/')[0]}</div></td>` : `<td style="width:${w}px;background:#fdd">missing<br>${src}</td>`;
const sheets = {};
for (const p of PATS) {
  let h = `<style>${css}</style><table><tr><th></th><th colspan=2>t = 0.6: Chrome | WebKit</th><th colspan=2>t = 1: Chrome | WebKit</th></tr>`;
  for (const g of GROUPS_SHOT) {
    h += `<tr><th>${p}<br>${g}</th>`;
    for (const t of ['06', '1']) for (const d of [C, K]) h += cell(`${d}/L-fold-${p}-${safe(g)}-t${t}.jpg`, 300);
    h += '</tr>';
  }
  sheets[`fold-${p}`] = h + '</table>';
  let q = `<style>${css}</style><table><tr><th></th><th colspan=2>plane, t = 0.6: Chrome | WebKit</th><th colspan=2>plane, t = 1: Chrome | WebKit</th></tr>`;
  for (const g of GROUPS_SHOT) {
    q += `<tr><th>${p}<br>${g}</th>`;
    for (const t of ['06', '1']) for (const d of [C, K]) q += cell(`${d}/L-plane-${p}-${safe(g)}-t${t}.jpg`, 300);
    q += '</tr>';
  }
  sheets[`plane-${p}`] = q + '</table>';
}
{
  let h = `<style>${css}</style><table>`;
  for (const p of PATS) for (const g of ['333', '*x']) h += `<tr><th>${p}<br>${g}<br>t = 0</th>${cell(`${C}/L-${p}-${safe(g)}-t0.jpg`, 620)}${cell(`${K}/L-${p}-${safe(g)}-t0.jpg`, 620)}</tr>`;
  sheets['t0-pages'] = h + '</table>';
}
{
  let h = `<style>${css}</style><table><tr><th></th><th colspan=2>t = 0.6</th><th colspan=2>t = 1</th></tr>`;
  for (const p of ['paisley', 'soft', 'tomoe', 'checker']) for (const g of ['333', '*x', '*632']) {
    h += `<tr><th>${p}<br>${g}</th>`;
    for (const t of ['06', '1']) for (const d of [C, K]) h += cell(`${d}/P-${p}-${safe(g)}-t${t}.jpg`, 220);
    h += '</tr>';
  }
  sheets.phone = h + '</table>';
}
{
  let h = `<style>${css}</style><table>`;
  for (const w of [1280, 375]) for (const p of PATS) h += `<tr><th>${w}<br>${p}</th>${cell(`${C}/S-${w}-${p}.png`, w === 1280 ? 1000 : 375)}</tr><tr><th></th>${cell(`${K}/S-${w}-${p}.png`, w === 1280 ? 1000 : 375)}</tr>`;
  sheets.select = h + '</table>';
}
{
  let h = `<style>${css}</style><table><tr>`;
  for (const p of ['paisley', 'soft', 'tomoe']) h += cell(`${C}/L-fold-${p}-333-back.jpg`, 300) + cell(`${K}/L-fold-${p}-333-back.jpg`, 300);
  sheets.back = h + '</tr></table>';
}

const B = await openBrowser({ root: OUT, where: process.env.FOLDING_BROWSER || 'mini' });
try {
  const page = await B.browser.newPage({ viewport: { width: 1300, height: 900 } });
  for (const [name, html] of Object.entries(sheets)) {
    fs.writeFileSync(path.join(OUT, `contact-${name}.html`), '<!doctype html><meta charset="utf-8">' + html);
    await page.goto(B.url(`contact-${name}.html`), { waitUntil: 'load' });
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    await page.screenshot({ path: path.join(OUT, `contact-${name}.png`), fullPage: true });
  }
  // the pixel difference of the same state in the two engines (the fold pane and the plane pane, t = 0.6 and 1)
  fs.writeFileSync(path.join(OUT, 'diff.html'), '<!doctype html><meta charset="utf-8"><body></body>');
  await page.goto(B.url('diff.html'), { waitUntil: 'load' });
  const pairs = [];
  for (const p of PATS) for (const g of GROUPS_SHOT) for (const t of ['06', '1']) for (const pane of ['fold', 'plane']) pairs.push([`${p} ${g} t${t} ${pane}`, `${C}/L-${pane}-${p}-${safe(g)}-t${t}.jpg`, `${K}/L-${pane}-${p}-${safe(g)}-t${t}.jpg`]);
  const diff = await page.evaluate(async (pairs) => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const out = [];
    for (const [name, a, b] of pairs) {
      const [A, Bi] = await Promise.all([load(a), load(b)]);
      if (!A || !Bi) { out.push({ name, missing: true }); continue; }
      const w = Math.min(A.naturalWidth, Bi.naturalWidth), h = Math.min(A.naturalHeight, Bi.naturalHeight);
      const ca = document.createElement('canvas'); ca.width = w; ca.height = h; const xa = ca.getContext('2d', { willReadFrequently: true }); xa.drawImage(A, 0, 0);
      const cb = document.createElement('canvas'); cb.width = w; cb.height = h; const xb = cb.getContext('2d', { willReadFrequently: true }); xb.drawImage(Bi, 0, 0);
      const da = xa.getImageData(0, 0, w, h).data, db = xb.getImageData(0, 0, w, h).data;
      let sum = 0, big = 0;
      for (let i = 0; i < da.length; i += 4) { const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); sum += d; if (d > 60) big++; }
      out.push({ name, size: [A.naturalWidth, A.naturalHeight, Bi.naturalWidth, Bi.naturalHeight], mean: Math.round(sum / (w * h) * 100) / 100, bigShare: Math.round(big / (w * h) * 10000) / 10000 });
    }
    return out;
  }, pairs);
  fs.writeFileSync(path.join(OUT, 'diff.json'), JSON.stringify(diff, null, 1));
  const worst = diff.filter((d) => !d.missing).sort((x, y) => y.bigShare - x.bigShare);
  console.log(`${diff.length} pairs, ${diff.filter((d) => d.missing).length} missing; the most different (share of pixels off by > 60 of 765):`);
  for (const d of worst.slice(0, 14)) console.log(`  ${d.name.padEnd(26)} ${d.bigShare}  mean ${d.mean}  ${d.size.join('x')}`);
  const sizes = new Set(diff.filter((d) => !d.missing).map((d) => d.size.join('x')));
  console.log('sizes: ' + [...sizes].join(', '));
} finally { await B.close(); }
