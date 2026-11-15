// scratch-core-sdf/lastpass.mjs — the last pass of bakeSDF (W by a running sum, the byte from the distance), three ways.
//   node dev/patterns/scratch-core-sdf/lastpass.mjs
const size = 1024, n2 = size * size;
function time(f, runs = 21) { const ms = []; for (let i = 0; i < runs; i++) { const t0 = performance.now(); f(); ms.push(performance.now() - t0); } ms.sort((a, b) => a - b); return `${ms[0].toFixed(2)} best, ${ms[runs >> 1].toFixed(2)} median`; }

function v0(dist, wind, out) {
  for (let j = 0, idx = 0; j < size; j++) {
    let w = 0;
    for (let i = 0; i < size; i++, idx++) {
      w += wind[idx];
      const d2 = dist[idx], lv = d2 < 1 ? 127 * Math.sqrt(d2) : 127;
      out[idx] = w > 0 ? 128.5 - lv : 128.5 + lv;
    }
  }
}
function v1(dist, wind, out) {
  for (let j = 0, idx = 0; j < size; j++) {
    let w = 0;
    for (let i = 0; i < size; i++, idx++) {
      w += wind[idx];
      const d2 = dist[idx];
      if (d2 >= 1) out[idx] = w > 0 ? 1 : 255;
      else { const lv = 127 * Math.sqrt(d2); out[idx] = (w > 0 ? 128.5 - lv : 128.5 + lv) | 0; }
    }
  }
}
function v2(dist, wind, out) {
  const bits = new Uint32Array(dist.buffer);
  for (let j = 0, idx = 0; j < size; j++) {
    let w = 0;
    for (let i = 0; i < size; i++, idx++) {
      w += wind[idx];
      if (bits[idx] >= 0x3F800000) out[idx] = w > 0 ? 1 : 255;
      else { const lv = 127 * Math.sqrt(dist[idx]); out[idx] = (w > 0 ? 128.5 - lv : 128.5 + lv) | 0; }
    }
  }
}
// v3: the light, far texels are written by one fill; the pass only visits what differs
function v3(dist, wind, out) {
  out.fill(255);
  for (let j = 0, idx = 0; j < size; j++) {
    let w = 0;
    for (let i = 0; i < size; i++, idx++) {
      w += wind[idx];
      const d2 = dist[idx];
      if (d2 < 1) { const lv = 127 * Math.sqrt(d2); out[idx] = (w > 0 ? 128.5 - lv : 128.5 + lv) | 0; } else if (w > 0) out[idx] = 1;
    }
  }
}

const dist = new Float32Array(n2), wind = new Int16Array(n2), out = new Uint8Array(n2), ref = new Uint8Array(n2);
function scene(band) {
  dist.fill(1); wind.fill(0);
  if (!band) return;
  // discs on a grid: dark inside, a band around the rim
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i % 128) - 64, y = (j % 128) - 64, r = Math.hypot(x, y), d = Math.abs(r - 40) / 8;
    if (d < 1) dist[j * size + i] = d * d;
  }
  for (let j = 0; j < size; j++) for (let c = 0; c < 8; c++) {
    const y = (j % 128) - 64, h = Math.sqrt(Math.max(0, 1600 - y * y));
    if (h > 0) { wind[j * size + c * 128 + Math.ceil(64 - h)] += 1; wind[j * size + c * 128 + Math.ceil(64 + h)] -= 1; }
  }
}
for (const band of [false, true]) {
  scene(band);
  v0(dist, wind, ref);
  let inBand = 0; for (let i = 0; i < n2; i++) if (dist[i] < 1) inBand++;
  console.log(band ? `discs: ${(100 * inBand / n2).toFixed(0)} % of the texels in the band` : 'nothing: all texels light and far');
  for (const [name, f] of [['v0 as it is        ', v0], ['v1 saturated first ', v1], ['v2 by the bits     ', v2], ['v3 fill, then visit', v3]]) {
    const t = time(() => f(dist, wind, out));
    let same = true; for (let i = 0; i < n2; i++) if (out[i] !== ref[i]) { same = false; break; }
    console.log(`  ${name} ${t} ms ${same ? '' : '  DIFFERENT OUTPUT'}`);
  }
}
