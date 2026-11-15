p = 'lab/merge.mjs'
s = open(p).read()
old = """    c.m = analyse(BY_ID[g.id], c.stroke, { h: 0.016 });"""
new = """    c.m = analyse(BY_ID[g.id], c.stroke, { h: 0.016, margin: opt.margin ? +opt.margin : undefined });"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
