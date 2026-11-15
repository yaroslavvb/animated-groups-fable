p = 'lab/view.mjs'
s = open(p).read()
old = """  const f = [0, 0];
  for (let py = 0; py < px; py++) for (let qx = 0; qx < px; qx++) {"""
new = """  const f = [0, 0];
  // which hand the copy of the tile under a frame point has: +1 (the tile's own), -1 (mirrored), 0 (not found)
  const tf = tile.poly.map((p) => F.toF(p[0], p[1]));
  let tcx = 0, tcy = 0;
  for (const p of tf) { tcx += p[0] / tf.length; tcy += p[1] / tf.length; }
  const inTf = (x, y) => { for (let i = 0; i < tf.length; i++) { const a = tf[i], b = tf[(i + 1) % tf.length]; if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < -1e-9) return false; } return true; };
  const handAt = (x, y) => {
    for (const r of F.reps) {
      const dx = x - r.tx, dy = y - r.ty, zx = r.a * dx + r.c * dy, zy = r.b * dx + r.d * dy;      // r^-1 (x)
      const s0 = Math.round(((zx - tcx) * F.E2[1] - (zy - tcy) * F.E2[0]) / fld.det * N1 / N1), t0 = Math.round((F.E1[0] * (zy - tcy) - F.E1[1] * (zx - tcx)) / fld.det * N2 / N2);
      for (let m = s0 - 1; m <= s0 + 1; m++) for (let n = t0 - 1; n <= t0 + 1; n++) if (inTf(zx - m * F.E1[0] - n * F.E2[0], zy - m * F.E1[1] - n * F.E2[1])) return r.a * r.d - r.b * r.c > 0 ? 1 : -1;
    }
    return 0;
  };
  const PALE_T = [220, 237, 234], PALE_S = [239, 227, 204];
  for (let py = 0; py < px; py++) for (let qx = 0; qx < px; qx++) {"""
assert old in s; s = s.replace(old, new)
old = """    R.set(X0 + qx, Y0 + py, u > c ? (inT ? DARK : PALE) : (inT ? LIGHT : [255, 255, 255]));"""
new = """    R.set(X0 + qx, Y0 + py, u > c ? (inT ? DARK : opt.hands === '0' ? PALE : handAt(f[0], f[1]) < 0 ? PALE_S : PALE_T) : (inT ? LIGHT : [255, 255, 255]));"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
