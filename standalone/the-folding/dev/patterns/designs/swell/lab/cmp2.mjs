// lab/cmp2.mjs — where the scanline tone and kit.windingAt differ
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, orbitElements, windingAt } from '../../../kit.js';
import { fillCount } from './png.mjs';
import { find } from '../design.js';
const id = process.argv[2] || "2222", group = BY_ID[id], res = find(group), N = normalize(res.shapes), per = +process.argv[3] || 28;
const size = Math.sqrt(group.domainArea), h = size / per;
const L = Math.max(Math.hypot(group.e1[0], group.e1[1]), Math.hypot(group.e2[0], group.e2[1]));
const half = Math.min(1.1 * L + 1.2 * size, 3.4 * size), pad = 1.3 * size;
const w = Math.ceil((2 * (half + pad)) / h), x0 = group.center[0] - half - pad, y0 = group.center[1] - half - pad;
const cnt = new Int16Array(w * w), box = [x0, y0, x0 + w * h, y0 + w * h], buf = [];
const els = orbitElements(group, N, box);
for (const g of els) for (const P of N.polys) {
  const p = P.pts, n = p.length / 2; buf.length = 2 * n;
  for (let i = 0; i < n; i++) { const x = p[2 * i], y = p[2 * i + 1]; buf[2 * i] = (g.a * x + g.b * y + g.tx - x0) / h; buf[2 * i + 1] = (g.c * x + g.d * y + g.ty - y0) / h; }
  fillCount(cnt, w, w, buf, P.hole ? -1 : 1);
}
let diff = 0, a = 0, b = 0, shown = 0;
for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
  const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h, W = windingAt(group, N, x, y), c = cnt[j * w + i];
  if (W > 0) a++; if (c > 0) b++;
  if ((W > 0) !== (c > 0)) { diff++; if (shown++ < 8) console.log('differ at', x.toFixed(3), y.toFixed(3), 'kit', W, 'scan', c); }
}
console.log(id, 'elements', els.length, 'kit dark', a, 'scan dark', b, 'differ', diff, 'of', w * w, 'N.R', N.R.toFixed(3), 'centre', N.cx.toFixed(3), N.cy.toFixed(3));
{
  let inner = 0, nk = 0, ns = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h;
    if (Math.abs(x - group.center[0]) > half || Math.abs(y - group.center[1]) > half) continue;
    inner++; if (cnt[j * w + i] > 0) ns++;
  }
  console.log('window coverage (scan)', (ns / inner).toFixed(4), 'whole grid', (b / (w * w)).toFixed(4), 'half', half.toFixed(3), 'w', w);
}
