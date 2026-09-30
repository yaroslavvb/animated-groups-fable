// render.mjs — pictures for the page.
//
//  * `makeFieldPainter` draws one channel of the field over `tiles` periodic cells in
//    *Cartesian* space, so the 120-degree lattice is properly skewed — the same map the
//    site's WebGL camera uses (standalone/brusselator-p3/public/renderer.mjs:32,
//    toLatticeOffset), with the site's exact ember colour stops.
//  * `drawResidual` is the live convergence plot.
//  * `symbolSvg` draws the clockwork symbol: the rotation centres of g227 with their
//    time offsets and the winding each one forces on the first harmonic.

const SQRT3 = Math.sqrt(3);

// The site's ember stops (renderer.mjs, function ember): t -> RGB.
const EMBER = [
  [0.00, 18, 9, 39], [0.22, 65, 12, 94], [0.43, 99, 25, 116], [0.58, 171, 45, 90],
  [0.69, 240, 111, 32], [0.78, 252, 181, 42], [0.89, 253, 219, 94], [1.00, 252, 242, 158],
];
export const SITE_U_RANGE = [0.5700383186340332, 1.9851957559585571];  // record.ranges.u
export const MONO_THRESHOLD = 0.426;                                    // the site's cut

/** 256-entry lookup table for a palette. */
function makeLut(stops) {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, r0, g0, b0] = stops[k], [t1, r1, g1, b1] = stops[k + 1];
    const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    lut[3 * i] = r0 + f * (r1 - r0); lut[3 * i + 1] = g0 + f * (g1 - g0); lut[3 * i + 2] = b0 + f * (b1 - b0);
  }
  return lut;
}
const EMBER_LUT = makeLut(EMBER);

/** Screen offset (lattice lengths, y down) to lattice offset — the site's map. */
export const toLatticeOffset = (x, y) => [x - y / SQRT3, -2 * y / SQRT3];
/** Lattice coordinates to Cartesian (y up), unit 120-degree basis. */
export const toCartesian = (u, v) => [u - v / 2, v * SQRT3 / 2];

/** A painter bound to a canvas size and view.  The expensive part — which three mesh
 *  nodes each pixel interpolates and with what weights — is computed once; after that a
 *  frame costs one pass over the pixels.  The interpolation is the repository's own
 *  (rdlab.picture): linear on the triangle the pixel falls in, the rhombus being cut
 *  along its short diagonal, which is how the site triangulates the lattice too. */
export function makeFieldPainter(canvas, N, { tiles = 2, centre = [0, 0] } = {}) {
  let w = 0, h = 0, idx = null, img = null, ctx = canvas.getContext('2d', { alpha: false });
  function build() {
    w = canvas.width; h = canvas.height;
    const px = w * h;
    idx = { i0: new Int32Array(px), i1: new Int32Array(px), i2: new Int32Array(px), w0: new Float32Array(px), w1: new Float32Array(px), w2: new Float32Array(px) };
    img = ctx.createImageData(w, h);
    const span = tiles, aspect = w / h;
    for (let py = 0; py < h; py++) {
      for (let pxi = 0; pxi < w; pxi++) {
        // square pixels: the shorter side spans `tiles` lattice lengths
        const sx = ((pxi + 0.5) / w - 0.5) * span * (aspect > 1 ? aspect : 1);
        const sy = ((py + 0.5) / h - 0.5) * span * (aspect > 1 ? 1 : 1 / aspect);
        const [du, dv] = toLatticeOffset(sx, sy);
        const u = centre[0] + du, v = centre[1] + dv;
        const xf = ((u * N) % N + N) % N, yf = ((v * N) % N + N) % N;
        const ix = Math.floor(xf), iy = Math.floor(yf), fx = xf - ix, fy = yf - iy;
        const ix1 = (ix + 1) % N, iy1 = (iy + 1) % N;
        const q00 = iy * N + ix, q10 = iy * N + ix1, q01 = iy1 * N + ix, q11 = iy1 * N + ix1;
        const k = py * w + pxi;
        if (fx >= fy) { idx.i0[k] = q00; idx.i1[k] = q10; idx.i2[k] = q11; idx.w0[k] = 1 - fx; idx.w1[k] = fx - fy; idx.w2[k] = fy; }
        else { idx.i0[k] = q00; idx.i1[k] = q01; idx.i2[k] = q11; idx.w0[k] = 1 - fy; idx.w1[k] = fy - fx; idx.w2[k] = fx; }
      }
    }
  }
  return {
    /** `field` is one channel (length N*N).  `range` is [lo, hi]; pass null to auto-range.
     *  `mono` renders the site's black-and-white style from a difference field. */
    draw(field, { range = null, mono = false } = {}) {
      if (canvas.width !== w || canvas.height !== h || !idx) build();
      let lo, hi;
      if (mono) { lo = 0; hi = 1; }
      else if (range) { [lo, hi] = range; }
      else { lo = Infinity; hi = -Infinity; for (let i = 0; i < field.length; i++) { if (field[i] < lo) lo = field[i]; if (field[i] > hi) hi = field[i]; } if (hi - lo < 1e-12) hi = lo + 1e-12; }
      const data = img.data, scale = 255 / (hi - lo);
      for (let k = 0; k < w * h; k++) {
        const value = idx.w0[k] * field[idx.i0[k]] + idx.w1[k] * field[idx.i1[k]] + idx.w2[k] * field[idx.i2[k]];
        let o = k * 4;
        if (mono) {
          const c = value > MONO_THRESHOLD ? 255 : 0;
          data[o] = c; data[o + 1] = c; data[o + 2] = c; data[o + 3] = 255;
        } else {
          let t = (value - lo) * scale;
          t = t < 0 ? 0 : t > 255 ? 255 : t;
          const p = 3 * (t | 0);
          data[o] = EMBER_LUT[p]; data[o + 1] = EMBER_LUT[p + 1]; data[o + 2] = EMBER_LUT[p + 2]; data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return [lo, hi];
    },
    invalidate() { idx = null; },
    /** Pixel position of a lattice point, for overlays. */
    pixelOf(u, v) {
      const aspect = w / h;
      // invert toLatticeOffset: sy = -dv*sqrt3/2, sx = du + sy/sqrt3
      const du = u - centre[0], dv = v - centre[1];
      const sy = -dv * SQRT3 / 2, sx = du + sy / SQRT3;
      return [(sx / (tiles * (aspect > 1 ? aspect : 1)) + 0.5) * w, (sy / (tiles * (aspect > 1 ? 1 : 1 / aspect)) + 0.5) * h];
    },
    get size() { return [w, h]; },
  };
}

/** The live convergence plot: log10 of the twisted-shooting residual against Newton
 *  iteration, with the tolerance the solver is aiming at. */
export function drawResidual(canvas, history, { tol = 1e-11 } = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, dpr = canvas.width / canvas.clientWidth || 1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#12090f'; ctx.fillRect(0, 0, w, h);
  const pad = { l: 44 * dpr, r: 8 * dpr, t: 10 * dpr, b: 22 * dpr };
  const top = 1, bottom = Math.log10(tol) - 1;              // log10 axis
  const n = Math.max(6, history.length - 1);
  const X = i => pad.l + (w - pad.l - pad.r) * (n ? i / n : 0);
  const Y = r => pad.t + (h - pad.t - pad.b) * (top - Math.log10(Math.max(r, 10 ** bottom))) / (top - bottom);
  ctx.strokeStyle = '#3a2430'; ctx.fillStyle = '#8d7a85'; ctx.lineWidth = dpr;
  ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  for (let e = top; e >= bottom; e -= 3) {
    const y = Y(10 ** e);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillText(`1e${e}`, 4 * dpr, y + 3.5 * dpr);
  }
  ctx.strokeStyle = '#4c7a5a'; ctx.setLineDash([4 * dpr, 3 * dpr]);
  ctx.beginPath(); ctx.moveTo(pad.l, Y(tol)); ctx.lineTo(w - pad.r, Y(tol)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#8d7a85';
  ctx.fillText('Newton iteration', pad.l, h - 6 * dpr);
  if (!history.length) return;
  ctx.strokeStyle = '#f0a020'; ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  history.forEach((p, i) => { const x = X(p.iteration), y = Y(p.residualRms); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
  ctx.fillStyle = '#fdd35e';
  history.forEach(p => { ctx.beginPath(); ctx.arc(X(p.iteration), Y(p.residualRms), 2.6 * dpr, 0, 7); ctx.fill(); });
}

/** The clockwork symbol as SVG: one simulation cell of g227 with its nine threefold
 *  centres.  Colour and label give the time offset k/3 carried by the +120-degree
 *  generator at that centre; `w` is the winding the first harmonic must have there
 *  (w = -k mod 3), which is why the pattern has to carry vortices at all. */
export function symbolSvg(centres, { size = 300 } = {}) {
  // the cell is the rhombus spanned by a1 and a2, drawn centred; in Cartesian it is
  // 1.5 wide and sqrt(3)/2 tall, so the viewBox is wider than it is high
  const W = size, H = Math.round(size * 0.68), scale = W / 1.78;
  const px = (u, v) => { const [x, y] = toCartesian(u, v); return [W / 2 + x * scale, H / 2 - y * scale]; };
  const colour = k => (k === 0 ? '#5ec8f0' : k === 1 ? '#ff7a3a' : '#ffe07a');
  const label = k => (k === 0 ? '3' : k === 1 ? '3₁' : '3₂');
  const parts = [];
  const cell = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => px(u, v));
  parts.push(`<polygon points="${cell.map(p => p.map(c => c.toFixed(1)).join(',')).join(' ')}" fill="#150c13" stroke="#57384a" stroke-width="1.3"/>`);
  for (const c of centres) {
    for (const du of [-1, 0]) for (const dv of [-1, 0]) {
      const u = c.lattice[0] + du, v = c.lattice[1] + dv;
      if (u < -0.51 || u > 0.51 || v < -0.51 || v > 0.51) continue;
      const [x, y] = px(u, v);
      const r = 9;
      const tri = [0, 120, 240].map(a => { const t = (a - 90) * Math.PI / 180; return `${(x + r * Math.cos(t)).toFixed(1)},${(y + r * Math.sin(t)).toFixed(1)}`; }).join(' ');
      parts.push(`<polygon points="${tri}" fill="${colour(c.k)}" fill-opacity="0.95" stroke="#150c12" stroke-width="1"/>`);
      parts.push(`<text x="${(x + 11).toFixed(1)}" y="${(y + 4.5).toFixed(1)}" font-size="12" fill="${colour(c.k)}" font-family="ui-monospace,monospace">${label(c.k)}</text>`);
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="the nine threefold centres of g227 with their time offsets">${parts.join('')}</svg>`;
}
