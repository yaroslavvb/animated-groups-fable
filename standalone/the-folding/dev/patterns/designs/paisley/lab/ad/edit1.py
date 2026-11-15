# lab/ad/edit1.py — round 1 of the second version, applied to design.js as exact replacements (each must match once).
import io, sys
p = 'design.js'
s = io.open(p, encoding='utf8').read()
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit('edit1: %d matches (want %d) for: %s' % (n, count, old[:90]))
    s = s.replace(old, new)

# ---- knobs -----------------------------------------------------------------------------------------------------------
rep("""  shape: { L0: 4.2, L1: 5.8, turn0: 180, turn1: 70, late0: 0.4, late1: 0, taper0: 1.7, taper1: 1.7, tip: 0.08 },
""", """  shape: { L0: 4.2, L1: 5.8, turn0: 180, turn1: 70, late0: 0.4, late1: 0, taper0: 1.7, taper1: 1.7, tip: 0.08 },
  // the STOUT comma, the same glyph cut for a small size or a wide corner (as type is cut sturdier at small sizes): a
  // shorter spine and a fatter tail, which keeps its width nearly to the tip
  stout: { L0: 3.1, L1: 3.9, turn0: 170, turn1: 85, late0: 0.45, late1: 0.25, taper0: 1.3, taper1: 1.3, tip: 0.11 },
  slenderMin: 0.2,         // a comma whose head is under this across is always the stout one
""")
rep("""  floor: 0.14,             // no comma shorter than this
  floorWant: 0.24,         // ... marks at least this long
""", """  floor: 0.24,             // no comma shorter than this ...
  headMin: 0.12,           // ... or with a head under this across: a bare disc that only a smaller one could end is left
  floorWant: 0.3,          // ... marks at least this long
""")
rep("""  maxMarks: 6,
""", """  maxMarks: 4,
  tipSpecial: 0.08,        // a bare disc whose middle is this near a point fixed by an element (a mirror corner, a rotation centre) is also offered TAILS: commas laid tip first, pointing at it
  tipProbe: 0.16, tipRoomMin: 0.006, tipDirs: 2,   // ... in the directions where a tip has most room at this distance from the middle
  tipOff: [0, -0.3, 0.3],  // ... heading for the middle, or this far off (radians)
  tipSeats: [0.3, 0.55],   // ... the comma living in the cell of the point this far out
""")
rep("""  tinyLong: 0.2, wBare: 10, wCover: 5, coverLo: 0.41, coverHi: 0.6, wTiny: 0.12, wMarks: 0.05,   // the flaws of a cloth, weighed
""", """  tinyLong: 0.3, wBare: 10, wCover: 5, coverLo: 0.43, coverHi: 0.6, wTiny: 0.12, wMarks: 0.05,   // the flaws of a cloth, weighed
""")

# ---- the shapes: slender and stout ----------------------------------------------------------------------------------
rep("""function shapeOf(e) {
  const key = Math.max(0, Math.min(E_STEPS, Math.round(e * E_STEPS)));
  let S = SHAPES.get(key);
  if (S) return S;
  e = key / E_STEPS;
  const K = KNOBS.shape, L =""", """function shapeOf(e, st = 0) {
  const ek = Math.max(0, Math.min(E_STEPS, Math.round(e * E_STEPS))), key = ek + (st ? 100 : 0);
  let S = SHAPES.get(key);
  if (S) return S;
  e = ek / E_STEPS;
  const K = st ? KNOBS.stout : KNOBS.shape, L =""")
rep("""  S = { e, L, turn: Th, dense, coarse: decimate(dense, 1, 0.42, 15), area: A / 2, reach, span, discs };
""", """  // the spine's end (the middle of the tip), the way it heads there, the tip's radius: for a comma laid tip first
  S = { e, st: st ? 1 : 0, L, turn: Th, dense, coarse: decimate(dense, 1, 0.42, 15), area: A / 2, reach, span, discs, end: [ex, ey], endAng: th(1), tipR: w(1) };
""")
io.open(p, 'w', encoding='utf8').write(s)
print('edit1 ok')
