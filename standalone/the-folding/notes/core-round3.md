# core — round 3 (fixer "core": `src/domain.js`, `src/mesh.js`, `test/domain.test.js`, `test/mesh.test.js`)

Findings: `qa/round3-triage.md` § core (#1 major, #12 minor). Pictures: `qa/round3-core/`.

## #1 — Wavy at 1 leaves cut edges straight (fixed, 9 Nov 2026, 23:20)

**What was wrong.** A transverse wave bends a straight segment only through the part of its wave vector that runs
along the segment; with four (or fewer) waves of fixed phases, many preset edges sat near a node. And for 22x and 22*
all chosen frequencies had even m, so the field had the extra translation e1/2: composed with a glide that is a
reflection the field is equivariant under, and the 22x 'Pocket' glide edges lie on its line (bow exactly 0).
Reproduced with `node dev/core3-bow.mjs` (the reviewer's measure on the current sources): 35 preset edges longer than
30 laptop px bowed under 4 px; 22x Pocket 0.0 px, ** Strip 0.8 px, 2222 Envelope 0.8 px, 333 Hexagon 1.8 px.

**What changed (`src/domain.js`, `buildField` → new `chosenWaves`).** For every group with cut edges the waves are
chosen at run time for the cut edges of the group's presets (and of six fixed probe tiles, at half weight, so a
dragged cut stays wavy too). The first-order bow is linear in the weights of the waves, so it is one matrix per group;
a seeded random search (800 tries per band) over J orbits of waves, phases and weights maximises the smallest bow /
target, the best four are refined and re-ranked by their true peak. Bands of |kappa| are tried lowest first
([0.75, 1.3], 1.6, 1.9 K), stopping when one is enough, and the lowest band within 85 % of the best wins: short waves
make long edges crinkly. The frequencies must span the reciprocal lattice (no extra translation); the field must keep
det D psi >= 0.75 (gentle; keeps `warp.bend` tight for mesh.js). Deterministic (seeded, integer-ordered, 1e-9
margins). The kaleidoscopes (no cut edges) keep their old field bit for bit. Peak (8.5 % of the tile size), the
equivariance, inv/fwd, tangency to mirrors and zero at centres are unchanged. New: `warp.waves` = {band, rel, bands,
waves} (diagnostics; null at amp 0 and for the kaleidoscopes).

Because the field is chosen from the presets, it follows preset edits by other fixers automatically (the hinge fixer
changed 22* and 4*2 presets during this work; nothing to redo).

**Numbers** (presets, exact bow through warp.fwd, laptop = 550 px across the plane window):
- edges longer than 30 laptop px bowing under 4 px: 35 → 0; smallest 0.0 px → 4.50 px (22* Pentagon, 48 px edge);
- smallest bow / target over all preset edges: 0.000 → 0.446 (target = P min(1, (L / 0.4 size)^2));
- random tiles, share of long cut edges under 4 px: *x 100 % → 15 %, 333 53 → 3 %, 632 52 → 13 %, 2222 35 → 14 %,
  22* 40 → 11 %, 2*22 40 → 0 %, 3*3 46 → 0 %, 22x 33 → 12 %, xx 18 → 12 %, o 10 → 1 %, ** 22 → 0 %, 442 28 → 4 %;
- field build (once per group, at the first Wavy move): 3–15 ms warm in node (was 0.5–3.5 ms); Jacobian min 0.75–0.92.

**Tests** (`test/domain.test.js`, all fail on the old field, pass on the new): every preset cut edge bows >= 0.35 of
its target and >= 4 laptop px (edges > 30 px); random tiles: at most 25 % of long cut edges under 4 px per group; no
extra translation (e/k for k = 2, 3, 4, 6) and no glide axis the field is symmetric in; the choice is deterministic.
All 17 old domain tests pass (the `bend` tightness test failed once for a 22* field at det 0.64; the det >= 0.75 rule
fixed that without touching how `bend` is computed).

**Pictures**: `qa/round3-core/fieldview-1.png` … `-3.png` (every preset tile, old field left, new right; made by
`node dev/core3-fieldview.mjs` + `tools/shot.mjs`), app screenshots below.

## Request to the cross-cap fixer (`src/folds/crosscap.js`, `test/crosscap.test.js`) — 9 Nov 2026, 23:20

The new field of #1 (it bends 22x Pocket's glide edges, which were exactly straight) makes two tests of
`test/crosscap.test.js` fail; both pass with the old field (checked in a scratch copy of the workspace with the old
`src/domain.js`). Neither is a fault of the tile or its mesh; both are cross-cap stage 2 meeting wavy tiles that the old
field happened to avoid. Repro: `node dev/core3-crosscap-repro.mjs` (about a minute).
1. **'anchor (SPEC 7) 3'** (Hexagon dragged across x = a/2, amp 1, t = 0.75: "does not shrink with the step: a jump").
   Cause: `lift` (crosscap.js ~line 541) is a plain SUM over the drawn mesh's vertices and boundary samples, and a
   tile mesh gains or loses vertices one by one as the seed moves (a cut point appears where the warped boundary
   crosses a vertex of the fine mesh). At seed x = 0.6007887 a seed step of 1.3e-8 takes the tile mesh from 927 to 934
   vertices, `fold.lift` from 0.5959 to 0.5523, and moves points by 2.2e-3 tile sizes. Request: make the lift (and
   anything else summed over vertices) continuous in the seed, e.g. weight each vertex by the area of its triangles
   (a new vertex brings zero area with it) or integrate over the triangles. `nearReach` is a max and stays continuous.
2. **'stage 2 (acts)'** (Bowl, amp 1: near triangles cross the far part at t = 0.85-0.99, 52 crossings). The crossing
   triangles belong to the small lobes across the cell's sides (pieces of 1.5 % of the tile, depth 1), near lobe x far
   lobe at t = 0.85, plus a few with the main piece at 0.9-0.99. The Bowl's edges lie ON the creases, so any wavy cut
   gives it such lobes on every side; where they land decides the count. Request: keep the near lobes clear of the far
   ones as the zip closes (or, if 1.5 % lobes touching for the last 15 % of the fold is acceptable, say so in the test
   with a bound instead of 0; your call, not mine).
If 2 cannot be done this round, the core fixer can freeze the 22x field to one that passes, but that is luck, not a fix:
the next change of a 22x preset re-rolls it.

## #12 — dragging with Wavy on rebuilds too slowly (fixed in mesh.js; the app's half is a request, below) — 23:45

**Reproduced** (`node dev/core3-perf.mjs`, a drag of half a tile size in 40-60 steps, the densities the app asks for):
xx at Wavy 1 rebuilt its mesh in 11.4-13.6 ms (median; 9,100 `warp.inv` calls per build), o 8.7-10.6 ms, 2222 6.9-10.5.
3,700 of xx's inverses were for vertices of the grid, 2,800 inside the exact boundary crossings.

**What changed (`src/mesh.js`).**
1. *Free, bit for bit the same mesh:* a vertex that lies deeper inside every edge line than any point is displaced
   (1.25 x `warp.peak` + the notch margin) is classified without `warp.inv` (all its masks are 0); its exact straight
   coordinates are computed only if a cut or a halving takes it as an end (the same call, so the same numbers).
   790 meshes (17 groups, presets, seeds a hair off them, random seeds, Wavy 0 / 0.3 / 1, the app's densities)
   compared array for array with the old mesh.js: 0 differ (`node dev/core3-meshcmp.mjs`). Gain: xx -25 %, ** -19 %,
   *x -16 %, o -7 %, the hinge groups 0-5 % (their tiles are mostly near a crease or the boundary).
2. *Opt-in for the frames of a drag:* `buildMesh(group, domain, { ...opts, draft: true })` builds the mesh at
   `DRAFT_DENSITY` = 0.65 of its density (exported constant): about 0.42 of the triangles, the same structure and the
   SAME boundary samples (so the seams are drawn exactly as in the full mesh). Without `draft` nothing changes.

**Numbers** (node 25, this Intel at load 4-6; old = mesh.js before round 3, both with the new field of #1):
- mesh, wavy builds (`dev/core3-meshcmp.mjs --opts '{"draft":true}'`, old default vs new draft): xx 10.7 -> 4.0 ms,
  o 9.6 -> 4.3, ** 6.2 -> 2.4, 2222 6.8 -> 3.7, 22x 4.2 -> 2.8, 333 4.2 -> 2.6, 632 5.0 -> 3.0 ms (37-66 %).
- one drag frame of the scene (buildDomain + buildMesh + createFold, `node dev/core3-dragcost.mjs`, new mesh.js,
  full vs draft): xx 9.0 -> 4.5 ms (p95 10.0 -> 5.3), o 7.1 -> 3.7, 2222 8.9 -> 5.6, 22x 8.3 -> 5.2, 632 6.4 -> 4.3.
- lab box (test/mesh.test.js prints it): full -> draft xx 5.0 -> 2.5 ms, o 3.8 -> 2.0, ** 3.2 -> 1.0, 2222 6.1 -> 3.4.
- in Chrome 157 (the mini's pool; `tools/shot.mjs --page dev/app-demo.html --steps dev/core3-dragcost-steps.json`),
  median / p95 ms per drag frame, mesh.js before round 3 / today / today with draft: xx 4.2/4.5, 3.3/3.7, 1.7/1.8;
  o 3.0/3.3, 2.5/2.8, 1.3/1.5; 2222 3.4/4.9, 3.3/4.1, 2.0/2.3; 22x 2.8/3.2, 2.7/3.2, 1.8/1.9; 632 2.6/3.1, 2.6/3.2,
  1.7/2.1. (The mini is about three times as fast as this Intel, where the reviewer measured 21.5 ms p95 for xx.)

**Tests** (`test/mesh.test.js`, 20 of 20 pass remotely): 1,098 draft meshes (17 groups x presets and 30 random seeds x
Wavy 0 and 1) go through every check of the suite (disc, rim, no T-junction, pieces, tree, locate, boundary, parity,
sheets, seams); the deep-vertex shortcut changes nothing, array for array (a warp without `peak` gets no shortcut:
208 meshes compared); a draft mesh has under 55 % of the triangles, the same boundary samples, and costs under 0.8 of
the full mesh (0.35-0.68 measured).

## Request to the ui-app fixer (`src/app.js`) — use the draft mesh while the cut is dragged (finding #12)

Nothing changes until the app asks; the still picture stays exactly as it is. Three small edits:
1. `buildScene(group, { seed, metric, amp = 0, anchor, draft = false } = {}, prevDomain = null)`:
   `const tileMesh = ... buildMesh(group, domain, { ...foldMeshOptions(group), draft });` and
   `const foldOpts = foldOptions(draft ? { anchor, density: false } : { anchor });` — `density: false` makes a roll
   fold keep the draft mesh (roll.js `fineMesh` rebuilds a mesh coarser than `rollDensity` otherwise; hinge, cross-cap
   and snowflake ignore it).
2. `rebuild({ immediate = false, recolour = false, draft = false } = {})` passes `draft` to `buildScene`.
3. `onSeed`: phase `'move'` → `rebuild({ draft: true })`; phase `'end'` → `rebuild()` (full mesh), then `flushHash()`.
   The Wavy slider can do the same: draft on `input`, full on `change`.
At pointer-up the same surface is re-triangulated: the boundary samples are the same, the roll folds' maps do not look
at the mesh, the hinge folds' only through its pieces (the same, except possibly a micro-lobe), so the shape stays and
the facets get finer. One exception until the cross-cap request above is done: 22x's stage 2 reads the mesh's vertices
through `lift`, so there the folded shape can shift by a few 0.1 % of the tile at pointer-up.

## Status at the end of the round (9 Nov 2026, ~23:50)

- The cross-cap fixer answered the request (`src/folds/crosscap.js` 23:20, `test/crosscap.test.js` 23:22): `lift` is
  now an integral over the area of the near part. `node dev/core3-crosscap-repro.mjs`: the jump at a seed step of
  1.3e-8 fell from 2.2e-3 to 3.5e-5 tile sizes; both of their tests pass. So the 22x exception noted under the ui-app
  request is gone.
- Same field in node and in a browser: `node dev/core3-digest.mjs` and its EVAL in Chrome 157
  (`dev/core3-digest-steps.json`, compared with `dev/corefix-warpcmp.mjs`): 17 of 17 groups identical (band, score to
  12 digits, displacements at three points to 14 digits, bend, Jacobian).
- `node tools/test-all.mjs` (remote, whole suite): 663 tests, 661 pass, 0 fail, 2 skipped (opt-in ones).
- The ui-app request (draft mesh during drags) is open: until it lands, the app gets only the free part of #12.
- Scripts kept in dev/: core3-bow (bows of every preset edge), core3-fieldview (before/after sheet),
  core3-domain-old.js / core3-mesh-old.js (the two files before round 3, for comparisons), core3-meshcmp (bit-identity
  and timing), core3-perf / core3-dragcost (+ -browser) (drag cost), core3-crosscap-repro, core3-digest.
