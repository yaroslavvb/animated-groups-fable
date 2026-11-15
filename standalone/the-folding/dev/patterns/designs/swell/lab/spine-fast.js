function spineInto(h, p, sweep, rw, m, sgn, pr, X, Y) {
  const dx = h[0] - p[0], dy = h[1] - p[1], D = Math.sqrt(dx * dx + dy * dy);
  let cx = dx / D, cy = dy / D;                                     // the direction from p, turned step by step
  const da = (sgn * sweep) / FINE, cr = Math.cos(da), sr = Math.sin(da);
  for (let j = 0; j <= FINE; j++) {
    const w = 1 - j / FINE, rho = rw + (D - rw) * (m === 1 ? w : m === 3 ? w * w * w : Math.pow(w, m));
    const x = p[0] + rho * cx, y = p[1] + rho * cy;
    fineX[j] = x; fineY[j] = y;
    if (j) { const ax = x - fineX[j - 1], ay = y - fineY[j - 1]; fineL[j] = fineL[j - 1] + Math.sqrt(ax * ax + ay * ay); } else fineL[0] = 0;
    const nx = cx * cr - cy * sr; cy = cx * sr + cy * cr; cx = nx;
  }
  const L = fineL[FINE];
  for (let i = 0, j = 0; i < pr.n; i++) {
    const want = pr.ts[i] * L;
    while (j < FINE - 1 && fineL[j + 1] < want) j++;
    const seg = fineL[j + 1] - fineL[j], f = seg > 0 ? Math.min(1, Math.max(0, (want - fineL[j]) / seg)) : 0;
    X[i] = fineX[j] + f * (fineX[j + 1] - fineX[j]); Y[i] = fineY[j] + f * (fineY[j + 1] - fineY[j]);
  }
  return D;
}
