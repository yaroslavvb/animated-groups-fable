p = 'lab/search.mjs'
s = open(p).read()
old = """function randomVec() {
  const u = (a, b) => a + rnd() * (b - a);
  const inside = () => { let x, y; do { x = u(bx0, bx1); y = u(by0, by1); } while (!inTile(x, y)); return [x, y]; };
  const a = inside(), d = inside(), b = [u(bx0 - 0.2, bx1 + 0.2), u(by0 - 0.2, by1 + 0.2)], c = [u(bx0 - 0.2, bx1 + 0.2), u(by0 - 0.2, by1 + 0.2)];
  return fix([...a, ...b, ...c, ...d, u(B.rh[0], B.rh[1]), u(B.r0f[0], 1), rnd() < 0.5 ? 0 : u(0.1, 0.5), u(B.q[0], B.q[1])]);
}
"""
new = """// where an end of the stroke can sit deep in a corner of the tile: on the corner's bisector, where the tile is just
// wide enough for a thin end (radius 0.05) and its margin
const corners = tile.map((v, i) => {
  const a = tile[(i + tile.length - 1) % tile.length], b = tile[(i + 1) % tile.length];
  const ux = a[0] - v[0], uy = a[1] - v[1], wx = b[0] - v[0], wy = b[1] - v[1], lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
  const half = Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (lu * lw)))) / 2;
  let hx = ux / lu + wx / lw, hy = uy / lu + wy / lw; const lh = Math.hypot(hx, hy) || 1; hx /= lh; hy /= lh;
  const d = Math.min(0.11 / Math.sin(half), 0.4 * Math.min(lu, lw));
  return [v[0] + d * hx, v[1] + d * hy];
});
function randomVec() {
  const u = (a, b) => a + rnd() * (b - a);
  const inside = () => { let x, y; do { x = u(bx0, bx1); y = u(by0, by1); } while (!inTile(x, y)); return [x, y]; };
  const corner = (not) => { let k; do { k = Math.floor(rnd() * corners.length); } while (k === not); return k; };
  let a = inside(), d = inside();
  const mode = rnd();
  if (mode < 0.6) { const i = corner(-1), j = corner(i); d = [corners[j][0] + 0.04 * gauss(), corners[j][1] + 0.04 * gauss()]; if (mode < 0.35) a = [corners[i][0] + 0.04 * gauss(), corners[i][1] + 0.04 * gauss()]; }
  const b = [u(bx0 - 0.2, bx1 + 0.2), u(by0 - 0.2, by1 + 0.2)], c = [u(bx0 - 0.2, bx1 + 0.2), u(by0 - 0.2, by1 + 0.2)];
  return fix([...a, ...b, ...c, ...d, u(B.rh[0], B.rh[1]), u(B.r0f[0], 1), rnd() < 0.5 ? 0 : u(0.1, 0.5), u(B.q[0], B.q[1])]);
}
"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
p = 'lab/search-all.mjs'
s = open(p).read()
old = """if (line) { const r = JSON.parse(line.slice(7)); if (!results[r.id] || r.score < results[r.id].score) results[r.id] = r; console.error(`${r.id} seed ${job.seed}: score ${r.score} bare ${r.m.bare} gap ${r.m.gap} cover ${r.m.cover} inTile ${r.m.inTile} dent ${r.m.dent} evals ${r.evals}`); }"""
new = """if (line) { const r = JSON.parse(line.slice(7)); if (!results[r.id] || r.score < results[r.id].score) results[r.id] = r; console.error(`${r.id} seed ${job.seed}: score ${r.score} bare ${r.m.bare} gap ${r.m.gap} cover ${r.m.cover} inTile ${r.m.inTile} asym ${r.m.asym} nose ${r.m.nose} evals ${r.evals}`); }"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
