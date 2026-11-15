p = 'design.js'
s = open(p).read()
old = """    t += (STEP * sg) / len;
  }
  return Float64Array.from(out);
}"""
new = """    t += (STEP * sg) / len;
  }
  for (const [x, y, r] of k.lobes || []) out.push(x, y, soft * r, amp);     // a round bump beside the spine: alone, a disc of radius r
  return Float64Array.from(out);
}"""
assert old in s; s = s.replace(old, new)
old = """ *   q           how the radius falls from there to the tip: 1 - w^q  (1: a straight taper, 2: fat for longer)
 *   cover       the dark share (default COVER)
 */"""
new = """ *   q           how the radius falls from there to the tip: 1 - w^q  (1: a straight taper, 2: fat for longer)
 *   lobes       round bumps beside the spine, [[x, y, radius], ...]: where a blob must reach into a third corner
 *   cover       the dark share (default COVER)
 */"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)

p = 'lab/search.mjs'
s = open(p).read()
old = """const SOFTNESS = opt.soft ? +opt.soft : undefined, MARGIN = opt.margin ? +opt.margin : undefined;
const toStroke = (v) => { const st = { p: v.slice(0, 8), rh: v[8], r0: v[8] * (v[10] > 0.02 ? v[9] : 1), th: v[10] > 0.02 ? v[10] : 0, q: v[11] }; if (SOFTNESS) st.soft = SOFTNESS; return st; };
const fromStroke = (s) => [...s.p, s.rh, (s.r0 ?? s.rh) / s.rh, s.th || 0, s.q || 1];"""
new = """const SOFTNESS = opt.soft ? +opt.soft : undefined, MARGIN = opt.margin ? +opt.margin : undefined, LOBES = +opt.lobes || 0;
const toStroke = (v) => {
  const st = { p: v.slice(0, 8), rh: v[8], r0: v[8] * (v[10] > 0.02 ? v[9] : 1), th: v[10] > 0.02 ? v[10] : 0, q: v[11] };
  if (SOFTNESS) st.soft = SOFTNESS;
  const lobes = [];
  for (let k = 0; k < LOBES; k++) if (v[14 + 3 * k] >= 0.06) lobes.push([v[12 + 3 * k], v[13 + 3 * k], v[14 + 3 * k]]);   // a lobe under 0.06 is switched off
  if (lobes.length) st.lobes = lobes;
  return st;
};
const fromStroke = (s) => { const v = [...s.p, s.rh, (s.r0 ?? s.rh) / s.rh, s.th || 0, s.q || 1]; for (let k = 0; k < LOBES; k++) { const l = (s.lobes || [])[k]; v.push(...(l || [(bx0 + bx1) / 2, (by0 + by1) / 2, 0.03])); } return v; };"""
assert old in s; s = s.replace(old, new)
old = """  v[8] = clamp(v[8], B.rh); v[9] = clamp(v[9], B.r0f); v[10] = clamp(v[10], B.th); v[11] = clamp(v[11], B.q);
  return v;"""
new = """  v[8] = clamp(v[8], B.rh); v[9] = clamp(v[9], B.r0f); v[10] = clamp(v[10], B.th); v[11] = clamp(v[11], B.q);
  for (let k = 0; k < LOBES; k++) { v[12 + 3 * k] = clamp(v[12 + 3 * k], [bx0, bx1]); v[13 + 3 * k] = clamp(v[13 + 3 * k], [by0, by1]); v[14 + 3 * k] = clamp(v[14 + 3 * k], [0.02, 0.3]); }
  return v;"""
assert old in s; s = s.replace(old, new)
old = """  return fix([...a, ...b, ...c, ...d, u(B.rh[0], B.rh[1]), u(B.r0f[0], 1), rnd() < 0.5 ? 0 : u(0.1, 0.5), u(B.q[0], B.q[1])]);
}"""
new = """  const v = [...a, ...b, ...c, ...d, u(B.rh[0], B.rh[1]), u(B.r0f[0], 1), rnd() < 0.5 ? 0 : u(0.1, 0.5), u(B.q[0], B.q[1])];
  for (let k = 0; k < LOBES; k++) { const q = inside(); v.push(q[0], q[1], rnd() < 0.3 ? 0.03 : u(0.08, 0.26)); }
  return fix(v);
}"""
assert old in s; s = s.replace(old, new)
old = """const STEP0 = [0.1, 0.1, 0.14, 0.14, 0.14, 0.14, 0.1, 0.1, 0.035, 0.12, 0.08, 0.2], D = STEP0.length;"""
new = """const STEP0 = [0.1, 0.1, 0.14, 0.14, 0.14, 0.14, 0.1, 0.1, 0.035, 0.12, 0.08, 0.2];
for (let k = 0; k < LOBES; k++) STEP0.push(0.1, 0.1, 0.04);
const D = STEP0.length;"""
assert old in s; s = s.replace(old, new)
old = """const stroke = { p: st.p.map(r4), r0: r4(st.r0), rh: r4(st.rh), th: r4(st.th), q: r4(st.q) };"""
new = """const stroke = { p: st.p.map(r4), r0: r4(st.r0), rh: r4(st.rh), th: r4(st.th), q: r4(st.q) };
if (st.lobes) stroke.lobes = st.lobes.map((l) => l.map(r4));"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)

p = 'lab/settable.mjs'
s = open(p).read()
old = """  if (st.cover !== undefined) row += `, cover: ${f(st.cover)}`;"""
new = """  if (st.lobes && st.lobes.length) row += `, lobes: [${st.lobes.map((l) => `[${l.map(f).join(', ')}]`).join(', ')}]`;
  if (st.cover !== undefined) row += `, cover: ${f(st.cover)}`;"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
