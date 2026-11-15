import re, io
p = 'design.js'
s = open(p).read()
s = s.replace("""export function solve(group, stroke, { h = H_GRID, cover } = {}) {""", """export function solve(group, stroke, { h = H_GRID, cover, settle = true } = {}) {""")
s = s.replace("""  for (let guard = 0; !bounded(L) && guard < 40 && cv > 0.1; guard++) { cv -= 0.01; c = levelAt(cv); L = labelTorus(fld, c, F); }""", """  for (let guard = 0; settle && !bounded(L) && guard < 40 && cv > 0.1; guard++) { cv -= 0.01; c = levelAt(cv); L = labelTorus(fld, c, F); }""")
open(p, 'w').write(s)
p = 'lab/measure.mjs'
s = open(p).read()
old = """  const S = solve(group, stroke, { h, cover: opts.cover });
  const { F, fld } = S, { N1, N2, a1x, a1y, a2x, a2y } = fld, n = N1 * N2;
  // a symmetric blob (one that an element of the group keeps) is no comma: less dark until there is none
  let L = S.L, c = S.c, cv = S.cover;
  const good = (M) => M.comps.every((k) => !k.wraps && k.stab === 1);
  for (let guard = 0; !good(L) && guard < 20 && cv > 0.12; guard++) { cv -= 0.02; c = S.levelAt(cv); L = labelTorus(fld, c, F); }
  const valid = good(L);
"""
new = """  const S = solve(group, stroke, { h, cover: opts.cover, settle: false });
  const { F, fld } = S, { N1, N2, a1x, a1y, a2x, a2y } = fld, n = N1 * N2;
  // an endless band, or a symmetric blob (one that an element of the group keeps), is no comma: less dark until there
  // is none (the largest dark share at which every blob is a bounded, asymmetric island, by bisection)
  let L = S.L, c = S.c, cv = S.cover;
  const good = (M) => M.comps.every((k) => !k.wraps && k.stab === 1);
  if (!good(L)) {
    let lo = 0.08, hi = cv;
    for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (good(labelTorus(fld, S.levelAt(mid), F))) lo = mid; else hi = mid; }
    cv = lo; c = S.levelAt(cv); L = labelTorus(fld, c, F);
    if (opts.quick) return { cover: cv, wanted: S.wanted, valid: false, marks: 1, sym: 0, bare: 1, solid: 0, gap: 0, thin: 0, inTile: 0, dent: 0, length: 0, quick: true };
  }
  const valid = good(L);
"""
assert old in s
s = s.replace(old, new)
open(p, 'w').write(s)
