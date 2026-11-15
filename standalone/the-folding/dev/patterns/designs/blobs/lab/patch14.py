p = 'lab/settable.mjs'
s = open(p).read()
old = """  const key = /^[a-z0-9]+$/i.test(g.id) && !/^\\d+$/.test(g.id) ? g.id : `'${g.id}'`;"""
new = """  const key = /^[a-z_$][a-z0-9_$]*$/i.test(g.id) ? g.id : `'${g.id}'`;"""
assert old in s, 'no match'
s = s.replace(old, new)
open(p, 'w').write(s)
