p = 'design.js'
s = open(p).read()
old = """  default: { at: [0.3, 0.3], dir: 0.4, len: 0.9, turn: 1.6, skew: 0.3, r0: 0.2, rh: 0.2, th: 0, q: 1 },
};"""
new = """  default: { at: [0.3, 0.3], dir: 0.4, len: 0.9, turn: 1.6, skew: 0.3, r0: 0.2, rh: 0.2, th: 0, q: 1 },
  o: { at: [0.1033, 0.4101], dir: -1.3, len: 1.2871, turn: -1.5931, skew: 0.2688, r0: 0.2354, rh: 0.2463, th: 0.1961, q: 0.8774 },
  442: { at: [0.5411, 0.2631], dir: 2.7871, len: 0.9411, turn: -2.9404, skew: -0.2641, r0: 0.1538, rh: 0.1701, th: 0.067, q: 1.2945 },
};"""
assert old in s
s = s.replace(old, new)
open(p, 'w').write(s)
