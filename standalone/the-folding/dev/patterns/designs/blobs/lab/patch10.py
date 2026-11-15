p = 'lab/measure.mjs'
s = open(p).read()
old = """    const root = L.find(hp), hx0 = L.dx[hp], hy0 = L.dy[hp], pts = [];
    const tile = group.presets ? tileInFrame(group, F) : null;
    let inside = 0;
    for (let p = 0; p < n; p++) {
      if (L.par[p] < 0 || L.find(p) !== root) continue;
      const I = Ih + L.dx[p] - hx0, J = Jh + L.dy[p] - hy0, x = I * a1x + J * a2x, y = I * a1y + J * a2y;
      pts.push([x, y]);
      if (tile && insidePoly(tile, x, y, opts.margin ?? 0.04)) inside++;
    }
"""
new = """    const root = L.find(hp), hx0 = L.dx[hp], hy0 = L.dy[hp], pts = [], cells = new Set();
    const tile = group.presets ? tileInFrame(group, F) : null;
    let inside = 0, mx = 0, my = 0;
    for (let p = 0; p < n; p++) {
      if (L.par[p] < 0 || L.find(p) !== root) continue;
      const I = Ih + L.dx[p] - hx0, J = Jh + L.dy[p] - hy0, x = I * a1x + J * a2x, y = I * a1y + J * a2y;
      pts.push([x, y]); cells.add((I + 4096) * 8192 + (J + 4096));
      mx += x; my += y;
      if (tile && insidePoly(tile, x, y, opts.margin ?? 0.04)) inside++;
    }
    // how unlike its own mirror images and its own half-turn the blob is: 1 - the largest share of it that such an
    // image (about its centroid) covers. A drop or a crescent has a mirror image that covers it (no hand), an S a
    // half-turn that does (no direction): near 0. A comma: 0.3 and more.
    mx /= pts.length; my /= pts.length;
    const has = (x, y) => { const I = Math.round((N1 * (x * F.E2[1] - y * F.E2[0])) / fld.det), J = Math.round((N2 * (F.E1[0] * y - F.E1[1] * x)) / fld.det); return cells.has((I + 4096) * 8192 + (J + 4096)); };
    let most = 0;
    for (let k = -1; k < 24; k++) {
      let hit = 0;
      if (k < 0) { for (const q of pts) if (has(2 * mx - q[0], 2 * my - q[1])) hit++; }
      else {
        const co = Math.cos((2 * Math.PI * k) / 24), si = Math.sin((2 * Math.PI * k) / 24);       // the mirror at angle pi k / 24
        for (const q of pts) { const dx = q[0] - mx, dy = q[1] - my; if (has(mx + co * dx + si * dy, my + si * dx - co * dy)) hit++; }
      }
      most = Math.max(most, hit / pts.length);
    }
    res.asym = 1 - most;
"""
assert old in s; s = s.replace(old, new)
old = """    bare: 2 * bare, solid: 2 * solid, gap, thin, inTile: 0, dent: 0, length: 0, level: c,"""
new = """    bare: 2 * bare, solid: 2 * solid, gap, thin, inTile: 0, dent: 0, asym: 0, length: 0, level: c,"""
assert old in s; s = s.replace(old, new)
old = """inTile: 0, dent: 0, length: 0, level: 1, holes: 0, turn: 9, quick: true };"""
new = """inTile: 0, dent: 0, asym: 0, length: 0, level: 1, holes: 0, turn: 9, quick: true };"""
assert old in s; s = s.replace(old, new)
old = """    dent: 1, dentWant: 0.16, level: 0.4, levelSpan: 0.9, holes: 1, turn: 0.4, turnWant: 0.8, ...W };"""
new = """    dent: 0.5, dentWant: 0.16, asym: 2, asymWant: 0.3, level: 0.4, levelSpan: 0.9, holes: 1, turn: 0.4, turnWant: 0.8, ...W };"""
assert old in s; s = s.replace(old, new)
old = """  s += w.dent * Math.max(0, w.dentWant - m.dent);"""
new = """  s += w.dent * Math.max(0, w.dentWant - m.dent);
  s += w.asym * Math.max(0, w.asymWant - m.asym);"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
p = 'lab/view.mjs'
s = open(p).read()
old = """  R.text(X0, Y0 + px + 16, `in${r2(m.inTile)} d${r2(m.dent)} l${r2(m.length)} m${m.marks} sy${m.sym} ${m.valid ? '' : '!bad '}sc${r2(score(m))}`, m.valid ? INK : [180, 60, 0], 2);"""
new = """  R.text(X0, Y0 + px + 16, `in${r2(m.inTile)} d${r2(m.dent)} a${r2(m.asym)} l${r2(m.length)} m${m.marks} ${m.valid ? '' : '!bad '}sc${r2(score(m))}`, m.valid ? INK : [180, 60, 0], 2);"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
