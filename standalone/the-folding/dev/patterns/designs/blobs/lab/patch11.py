p = 'lab/measure.mjs'
s = open(p).read()
old = """  res.ms = performance.now() - t0;
  return res;"""
new = """  res.nose = (stroke.th || 0) > 0 ? stroke.th + 0.5 * (1 - (stroke.r0 ?? stroke.rh) / stroke.rh) : 0;       // how far the head end is from a round head
  res.ms = performance.now() - t0;
  return res;"""
assert old in s; s = s.replace(old, new)
old = """inTile: 0, dent: 0, asym: 0, length: 0, level: 1, holes: 0, turn: 9, quick: true };"""
new = """inTile: 0, dent: 0, asym: 0, length: 0, level: 1, holes: 0, turn: 9, nose: 0, quick: true };"""
assert old in s; s = s.replace(old, new)
old = """    dent: 0.5, dentWant: 0.16, asym: 2, asymWant: 0.3, level: 0.4, levelSpan: 0.9, holes: 1, turn: 0.4, turnWant: 0.8, ...W };"""
new = """    dent: 0.5, dentWant: 0.16, asym: 3, asymWant: 0.28, nose: 0.25, level: 0.4, levelSpan: 0.9, holes: 1, turn: 0.4, turnWant: 0.8, ...W };"""
assert old in s; s = s.replace(old, new)
old = """  s += w.asym * Math.max(0, w.asymWant - m.asym);"""
new = """  s += w.asym * Math.max(0, w.asymWant - m.asym);
  s += w.nose * (m.nose || 0);"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
