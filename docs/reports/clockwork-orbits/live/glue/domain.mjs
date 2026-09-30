// domain.mjs — the picture of the fundamental domain and its glued edges.
//
// One simulation cell of g227, drawn in Cartesian space so the 120° lattice is properly
// skewed.  Every one of the 1296 mesh nodes is coloured by how the glue supplies its
// value:
//
//   * integrated      — the 146 representatives, the 333 orbifold's fundamental domain;
//   * delay 0         — copied from a representative at the same instant (the τ = 0
//                       rotations: ordinary spatial gluing, what SymSim already does);
//   * delay T/3, 2T/3 — read out of the history buffer.
//
// On top of that, every stencil bond that leaves the domain is drawn as a short stub in
// the colour of the delay it reads.  Those stubs are the three kinds of glued edge.

const SQRT3 = Math.sqrt(3);
const toCartesian = (u, v) => [u - v / 2, v * SQRT3 / 2];
const OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1]];

/** Which delay class every node belongs to: -1 for the representatives themselves. */
function classOf(glue) {
  const { n, repPos, copyK } = glue;
  const cls = new Int8Array(n);
  for (let p = 0; p < n; p++) cls[p] = repPos[p] >= 0 ? -1 : copyK[p];
  return cls;
}

export function domainStats(glue) {
  const cls = classOf(glue);
  const counts = { representatives: 0, instant: 0, third: 0, twoThirds: 0 };
  for (let p = 0; p < glue.n; p++) {
    if (cls[p] === -1) counts.representatives++;
    else if (cls[p] === 0) counts.instant++;
    else if (cls[p] === 1) counts.third++;
    else counts.twoThirds++;
  }
  // bonds that leave the domain, by the delay they read
  const bonds = [0, 0, 0];
  const { N, reps, nRep } = glue;
  for (let r = 0; r < nRep; r++) {
    const node = reps[r], i = node % N, j = (node / N) | 0;
    for (const [dx, dy] of OFFSETS) {
      const nb = (((j + dy) % N + N) % N) * N + (((i + dx) % N + N) % N);
      if (cls[nb] === -1) continue;
      bonds[cls[nb]]++;
    }
  }
  return { ...counts, bonds, reductionFactor: glue.n / glue.nRep };
}

/** Draw the cell into a canvas.  `colours` comes from the page's CSS custom properties so
 *  the panel follows the light/dark theme. */
export function drawDomain(canvas, glue, colours, { centres = [] } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 540;
  const cssH = Math.round(cssW * 0.62);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  // the drawn cell is the rhombus spanned by a1 and a2: x in [-0.5, 1], y in [0, 0.866]
  const pad = 12;
  const spanX = 1.5, spanY = SQRT3 / 2;
  const scale = Math.min((cssW - 2 * pad) / spanX, (cssH - 2 * pad) / spanY);
  const ox = (cssW - spanX * scale) / 2 + 0.5 * scale;   // x = -0.5 maps to the left edge
  const oy = (cssH - spanY * scale) / 2 + spanY * scale;  // y up
  const px = (u, v) => { const [x, y] = toCartesian(u, v); return [ox + x * scale, oy - y * scale]; };

  // the cell outline
  ctx.beginPath();
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => px(u, v));
  corners.forEach((c, i) => (i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])));
  ctx.closePath();
  ctx.strokeStyle = colours.axis; ctx.lineWidth = 1; ctx.stroke();

  const cls = classOf(glue);
  const { N, n, reps, nRep } = glue;
  const fill = [colours.c1, colours.c2, colours.c4];       // delay 0, T/3, 2T/3
  const r = Math.max(1.5, scale / N * 0.42);

  // every node, coloured by how the glue feeds it
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const p = j * N + i;
      if (cls[p] === -1) continue;
      const [x, y] = px(i / N, j / N);
      ctx.fillStyle = fill[cls[p]];
      ctx.globalAlpha = 0.34;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // the glued edges: a stub per stencil bond that leaves the domain
  ctx.lineWidth = Math.max(1, scale / N * 0.30);
  for (let q = 0; q < nRep; q++) {
    const node = reps[q], i = node % N, j = (node / N) | 0;
    const [x0, y0] = px(i / N, j / N);
    for (const [dx, dy] of OFFSETS) {
      const nb = (((j + dy) % N + N) % N) * N + (((i + dx) % N + N) % N);
      if (cls[nb] === -1) continue;
      const [x1, y1] = px((i + dx) / N, (j + dy) / N);     // unwrapped: the stub points out
      ctx.strokeStyle = fill[cls[nb]];
      ctx.globalAlpha = cls[nb] === 0 ? 0.55 : 0.85;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // the representatives on top
  ctx.fillStyle = colours.ink;
  for (let q = 0; q < nRep; q++) {
    const node = reps[q], i = node % N, j = (node / N) | 0;
    const [x, y] = px(i / N, j / N);
    ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, 7); ctx.fill();
  }

  // the nine threefold centres; the three inside the domain are the 333 cone points
  for (const c of centres) {
    const [x, y] = px(c.lattice[0], c.lattice[1]);
    const node = ((Math.round(c.lattice[1] * N) % N + N) % N) * N + ((Math.round(c.lattice[0] * N) % N + N) % N);
    const isRep = glue.repPos[node] >= 0;
    const s = isRep ? 8 : 5.5;
    const tri = [0, 120, 240].map(a => { const t = (a - 90) * Math.PI / 180; return [x + s * Math.cos(t), y + s * Math.sin(t)]; });
    ctx.beginPath(); tri.forEach((pt, k) => (k ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.closePath();
    ctx.fillStyle = [colours.c1, colours.c2, colours.c4][c.k];
    ctx.globalAlpha = isRep ? 1 : 0.42; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colours.page; ctx.lineWidth = 1.2; ctx.stroke();
    if (isRep) {
      const label = ['3', '3₁', '3₂'][c.k];
      ctx.font = '700 13px system-ui, -apple-system, sans-serif';
      ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = colours.page;
      ctx.strokeText(label, x + 10, y + 4);
      ctx.fillStyle = colours.ink;
      ctx.fillText(label, x + 10, y + 4);
    }
  }
  return { cssW, cssH };
}

export { toCartesian };
