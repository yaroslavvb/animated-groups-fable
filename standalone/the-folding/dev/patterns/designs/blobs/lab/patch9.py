p = 'lab/search.mjs'
s = open(p).read()
old = """const toStroke = (v) => ({ p: v.slice(0, 8), rh: v[8], r0: v[8] * (v[10] > 0.02 ? v[9] : 1), th: v[10] > 0.02 ? v[10] : 0, q: v[11] });"""
new = """const SOFTNESS = opt.soft ? +opt.soft : undefined;
const toStroke = (v) => { const st = { p: v.slice(0, 8), rh: v[8], r0: v[8] * (v[10] > 0.02 ? v[9] : 1), th: v[10] > 0.02 ? v[10] : 0, q: v[11] }; if (SOFTNESS) st.soft = SOFTNESS; return st; };"""
assert old in s; s = s.replace(old, new)
old = """if (cover !== undefined) stroke.cover = cover;"""
new = """if (cover !== undefined) stroke.cover = cover;
if (SOFTNESS) stroke.soft = SOFTNESS;"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
