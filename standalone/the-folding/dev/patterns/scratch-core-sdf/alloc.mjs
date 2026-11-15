// scratch-core-sdf/alloc.mjs — where the fixed cost of a bake goes: fresh buffers against kept ones, and the last pass.
//   node dev/patterns/scratch-core-sdf/alloc.mjs
const size = 1024, n2 = size * size;
function best(f, runs = 15) { let b = Infinity; for (let i = 0; i < runs; i++) { const t0 = performance.now(); f(); b = Math.min(b, performance.now() - t0); } return b.toFixed(2); }

let sink = 0;
const fresh = () => { const d = new Float32Array(n2).fill(1), w = new Int16Array(n2), o = new Uint8Array(n2); sink += d[5] + w[7] + o[9]; return [d, w, o]; };
const keptD = new Float32Array(n2), keptW = new Int16Array(n2);
const kept = () => { keptD.fill(1); keptW.fill(0); const o = new Uint8Array(n2); sink += o[9]; return [keptD, keptW, o]; };
function lastPass(dist, wind, out) {
  for (let j = 0, idx = 0; j < size; j++) {
    let w = 0;
    for (let i = 0; i < size; i++, idx++) {
      w += wind[idx];
      const d2 = dist[idx], lv = d2 < 1 ? 127 * Math.sqrt(d2) : 127;
      out[idx] = w > 0 ? 128.5 - lv : 128.5 + lv;
    }
  }
  return out;
}
console.log('fresh buffers (alloc + fill)        ', best(fresh), 'ms');
console.log('kept buffers (two fills + one alloc)', best(kept), 'ms');
console.log('fresh buffers + last pass           ', best(() => lastPass(...fresh())), 'ms');
console.log('kept buffers + last pass            ', best(() => lastPass(...kept())), 'ms');
// a band of 40 % of the texels (sqrt taken there)
const band = () => { const [d, w, o] = kept(); for (let i = 0; i < n2; i += 5) { d[i] = 0.3; d[i + 1] = 0.6; } return lastPass(d, w, o); };
console.log('kept buffers + last pass, 40 % band ', best(band), 'ms   (includes writing the band)');
console.log(sink > -1 ? '' : '');
