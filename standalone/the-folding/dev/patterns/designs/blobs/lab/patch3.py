p = 'design.js'
s = open(p).read()
old = "export function strokeBeads(k, soft = SOFT) {"
new = "export function strokeBeads(k, soft = k.soft ?? SOFT) {"
assert old in s
s = s.replace(old, new)
open(p, 'w').write(s)
p = 'lab/view.mjs'
s = open(p).read()
old = """const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const over = opt.strokes ? JSON.parse(fs.readFileSync(opt.strokes, 'utf8')) : {};
"""
new = """let ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
let over = opt.strokes ? JSON.parse(fs.readFileSync(opt.strokes, 'utf8')) : {};
let variants = null;
if (Array.isArray(over)) { variants = over; ids = variants.map((v) => v.id); over = {}; }      // [{ id, stroke, label }]: one panel each
"""
assert old in s
s = s.replace(old, new)
old = """  const group = BY_ID[id], stroke = over[id] || STROKES[id] || STROKES.default;"""
new = """  const group = BY_ID[id], stroke = variants ? variants[n].stroke : (over[id] && over[id].stroke) || over[id] || STROKES[id] || STROKES.default;"""
assert old in s
s = s.replace(old, new)
old = """  R.text(X0, Y0 + px + 3, `${id} c${"""
new = """  R.text(X0, Y0 + px + 3, `${variants && variants[n].label ? variants[n].label : id} c${"""
assert old in s
s = s.replace(old, new)
open(p, 'w').write(s)
