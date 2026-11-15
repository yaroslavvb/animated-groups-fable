// scratch-core-sdf/picture.mjs — look at a baked SDF.  node dev/patterns/scratch-core-sdf/picture.mjs <group id> [design key] [out.png]
// One PNG, five panels:
//   top left     the texture itself (size 320, one texel a pixel, row 0 at the bottom): the bytes as grey
//   top right    the print drawn FROM the texture at 1024 the way the shader will (sdfSample -> sdfDistance -> one
//                pixel of anti-aliasing), over about two cells, front tones; the baked cell outlined: no seam may show
//   bottom       an enlargement at the sharpest corner near the middle of the cell (argv[5]: its half-width in cell
//                sides, default 0.06 = 10 pixels a texel of the 256 texture), back tones:
//                from a 256 texture | from a 1024 texture | from the polygons themselves (brute force)
import { BY_ID } from '../../../src/groups.js';
import { PRINT_FRONT, PRINT_BACK, INK } from '../../../src/palette.js';
import { normalize } from '../kit.js';
import { bakeSDF, sdfSample, sdfDistance } from '../../../src/sdf.js';
import { cellOf, cellPolys, edgesOf } from './scene.mjs';
import { canvas, hex, mix } from './png.mjs';

const id = process.argv[2] || '*632', key = process.argv[3] || 'demo';
const out = process.argv[4] || `/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/core-sdf/sdf-${key}-${id.replace(/\*/g, 's').replace(/x/g, 'x')}.png`;
const group = BY_ID[id];
if (!group) throw new Error('no group ' + id);
const { find } = await import(`../designs/${key}/design.js`);
const N = normalize(find(group).shapes), cell = cellOf(group), { origin, e1, e2 } = cell, det = e1[0] * e2[1] - e1[1] * e2[0];
const tile = Math.sqrt(group.domainArea), range = 0.03 * tile, polys = cellPolys(group, N, cell, range);
const t0 = performance.now();
const tex = { 320: bakeSDF({ ...cell, size: 320, range, polys }), 256: bakeSDF({ ...cell, size: 256, range, polys }), 1024: bakeSDF({ ...cell, size: 1024, range, polys }) };
console.log(`${id} ${key}: ${polys.length} polygons, ${edgesOf(polys)} edges, range ${range.toFixed(4)}, three bakes in ${(performance.now() - t0).toFixed(0)} ms`);

const front = PRINT_FRONT.map(hex), back = PRINT_BACK.map(hex), ink = hex(INK);
const lattice = (x, y) => [((x - origin[0]) * e2[1] - (y - origin[1]) * e2[0]) / det, ((y - origin[1]) * e1[0] - (x - origin[0]) * e1[1]) / det];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---- the polygons themselves, for the last panel
function exactSD(list, x, y) {
  let W = 0, d2 = Infinity;
  for (const P of list) {
    const p = P.pts, n = p.length / 2;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = p[2 * i], yi = p[2 * i + 1], xj = p[2 * j], yj = p[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
      const vx = xi - xj, vy = yi - yj, wx = x - xj, wy = y - yj, vv = vx * vx + vy * vy;
      let t = vv > 0 ? (wx * vx + wy * vy) / vv : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = wx - t * vx, qy = wy - t * vy, q = qx * qx + qy * qy;
      if (q < d2) d2 = q;
    }
    if (inside) W += P.hole ? -1 : 1;
  }
  return W > 0 ? -Math.sqrt(d2) : Math.sqrt(d2);
}

/** A square panel of w pixels showing the world square of half-width `half` about (cx, cy); sd(x, y) in world units. */
function panel(w, cx, cy, half, sd, tones, outline) {
  const c = canvas(w, w), pix = (2 * half) / w;
  for (let py = 0; py < w; py++) for (let px = 0; px < w; px++) {
    const x = cx + ((2 * (px + 0.5)) / w - 1) * half, y = cy - ((2 * (py + 0.5)) / w - 1) * half;
    let col = mix(tones[0], tones[1], clamp01(0.5 - sd(x, y) / pix));
    if (outline) {
      const [s, t] = lattice(x, y);
      const ds = Math.min(Math.abs(s), Math.abs(1 - s)) * (Math.abs(det) / Math.hypot(...e2)), dt = Math.min(Math.abs(t), Math.abs(1 - t)) * (Math.abs(det) / Math.hypot(...e1));
      const d = Math.min(t > -0.002 && t < 1.002 ? ds : Infinity, s > -0.002 && s < 1.002 ? dt : Infinity);
      col = mix(col, ink, 0.75 * clamp01(1.2 - d / pix));
    }
    c.px(px, py, col.map(Math.round));
  }
  return c;
}
const fromTexture = (size) => (x, y) => { const [s, t] = lattice(x, y); return sdfDistance(sdfSample(tex[size], size, s, t), range); };

// ---- the sharpest corner near the middle of the cell
const mid = [origin[0] + (e1[0] + e2[0]) / 2, origin[1] + (e1[1] + e2[1]) / 2];
let best = null;
for (const P of polys) {
  const p = P.pts, n = p.length / 2;
  for (let k = 0; k < n; k++) {
    const a = (k + n - 1) % n, b = (k + 1) % n;
    const ux = p[2 * k] - p[2 * a], uy = p[2 * k + 1] - p[2 * a + 1], vx = p[2 * b] - p[2 * k], vy = p[2 * b + 1] - p[2 * k + 1];
    const turn = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)), far = Math.hypot(p[2 * k] - mid[0], p[2 * k + 1] - mid[1]) / tile;
    const [s, t] = lattice(p[2 * k], p[2 * k + 1]);
    if (s < 0.1 || s > 0.9 || t < 0.1 || t > 0.9) continue;
    const score = turn - 0.8 * far;
    if (!best || score > best.score) best = { score, x: p[2 * k], y: p[2 * k + 1], turn };
  }
}
if (!best) best = { x: mid[0], y: mid[1], turn: 0 };
console.log(`zoom on (${best.x.toFixed(3)}, ${best.y.toFixed(3)}), a turn of ${(best.turn * 180 / Math.PI).toFixed(0)} degrees`);

// ---- compose
const G = 12, big = 620, raw = 320, zw = 312, W = G + raw + G + big + G, H = G + big + G + zw + G;
const sheet = canvas(Math.max(W, 3 * zw + 4 * G), H, [255, 255, 255]);
const rawC = canvas(raw, raw);
for (let j = 0; j < raw; j++) for (let i = 0; i < raw; i++) { const v = tex[320][j * raw + i]; rawC.px(i, raw - 1 - j, [v, v, v]); }
sheet.blit(rawC, G, G);
const L = Math.max(Math.hypot(...e1), Math.hypot(...e2), Math.hypot(e1[0] + e2[0], e1[1] + e2[1]), Math.hypot(e1[0] - e2[0], e1[1] - e2[1]));
sheet.blit(panel(big, mid[0], mid[1], 0.78 * L, fromTexture(1024), front, true), G + raw + G, G);
const zh = (+process.argv[5] || 0.06) * Math.max(Math.hypot(...e1), Math.hypot(...e2));      // 0.06: about 31 texels of the 256 texture across
const near = polys.filter((P) => { for (let i = 0; i < P.pts.length; i += 2) if (Math.abs(P.pts[i] - best.x) < 3 * zh + range && Math.abs(P.pts[i + 1] - best.y) < 3 * zh + range) return true; return false; });
sheet.blit(panel(zw, best.x, best.y, zh, fromTexture(256), back, false), G, G + big + G);
sheet.blit(panel(zw, best.x, best.y, zh, fromTexture(1024), back, false), G + zw + G, G + big + G);
sheet.blit(panel(zw, best.x, best.y, zh, (x, y) => exactSD(near, x, y), back, false), G + 2 * (zw + G), G + big + G);
console.log('WROTE ' + sheet.save(out) + `  (zoom: ${(zw / (2 * zh) * Math.hypot(...e1) / 256).toFixed(1)} pixels a texel of the 256 texture)`);
