# lab/ad/edit2.py — round 1, second part: the stout comma through find(), tails laid tip first, bare discs that are
# given up instead of ending the search. Exact replacements on design.js (each must match once).
import io, sys
p = 'design.js'
s = io.open(p, encoding='utf8').read()
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit('edit2: %d matches (want %d) for: %s' % (n, count, old[:100]))
    s = s.replace(old, new)

# ---- the big comma: slender or stout -----------------------------------------------------------------------------------
rep("""    const fit = (al, e) => {
      const S = shapeOf(e), r = inscribe(hp, S.coarse, al, sCap, 0.012);""", """    const fit = (al, e, st) => {
      const S = shapeOf(e, st), r = inscribe(hp, S.coarse, al, sCap, 0.012);""")
rep("""      r.al = al; r.e = S.e; r.obj = r.s * r.s * weight(S) * (far <= K.farOk ? 1 : Math.pow(K.farOk / far, K.farPow));""",
    """      r.al = al; r.e = S.e; r.st = S.st; r.obj = r.s * r.s * weight(S) * (far <= K.farOk ? 1 : Math.pow(K.farOk / far, K.farPow));""")
rep("""      for (let i = 0; i < 72; i++) { const r = fit((i * TAU) / 72, k / 8); if (r && (!best || r.obj > best.obj * (1 + 1e-6))) best = r; }""",
    """      for (let st = 0; st < 2; st++) for (let i = 0; i < 72; i++) { const r = fit((i * TAU) / 72, k / 8, st); if (r && (!best || r.obj > best.obj * (1 + 1e-6))) best = r; }""")
rep("""for (const al of [best.al + da, best.al - da]) { const r = fit(al, best.e); if (r && r.obj > best.obj * (1 + 1e-6)) best = r; }
      starts.push({ x: best.x, y: best.y, al: best.al, e: best.e, s: best.s, obj: best.obj });""",
    """for (const al of [best.al + da, best.al - da]) { const r = fit(al, best.e, best.st); if (r && r.obj > best.obj * (1 + 1e-6)) best = r; }
      starts.push({ x: best.x, y: best.y, al: best.al, e: best.e, st: best.st, s: best.s, obj: best.obj });""")

# ---- a family ----------------------------------------------------------------------------------------------------------
rep("""    const addMark = (mk) => {
      const S = shapeOf(mk.e);""", """    const addMark = (mk) => {
      const S = shapeOf(mk.e, mk.st);""")
rep("""    let bare = 0, cover = 0, stop = '';
    const census = () => {                                      // the largest bare disc of the tile (centre cell, diameter) and the dark share
      edt(dark, gw, gh, D);
      let best = -1, bo = -1, nd = 0;
      for (let k = 0; k < cells.length; k++) if (dark[cells[k]]) nd++;
      for (let k = 0; k < rim.length; k++) {
        const o = rim[k];
        if (dark[o]) continue;
        const i = o % gw, j = (o - i) / gw, d = D[o] * h - 1e-4 * Math.hypot(gx0 + (i + 0.5) * h - tcx, gy0 + (j + 0.5) * h - tcy);
        if (d > best + 1e-9) { best = d; bo = o; }
      }
      cover = nd / cells.length; bare = bo < 0 ? 0 : 2 * D[bo] * h;
      return bo;
    };
    addMark({ x: big.x, y: big.y, al: big.al, e: big.e, s: big.s });""", """    let bare = 0, bareAll = 0, cover = 0, stop = '';
    // bare discs that no mark of a fair size can end are given up (each with its copies: x, y, radius) and the next
    // one is looked at; they still count as a flaw of the cloth
    const lost = [];
    const giveUp = (x, y, r) => {
      for (let g = -6; g < els.length; g += 6) {
        const gx = g < 0 ? x : els[g] * x + els[g + 1] * y + els[g + 4], gy = g < 0 ? y : els[g + 2] * x + els[g + 3] * y + els[g + 5];
        if (Math.hypot(gx - wcx, gy - wcy) <= wr) lost.push(gx, gy, r);
      }
    };
    const census = () => {                                      // the largest bare disc of the tile that is not given up (centre cell, diameter), the largest of all, and the dark share
      edt(dark, gw, gh, D);
      let best = -1, bo = -1, nd = 0, top = 0;
      for (let k = 0; k < cells.length; k++) if (dark[cells[k]]) nd++;
      for (let k = 0; k < rim.length; k++) {
        const o = rim[k];
        if (dark[o]) continue;
        if (D[o] > top) top = D[o];
        const i = o % gw, j = (o - i) / gw, x = gx0 + (i + 0.5) * h, y = gy0 + (j + 0.5) * h, d = D[o] * h - 1e-4 * Math.hypot(x - tcx, y - tcy);
        if (d <= best + 1e-9) continue;
        let gone = false;
        for (let q = 0; q < lost.length; q += 3) { const dx = lost[q] - x, dy = lost[q + 1] - y; if (dx * dx + dy * dy < lost[q + 2] * lost[q + 2]) { gone = true; break; } }
        if (!gone) { best = d; bo = o; }
      }
      cover = nd / cells.length; bare = bo < 0 ? 0 : 2 * D[bo] * h; bareAll = 2 * top * h;
      return bo;
    };
    addMark({ x: big.x, y: big.y, al: big.al, e: big.e, st: big.st, s: big.s });""")
rep("""    for (let round = 0; round < K.maxMarks - 1; round++) {
      const bo = census(), bareR = bare / 2;""", """    for (let round = 0; marks.length < K.maxMarks && round < K.maxMarks + 3; round++) {
      const bo = census(), bareR = bare / 2;""")

# grow and fitIn take the kind of comma
rep("""      const grow = (x0, y0, al, e, hp) => {
        const S = shapeOf(e), wS = weight(S);""", """      const grow = (x0, y0, al, e, st, hp) => {
        const S = shapeOf(e, st), wS = weight(S);""")
rep("""        const dn = nearest(S, x0, y0, al, lo, bx, by);
        if (dn > K.progress * bareR) return;
        const obj = lo * lo * wS * reward(dn);
        if (!best || obj > best.obj) best = { x: x0, y: y0, al, e: S.e, s: lo, obj, hp, room: null };
      };""", """        if (!st && 2 * lo < K.slenderMin) return;                 // a small comma is a stout one
        const dn = nearest(S, x0, y0, al, lo, bx, by);
        if (dn > K.progress * bareR) return;
        const obj = lo * lo * wS * reward(dn);
        if (!best || obj > best.obj) best = { x: x0, y: y0, al, e: S.e, st: S.st, s: lo, obj, hp, room: null };
      };""")
rep("""      const fitIn = (room, hp, al, e) => {                      // the largest comma of this turn and curl in the room
        const S = shapeOf(e), wS = weight(S);
        const r = inscribe(room.hp, S.coarse, al, sNext, 0.012, best ? Math.sqrt(best.obj / wS) : 0, room.width);
        if (!r) return;""", """      const fitIn = (room, hp, al, e, st) => {                  // the largest comma of this turn, curl and kind in the room
        const S = shapeOf(e, st), wS = weight(S);
        const r = inscribe(room.hp, S.coarse, al, sNext, 0.012, Math.max(best ? Math.sqrt(best.obj / wS) : 0, st ? 0 : K.slenderMin / 2), room.width);
        if (!r) return;""")
rep("""        if (!best || obj > best.obj) best = { x: r.x, y: r.y, al, e: S.e, s: r.s, obj, hp, room };
      };""", """        if (!best || obj > best.obj) best = { x: r.x, y: r.y, al, e: S.e, st: S.st, s: r.s, obj, hp, room };
      };
      // a comma laid TIP first: the tip on the ray from the middle of the bare disc (ux, uy), as near the middle as
      // its width has room (ray: the room for a tip every 0.02 from 0.06 out), heading for the middle or `off` beside
      // it; the body grows outward from there
      const tail = (ux, uy, ray, off, e, st, hp) => {
        const S = shapeOf(e, st), wS = weight(S), al = Math.atan2(-uy, -ux) + off - S.endAng;
        const px = Math.cos(al) * S.end[0] - Math.sin(al) * S.end[1], py = Math.sin(al) * S.end[0] + Math.cos(al) * S.end[1];
        let hx = 0, hy = 0;
        const ok = (sz) => {
          const want = 1.1 * S.tipR * sz + 0.004;
          let j = 0;
          while (j < ray.length && ray[j] < want) j++;
          if (j >= ray.length) return false;
          const d = 0.06 + 0.02 * j;
          hx = bx + d * ux - sz * px; hy = by + d * uy - sz * py;
          return feasible(S, hx, hy, al, sz);
        };
        khp = hp;
        let lo = Math.max(best ? Math.sqrt(best.obj / wS) * 1.003 : K.seatMin * 0.6, st ? 0 : K.slenderMin / 2);
        if (lo > sNext || !ok(lo)) return;
        let hi = lo;
        for (;;) { hi = Math.min(sNext, lo * 1.3); if (hi <= lo || !ok(hi)) break; lo = hi; }
        if (hi > lo) for (let it = 0; it < 6; it++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
        if (!ok(lo)) return;
        const dn = nearest(S, hx, hy, al, lo, bx, by);
        if (dn > K.progress * bareR) return;
        const obj = lo * lo * wS * reward(dn);
        if (!best || obj > best.obj) best = { x: hx, y: hy, al, e: S.e, st: S.st, s: lo, obj, hp, room: null, tail: true };
      };""")
rep("""        const room = roomOf(seat[1], seat[2], hp);
        if (room) for (let k = 0; k <= 4; k++) for (let a = 0; a < 30; a++) fitIn(room, hp, (a * TAU) / 30, k / 4);
        // ... and grown on the grid from the seat, where a tail may also wind round a neighbour
        for (let cI = 0; cI < 5; cI++) {
          const x0 = cI ? seat[1] + 0.5 * r0 * Math.cos((cI * TAU) / 4) : seat[1], y0 = cI ? seat[2] + 0.5 * r0 * Math.sin((cI * TAU) / 4) : seat[2];
          for (let k = 0; k <= 4; k++) for (let a = 0; a < 24; a++) grow(x0, y0, (a * TAU) / 24, k / 4, hp);
        }
      }
      if (!best) { if (K.debug) K.debug({ t: 'nofit' }); stop = 'floor'; break; }""", """        const room = roomOf(seat[1], seat[2], hp), slender = r0 >= 0.4 * K.slenderMin;
        if (room) for (let st = 1; st >= (slender ? 0 : 1); st--) for (let k = 0; k <= 4; k++) for (let a = 0; a < 30; a++) fitIn(room, hp, (a * TAU) / 30, k / 4, st);
        // ... and grown on the grid from the seat, where a tail may also wind round a neighbour
        for (let cI = 0; cI < 5; cI++) {
          const x0 = cI ? seat[1] + 0.5 * r0 * Math.cos((cI * TAU) / 4) : seat[1], y0 = cI ? seat[2] + 0.5 * r0 * Math.sin((cI * TAU) / 4) : seat[2];
          for (let st = 1; st >= (slender ? 0 : 1); st--) for (let k = 0; k <= 4; k++) for (let a = 0; a < 24; a++) grow(x0, y0, (a * TAU) / 24, k / 4, st, hp);
        }
      }
      // tails first: where the bare disc sits on a point that elements of the group fix (a corner of mirrors, a centre
      // of rotation) a head has no room near its middle, but a tail has
      if (selfDistance(bx, by, els) < K.tipSpecial) {
        const ND = 48, tr = new Float64Array(ND), toTile = Math.atan2(tcy - by, tcx - bx);
        const tipRoom = (x, y) => Math.min(dAt(x, y) * h - c, (selfDistance(x, y, els) - K.own) / 2);
        for (let k = 0; k < ND; k++) tr[k] = tipRoom(bx + K.tipProbe * Math.cos((k * TAU) / ND), by + K.tipProbe * Math.sin((k * TAU) / ND));
        const dirs = [];
        for (let n = 0; n < K.tipDirs; n++) {                   // the direction with most room for a tip (toward the tile where it is all the same), then the best one well away from it
          let bk = -1, bv = K.tipRoomMin;
          for (let k = 0; k < ND; k++) {
            const th = (k * TAU) / ND;
            if (dirs.some((t) => Math.cos(t - th) > 0.5)) continue;
            const v = tr[k] + 1e-3 * Math.cos(th - toTile);
            if (v > bv + 1e-9) { bv = v; bk = k; }
          }
          if (bk < 0) break;
          const a = tr[(bk + ND - 1) % ND], b = tr[bk], d = tr[(bk + 1) % ND], den = a - 2 * b + d;
          dirs.push(((bk + (den < -1e-9 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - d)) / den)) : 0)) * TAU) / ND);
        }
        if (K.debug) K.debug({ t: 'tails', dirs: dirs.map((t) => +t.toFixed(3)) });
        for (const th of dirs) {
          const ux = Math.cos(th), uy = Math.sin(th), ray = new Float64Array(14);
          for (let j = 0; j < 14; j++) ray[j] = tipRoom(bx + (0.06 + 0.02 * j) * ux, by + (0.06 + 0.02 * j) * uy);
          for (const sd of K.tipSeats) {
            const hp = halfPlanes(dirichlet(bx + sd * ux, by + sd * uy, els, 3), K.own / 2);
            for (let st = 1; st >= 0; st--) for (let k = 1; k <= 4; k++) for (const off of K.tipOff) tail(ux, uy, ray, off, k / 4, st, hp);
          }
        }
      }
      if (!best) { if (K.debug) K.debug({ t: 'nofit' }); giveUp(bx, by, 0.9 * bareR); continue; }""")

# the polish: the kind stays
rep("""            fitIn(b0.room, hp, b0.al + da, b0.e); fitIn(b0.room, hp, b0.al - da, b0.e);
            if (it < 2) { if (b0.e + 1 / E_STEPS <= 1) fitIn(b0.room, hp, best.al, b0.e + 1 / E_STEPS); if (b0.e - 1 / E_STEPS >= 0) fitIn(b0.room, hp, best.al, b0.e - 1 / E_STEPS); }
          }
          grow(best.x + dp, best.y, best.al, best.e, hp); grow(best.x - dp, best.y, best.al, best.e, hp); grow(best.x, best.y + dp, best.al, best.e, hp); grow(best.x, best.y - dp, best.al, best.e, hp);
          grow(best.x, best.y, best.al + da, best.e, hp); grow(best.x, best.y, best.al - da, best.e, hp);
          if (it < 3) { if (best.e + 1 / E_STEPS <= 1) grow(best.x, best.y, best.al, best.e + 1 / E_STEPS, hp); if (best.e - 1 / E_STEPS >= 0) grow(best.x, best.y, best.al, best.e - 1 / E_STEPS, hp); }""",
    """            fitIn(b0.room, hp, b0.al + da, b0.e, b0.st); fitIn(b0.room, hp, b0.al - da, b0.e, b0.st);
            if (it < 2) { if (b0.e + 1 / E_STEPS <= 1) fitIn(b0.room, hp, best.al, b0.e + 1 / E_STEPS, b0.st); if (b0.e - 1 / E_STEPS >= 0) fitIn(b0.room, hp, best.al, b0.e - 1 / E_STEPS, b0.st); }
          }
          const st = best.st;
          grow(best.x + dp, best.y, best.al, best.e, st, hp); grow(best.x - dp, best.y, best.al, best.e, st, hp); grow(best.x, best.y + dp, best.al, best.e, st, hp); grow(best.x, best.y - dp, best.al, best.e, st, hp);
          grow(best.x, best.y, best.al + da, best.e, st, hp); grow(best.x, best.y, best.al - da, best.e, st, hp);
          if (it < 3) { if (best.e + 1 / E_STEPS <= 1) grow(best.x, best.y, best.al, best.e + 1 / E_STEPS, st, hp); if (best.e - 1 / E_STEPS >= 0) grow(best.x, best.y, best.al, best.e - 1 / E_STEPS, st, hp); }""")
rep("""      const mk = { x: best.x, y: best.y, al: best.al, e: best.e, s: best.s }, S = shapeOf(mk.e), mid = decimate(S.dense, mk.s, 0.03, 12);""",
    """      const mk = { x: best.x, y: best.y, al: best.al, e: best.e, st: best.st, s: best.s }, S = shapeOf(mk.e, mk.st), mid = decimate(S.dense, mk.s, 0.03, 12);""")
rep("""      if (K.debug) K.debug({ t: 'fit', from: best.room ? 'room' : 'grid',""", """      if (K.debug) K.debug({ t: 'fit', from: best.room ? 'room' : best.tail ? 'tail' : 'grid', st: mk.st,""")
rep("""      if (gap < c - 5e-4 || mk.s * S.span < (bare > K.bareNeed ? K.floor : K.floorWant)) { stop = 'floor'; break; }""",
    """      if (gap < c - 5e-4 || 2 * mk.s < K.headMin || mk.s * S.span < (bare > K.bareNeed ? K.floor : K.floorWant)) { giveUp(bx, by, 0.9 * bareR); continue; }""")
rep("""    if (!stop) stop = 'max';
    if (stop !== 'goals' && stop !== 'cover') census();""", """    if (!stop) stop = marks.length >= K.maxMarks ? 'max' : 'floor';
    census();""")
rep("""    const flaw = K.wBare * Math.max(0, bare - K.bareNeed) +""", """    const flaw = K.wBare * Math.max(0, bareAll - K.bareNeed) +""")
rep("""    return { marks, bare, cover, stop, tiny, flaw };""", """    return { marks, bare: bareAll, cover, stop, tiny, flaw };""")
rep("""e: fam.marks.map((m) => +m.e.toFixed(2)), tried,""", """e: fam.marks.map((m) => +m.e.toFixed(2)), st: fam.marks.map((m) => m.st), tried,""")
io.open(p, 'w', encoding='utf8').write(s)
print('edit2 ok')
