p = 'design.js'
s = open(p).read()
old = """export const STROKES = {
  default: { p: [0.3, 0.3, 0.7, 0.2, 0.9, 0.6, 0.6, 0.9], r0: 0.2, rh: 0.2, th: 0, q: 1 },
};"""
new = """export const STROKES = {
  default: { p: [0.3, 0.3, 0.7, 0.2, 0.9, 0.6, 0.6, 0.9], r0: 0.2, rh: 0.2, th: 0, q: 1 },
  // TABLE-BEGIN (written by lab/settable.mjs from a search: lab/search.mjs)
  // TABLE-END
};"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
