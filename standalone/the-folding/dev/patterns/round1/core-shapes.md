# The first run's report: core:shapes (13 Nov 2026, cut-off run; claims to check, not facts)

KIT.JS — two faults and two smaller points (kit.js untouched, mtime still 15:33)

1. BUG, `dev/patterns/kit.js` lines 196-199 (`stabilizerOrder`), used at 177 and 183 (`if (W > stab) over++`). It counts the elements that fix the centre of the motif's bounding BOX, not the elements that map the motif onto itself. It fails both ways:
   - **False alarm.** A motif with 3-fold symmetry on a 3-fold centre (333, 632, 3*3, *333, *632) has its box centre off the rotation centre. A rosette there gave kit stabiliser 1 (333), 2 (3*3, *333) where 3, 6, 6 are right. In 333, 632 and 3*3 `measure().overlap` equalled the coverage, so the whole motif counts as overlap and proto.html would print "copies overlap".
   - **Blind spot.** A motif whose box is centred on a rotation centre but which lacks that symmetry gets stab = the centre's order, so `W > stab` never fires. The triangle `[[-0.3,-0.2],[0.3,-0.2],[0.09,0.2]]` in 2222 gave kit `stabilizerOrder` 2 and overlap 0; in fact 4.3 % of the plane is covered twice.
   - No design present at 16:40 trips it. The `blobs` design did at 16:30 (kit 4, 6, 8, 2 against 2, 1, 1, 1 in 442, 632, *442, *632) before it was rewritten.
   - A replacement, tried on 211 motifs (the test motifs and every design that loaded at 16:40): it agrees with `validateShapes().stabilizer` on all of them, about 2 ms a motif. It is in `dev/patterns/scratch-core-shapes/kit-fix.mjs`:
   ```js
   export function stabilizerOrder(group, N) {
     const tol = 1e-6 * Math.sqrt(group.domainArea);
     const onOutline = (x, y) => {
       for (const P of N.polys) for (let i = 0, n = P.pts.length / 2, j = n - 1; i < n; j = i++) {
         const ax = P.pts[2 * j], ay = P.pts[2 * j + 1], ex = P.pts[2 * i] - ax, ey = P.pts[2 * i + 1] - ay, l2 = ex * ex + ey * ey;
         const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0;
         if (Math.hypot(x - ax - t * ex, y - ay - t * ey) <= tol) return true;
       }
       return false;
     };
     let k = 0;
     for (const g of elementsNear(group, N.cx, N.cy, 2 * N.R, N.cx, N.cy)) {
       let same = true;
       for (const P of N.polys) for (let i = 0; i < P.pts.length && same; i += 2) same = onOutline(g.a * P.pts[i] + g.b * P.pts[i + 1] + g.tx, g.c * P.pts[i] + g.d * P.pts[i + 1] + g.ty);
       if (same) k++;
     }
     return Math.max(1, k);
   }
   ```
2. INACCURACY, lines 172-174, 183, 193: `measure().coverage` is taken over a square window that is no whole number of periods. On the page's comma (per 28) it is off by -8.3 % (2222), +5.4 % (442), +3.4 % (*2222), -3.1 % (xx) of the exact share; the header says "good to about 1 / per". The two discs are not affected.
3. Latent limit, line 121: `windingAt` looks at 5 x 5 lattice translates, which is right only while `N.R < 2.5 * cellArea / max(|e1|, |e2|)` (1.47 world units in *x, the smallest). No design is near it.
4. Doc, line 24: the header lists `minGap` in `measure`'s result; it returns none.

WHAT I BUILT

- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/src/shapes.js` (872 lines; pure, no DOM, no imports)
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/test/shapes.test.js` (15 tests)
- Scratch scripts in `W/dev/patterns/scratch-core-shapes/`; pictures in `/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/core-shapes/` (`sheet-front.png`, `sheet-back.png`)

API as built

- `GAP_MIN = 0.02`, `MAX_VERTS = 2400`
- `makeShapePrint(group, { key = 'shapes', name = 'shapes', shapes, info } = {})` -> frozen Print with exactly the fields of the brief: `key, kind: 'shapes', name, info, cell, tone, winding, margin, polys, cx, cy, R, verts, e1, e2, inv, reps, size, netArea`.
  - `shapes` is a list of `{ pts, hole? }` or bare point lists; points are `[[x, y], ...]` or flat, typed arrays too.
  - It reads only `e1`, `e2`, `reps` of the group.
- `shapeElements(print, box)` -> `[{ a, b, c, d, tx, ty, rep }]`
- `fillShapes(c, print, map, box, fillStyle)` -> number of copies; one path, one `c.fill('nonzero')`
- `copiesIn(print, box)` -> `[{ pts: Float64Array, hole, box }]`
- `validateShapes(print, { gap = GAP_MIN } = {})` -> `{ ok, problems, gap, stabilizer }`
- `measureShapes(print, { per = 56, center = null } = {})` -> `{ coverage, coverageExact, emptyDisc, darkDisc, overlap, verts, stabilizer }`

DIFFERENCES FROM THE BRIEF, AND WHY

- **Bounding circle.** `cx, cy, R` is the smallest enclosing circle, not kit's box-centred one. It is never larger, culls tighter, and every symmetry of the motif fixes its centre.
- **Repeated points.** A point within max(1e-12, 1e-9 size) of the one before it is dropped; kit drops only the repeated last point. Otherwise a zero-length edge reads as "touches itself". `verts` can differ from kit's for such input.
- **`makeShapePrint` also throws** for an odd number of coordinates and for a group without lattice or representatives.
- **`shapeElements`** culls by the copy's bounding circle and the box of its polygons' boxes, so it lists fewer rim copies than `kit.orbitElements`; none that reaches in is left out.
- **`fillShapes`** takes a map that returns `out` or only writes into it.
- **`validateShapes` returns two extras:** `gap`, the exact smallest outline distance between two copies that do not coincide, in tile sizes; and `stabilizer`.
- **`validateShapes` checks three rules the kit header leaves unsaid:**
  - a polygon touches itself (pinch, slit, zero-width spike);
  - two polygons of one motif cross, touch or lie on each other (an island in a hole is fine);
  - a polygon has no area.

  Each would put an outline inside the dark, which the SDF shows as a hairline. No design present at 16:40 is rejected by these.
- **"Coincide"** is checked both ways and on edge midpoints too.
- **Roughly symmetric motifs** get an extra line: "the motif has a symmetry of the group only roughly: a copy of it strays up to X tile sizes ...". At 1e-6 a motif made symmetric by an inexact method fails, as the brief defines.
- **Above 40000 vertices** the outlines are not examined, and a problem line says so.
- **`measureShapes` coverage and overlap** are sampled over exactly one lattice cell, not kit's window; that is what makes the 1.5 % test hold.
- **`measureShapes` discs** use kit's window, about `opts.center` (default the motif's centre).
- **`coverageExact`** is null when the geometric check finds copies crossing, touching or nested, not when a sample happens to hit an overlap.
- **A motif that breaks the rules** has kit's W (crossing rule per polygon). Where W < 0 (a hole outside every polygon) `tone()` is light but the nonzero canvas fill is dark; `validateShapes` flags the motif.
- **Motif (c) cannot exist in o and xx** (no fixed points). They are tested with comma, blob and a triangle; the other 15 groups also get a rosette on the centre with the largest stabiliser (orders 2 to 12), and the ten with mirrors an egg on a mirror.

VERIFIED

- **Tests.** `test/shapes.test.js` has 15 tests on 74 prints (17 comma, 17 blob, 17 triangle, 13 on a centre, 10 on a mirror). Every item the brief lists is there. Beyond the brief:
  - W by brute force on the seams of the lattice reduction, at vertex heights, and with the comma blown up 2.5 and 6 times;
  - the gap by brute force;
  - other coset representatives and skew or left-handed bases;
  - 14 kinds of planted fault;
  - W equal to kit's, including motifs that break the rules.
- **Last lines** of `bash dev/patterns/suite.sh test/shapes.test.js test/pattern.test.js`:
  ```
  333:# tests 21
  335:# pass 21
  336:# fail 0
  337:# cancelled 0
  338:# skipped 0
  340:# duration_ms 7206.352583
  suite.sh: exit 0
  ```
- **Whole suite** (`bash dev/patterns/suite.sh`): 854 tests, 852 pass, 0 fail, 2 skipped.
- **Without `dev/`** (what `tools/test-all.mjs` sends): 14 pass, the kit comparison is skipped.
- **Planted faults in `shapes.js`** (34, in a throwaway copy on the mini): all 34 caught.
- **Real Chrome canvas** (mini): 49 canvases, 398,266 grid points at least 1.5 px from an outline, 0 differ from `tone()`. I looked at both sheets: marks, holes and islands are right, coincident copies draw as one pale shape, and the tile shows the two front or back tones.
- **`copiesIn` into `src/sdf.js` `bakeSDF`** (the other agent's file, read only, as of 16:45): 49 textures of 96 x 96, 451,584 texels, every byte equals `round(128 + 127 sd / range)` from my `winding` and `margin`.
- **Designs as they stood at 16:40** (a snapshot, their authors were still working):
  - W equals kit's at all 20,400 sampled points across the eight designs that loaded with all 17 groups;
  - `bigcomma`, `feet`, `glyph`, `paisley`, `ripple`, `spiral`, `swell` and `demo` pass `validateShapes` in all 17 groups;
  - `hook` and `mosaic` threw "no spec" / "no knobs" in their own `find`;
  - `blobs` then had copies crossing in 13 groups, and was rewritten afterwards.

SPEED (300-vertex comma)

| | tone() | margin() |
|---|---|---|
| mini, node 24 | 7.2 M/s (*632), 15.6 M/s (22x), 21 M/s (o) | 0.77 to 2.0 M/s |
| this Intel Mac, node 25 | 2.9 M/s (*632) to 12.9 M/s (o) | 0.3 to 0.66 M/s |

On the Intel Mac `makeShapePrint` takes 0.8 ms and `validateShapes` 1 ms per group at 300 vertices; `measureShapes` 47 to 143 ms. On the mini `validateShapes` on a 2400-vertex motif took 1 ms. The test's floor is 150,000 `tone()` calls a second.

NOT DONE OR NOT VERIFIED

- Nothing is wired in: `pattern.js`, the plane and the renderer do not import `shapes.js` yet (the glue agent's job).
- `fillShapes` was checked in Chrome only, not WebKit.
- The two discs of `measureShapes` are sampled, good to about 1/per, as kit's.
- A comb-like polygon (every edge spanning the full height) gets few slabs: `tone()` is then about as slow as counting every edge. Memory is bounded; this path is not speed-tested.
- One suite run failed with "rsync: files vanished" while another agent was deleting its scratch folder; the rerun passed.
