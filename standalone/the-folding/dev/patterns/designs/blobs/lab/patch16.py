p = 'lab/search-all.mjs'
s = open(p).read()
old = """const results = {};"""
new = """const results = {}, every = [];"""
assert old in s; s = s.replace(old, new)
old = """if (line) { const r = JSON.parse(line.slice(7)); if (!results[r.id]"""
new = """if (line) { const r = JSON.parse(line.slice(7)); every.push({ ...r, seed: job.seed }); if (!results[r.id]"""
assert old in s; s = s.replace(old, new)
old = """console.log('ALL ' + JSON.stringify(results));"""
new = """console.log('ALL ' + JSON.stringify(results));
console.log('EVERY ' + JSON.stringify(every));"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
p = 'lab/merge.mjs'
s = open(p).read()
old = """  const all = line ? JSON.parse(line.slice(4)) : JSON.parse(txt);
  for (const [id, r] of Object.entries(all)) (cands[id] = cands[id] || []).push({ name, stroke: r.stroke || r });"""
new = """  const ev = txt.split('\\n').find((l) => l.startsWith('EVERY '));
  if (ev && opt.every === '1') { for (const r of JSON.parse(ev.slice(6))) (cands[r.id] = cands[r.id] || []).push({ name: name + r.seed, stroke: r.stroke }); continue; }
  const all = line ? JSON.parse(line.slice(4)) : JSON.parse(txt);
  for (const [id, r] of Object.entries(all)) (cands[id] = cands[id] || []).push({ name, stroke: r.stroke || r });"""
assert old in s; s = s.replace(old, new)
old = """const out = {}, variants = [];
for (const g of GROUPS) {"""
new = """const out = {}, variants = [], only = opt.ids ? new Set(opt.ids.split(',')) : null;
for (const g of GROUPS) {
  if (only && !only.has(g.id)) continue;"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
