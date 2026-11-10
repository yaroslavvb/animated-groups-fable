# snowflake agent — notes for the other owners

## 2026-11-09 — what `src/folds/snowflake.js` gives, and what to do with it

Files: `src/folds/snowflake.js`, `test/snowflake.test.js`, `src/groupdata/kaleido.js`; scratch tools
`dev/snowflake-probe.mjs` (numbers), `dev/snowflake-steps.mjs` (writes the step files), `dev/snowflake-coremesh-check.mjs`;
pictures and step files in `qa/snowflake/`. No change is requested in anybody's file. Facts to code against:

### For the integrator (`src/folds/index.js`, `src/app.js`, `test/folds.test.js`)

- `createFold(group, domain, mesh, opts)` ignores `mesh` (the mesh of the single tile) and returns its own
  `fold.mesh`: the star of the 2n cells around one corner (12 for ∗632, 8 for ∗442, 6 for ∗333, 4 for ∗2222).
  **Draw everything from `fold.mesh`**: `xy`, `cell`, `tri`, `tint`, `boundary`, `creases`, `locate`.
- **Piece indices beyond `mesh.cells`.** `mesh.cells` holds the 2n cells (piece 0 = the base tile, the cell that holds
  the seed). `at(t)(x, y, piece, out)` also knows pieces that are not cells: the rows of the spine strips, one
  "crease piece" per crease, and the "lid". Their indices are `>= mesh.cells.length` (and `< mesh.pieces`). They only
  appear in `mesh.cell`, `boundary[i].cells`, `creases[j].b` and as the result of `mesh.locate`, i.e. exactly where a
  piece index is handed straight back to `at(t)`. **Do not index `mesh.cells` with a piece index you got from there.**
  (A piece `at(t)` does not know is treated as the base tile.)
- **The lid** (`mesh.lid`): stays over the base tile, at the height of the top sheet lying on it. The boundary samples
  have it as their cell, and `mesh.locate(x, y)` returns it for a point of the base tile. So the tile's outline, the
  cone-point markers and anything else you draw "on the tile" through `locate` (the motif) ride on top of the stack
  instead of being buried under up to eleven sheets. This is honest: every sheet of the stack is a mirror copy of
  the tile and carries the same outline and the same motif at the same place; the one you see is the top one.
  (The base tile's own surface is piece 0, never moves, and ends at the bottom of the stack.)
- **Creases**: `creases[j] = { a, b, pts, cells, fold }`. Draw with `b` (as `dev/fold-demo.html` does): `b` is the
  crease piece, the middle between the two sides of the crease. Before the crease is folded that is the paper
  itself; afterwards it is the axis of the fold, so the creases that end up along one folded edge of the stack are
  drawn as one dashed line instead of a ladder of them. `a` is the cell on the side that stays (a real cell);
  `cells` are the two cells the crease separates; `fold` is the index of the fold that creases it.
  During the last fold every crease piece also drifts up to the height of the lid, so at t = 1 the 2n creases lie
  on the two sides of the tile at the pivot, exactly under its bold outline: nothing stray is left, faded or not.
  (Draw the boundary after the creases, as the demo does.)
- **The motif on every cell** (optional, but it is the point of a kaleidoscope: all copies land on one).
  `fold.cellMaps[i]` is the group element that carries the base tile onto cell i, so
  `apply(fold.cellMaps[i], x, y)` drawn with piece `i` is the copy of a motif point (x, y) of the base tile on cell i
  (i = 0 … `fold.star.length - 1`; for i = 0 use piece `mesh.lid` or 0). At t = 1 the 2n copies coincide.
- `fold.star`: the 2n cell polygons (counter-clockwise, `star[0]` = the base tile) for `P.setScene({ star })`.
- `stops`: 0 `flat`, then one per completed crease (`half`, `quarter` / `third`, `sixth`), 1 `folded`.
  Durations 4.6 s (∗2222), 5.8 s (∗442, ∗333), 7 s (∗632).
- **Sizes for a generic continuity test.** The patch is much larger than the tile and its far corners swing through
  half a turn, so the largest vertex displacement per 1/200 step is 0.028 (∗2222), 0.033 (∗442), 0.035 (∗333),
  0.044 (∗632) world units = 0.05, 0.09, 0.09, 0.16 tile sizes (`sqrt(domainArea)`) for the preset tiles (another
  tile of the star can reach 0.046 = 0.13 tile sizes for ∗442); mean over the 200 steps about 0.6 of that; the speed
  is zero at every stop. Halving the step halves these numbers.
- `node --test test/snowflake.test.js` needs about 8 s. (My last two runs of the whole suite at the root did not
  finish: after about 70 s of CPU one test process — not one of mine, they had all reported — was left suspended,
  state T, and never resumed. Processes of `tools/shot.mjs` were sometimes left suspended the same way after
  writing their pictures. I do not know what suspends them.)
- Seam closure (SPEC 5.3 (2)) is vacuous: the tile has no cut edge. `test/snowflake.test.js` tests instead that at
  t = 1 every cell lies exactly on the base tile, one sheet per layer.
- Other extras on the fold object: `pivot`, `order` (n), `spacing` (world units between sheets), `chirality`,
  `folds[i] = { t0, t1, angle, axisHeight, cells, sheets, lidFrom, lidTo }`, `lid`, `pieces`.
- Dragging the seed inside a cell changes nothing; across a mirror the base tile becomes the neighbouring cell. The
  star stays the same as long as the seed stays inside it (the stars around the corners of one kind tile the plane).
  Which of the tile's two mirrors at the corner is creased first depends on the tile: the one that reads better
  from the default view (level rather than pointing at the viewer; the far half coming toward the viewer).
- With "Wavy" up nothing changes: the warp slides points along the mirrors, the tile is the same polygon.
- Cost: `createFold` about 1–3 ms, one `at(t)` plus all vertices about 0.05 ms; at most 4224 triangles (∗632).

### What the pictures cannot do

- The fold goes over the top (+z), so the base tile ends at the BOTTOM of the stack: from above, the finished stack
  is ghost grey (twelve translucent sheets are opaque), with the tile's bold outline and markers on top (the lid)
  and a teal sliver of the base tile at the foot of the near edges. Seen from below it is the teal tile.
- A flap that turns about a crease pointing straight at the viewer is seen edge-on half way (a page turning, seen
  from the reader's seat). With the default view that happens once per group, for a later, smaller fold
  (∗2222: the second fold; ∗442: the second; ∗333: the third; ∗632: the third). Turning the view shows it.

### For the plane agent

- `src/groupdata/kaleido.js` now sets `center` for ∗333 (`[1/2, sqrt3/6]`) and ∗632 (`[0, 0]`), so the star is in
  the middle of the plane window, and the seed of the one preset for ∗442 (`[1/6, 1/3]`) and ∗632
  (`[-1/4, -5 sqrt3/36]`): the tile is the cell from which the folding reads best in the default 3D view.
- ∗632 has `viewHalf: 0.85` as you suggested (the star sits at the window's centre now, so it is whole).
