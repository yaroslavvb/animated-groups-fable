p = 'lab/search-all.mjs'
s = open(p).read()
old = """if (['ids', 'jobs', 'seeds'].includes(k)) opt[k] = v;"""
new = """if (['ids', 'jobs', 'seeds', 'seed0'].includes(k)) opt[k] = v;"""
assert old in s; s = s.replace(old, new)
old = """for (const id of ids) for (let s = 1; s <= seeds; s++) queue.push({ id, seed: s });"""
new = """for (let s = 1; s <= seeds; s++) for (const id of ids) queue.push({ id, seed: s + (+opt.seed0 || 0) });"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
