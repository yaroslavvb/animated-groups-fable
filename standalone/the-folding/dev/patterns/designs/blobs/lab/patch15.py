p = 'lab/search.mjs'
s = open(p).read()
old = """  const m = analyse(group, toStroke(v), { h, cover, quick: true });"""
new = """  const m = analyse(group, toStroke(v), { h, cover, quick: true, margin: MARGIN });"""
assert old in s; s = s.replace(old, new)
old = """const SOFTNESS = opt.soft ? +opt.soft : undefined;"""
new = """const SOFTNESS = opt.soft ? +opt.soft : undefined, MARGIN = opt.margin ? +opt.margin : undefined;"""
assert old in s; s = s.replace(old, new)
old = """const fin = analyse(group, toStroke(best.v), { h: 0.016, cover });"""
new = """const fin = analyse(group, toStroke(best.v), { h: 0.016, cover, margin: MARGIN });"""
assert old in s; s = s.replace(old, new)
old = """  const d = Math.min(0.11 / Math.sin(half), 0.4 * Math.min(lu, lw));"""
new = """  const d = Math.min((0.05 + (MARGIN ?? 0.04) + 0.02) / Math.sin(half), 0.4 * Math.min(lu, lw));"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
