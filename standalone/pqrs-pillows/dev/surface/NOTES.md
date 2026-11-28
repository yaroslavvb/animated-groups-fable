# surface: notes (owner of `src/solver.js`, `src/flat2222.js`, `src/surface-model.js` and their tests)

Fri 27 Nov 2026, 16:02–16:55. Every number here was measured in this run (script named beside it).

## For the integrator

- **`frame.positions` has more vertices than `mesh.open`**: the open vertex set PLUS a second copy of the loop's ring (the other pillow's rim), so that no triangle has corners on both pillows and the pillows part without the pane's `setOffsets`. Use `frame.nVertices`; `frame.vertexPillow[v]` says whose a vertex is, `frame.closedOf[v]` which closed vertex it copies.
- **`frame.cornersVersion`** (added): `corners` change with every change of L, Twist or cut while `version` (triangles) may not; the chart points (uv) must be refreshed when `cornersVersion` moves, not only on `version`.
- **`version` moves during a Twist drag**: every 1 / nTheta of a turn (about 1/76) the zipper strip's triangles change (pillow.js `strip.cells`); the vertex set and ids stay. After a flip `version` may stay (same grid, same triangles): only `cornersVersion` is sure to move.
- **`flip()` returns `{ turn, shift, cold }`**: new pose = `turn` * old pose + `shift` for every point (`turn` 3 x 3 row-major). Each pose has its own loop's middle at the origin, so `shift` is not zero: measured at the default flips (`dev/surface/shift.mjs`) 0.003 of the frame radius on 3333 and 4444, 0 on 2222, but 0.13–0.17 on 2345 and 0.44 on 2223. The pane already takes it: `pane.turn(r.turn, 0.5, { inverse: true, shift: r.shift })`; `src/page.js` line 228 passes `{ inverse: true }` only, so on 2345 and 2223 the turn starts with a jump of that size until `shift` is passed there (keep `r.shift` beside `r.turn` at line 219–220).
- **Curves**: one `loop` at j = 0, two (same id, `pillow` 0 and 1) for j > 0; one `seal0` / `seal1` each up to j = 1, two of each (the two copies) for j > 1. The list changes with j, `version` does not: `setCurves` every frame.
- **Marks**: `id` is the FEATURE's letter (`'PQRS'[feature]`), `slot` the engine's slot, `pair` 0 for slots 0, 1 (the cut's first pair, blue), `order` and `label` (`'P3'`: the pane uses `mark.label` when it is there).
- **`flip(newState, { invQ, before })`**: if the model stands a slider step away from `before` (a frame the page skipped) it is brought there first; another signature, or no `invQ`, is a cold start.
- **Idle frames matter**: `sm.settle(ms)` (page.js already calls it) goes on relaxing AND, when a drag has left the shape poor (mean stretch over 2.5 %) or on a grid made for another Length, starts again cold: one pause of about 0.25 s and a visible change of shape. `sm.update()` does the same at once above 6 %. `sm.restarts` counts them.
- **Added to the spec's 3.3 block**: `sm.settle(ms)`, `sm.mesh`, `sm.closed`, `sm.crown`, `sm.state`, `sm.restarts`; `frame.gap`, `nVertices`, `vertexPillow`, `closedOf`, `cornersVersion`; `mark.slot`; `flip().shift`, `flip().cold`; options `followCreases`, `flatMinConorm`, `solver`, `createSurface`, `settleSweeps`, `restartAt`, `tiredAt`.
- **2222 flat states** (pane note 4): `createSurfaceModel({ flatMinConorm: 4e-4 })` gives them Twist of 2222's thickness; default 0 (exact, two sheets on one another). The pane's `puff` already cures the look, so I left it exact.
- **2222's saw-toothed creases** (pane note 5): done here: `followCreases` (default on) moves mesh vertices onto the solid's creases; `corners` use the moved chart points, so `chartOf(f.corners)` stays right. Measured at L = 1, Twist 0.25: 560 of 16,416 triangle sides crossed a crease, now 0.
- **A replacement solver** must give pillow.js's mesh as `surf.mesh` (built with `P.orbifoldMesh(orders, L, tw, { nTheta, nS })`; `open`, `seals`, `strip`, `frame`, `ringOwner` are read) and closed positions in its vertex order; `prepare(orders, L, tw)` (mesh without relaxing), `relax(n)`, `settle(ms)` are used when present, else `set` / `update`. `stats().strainMean` drives the restarts above: a solver that reports none never restarts.
- **2222 where the lattice does not reduce to the pair** (L above about 1.41, some long pairings after a flip): the solid is the lattice's, so the loop is not level and the first seal is not the edge PQ but winds round the solid. Exact; it does not read as "two pillows".
- **3333 at Twist 0 after the flip to the diagonal pairing**: the four tips lie in one plane, so in the new pose they are all level with the loop (the solid lies flat, the loop waves ±0.31): true to the shape, odd to look at.

## What is here

| file | what | state |
|---|---|---|
| `src/solver.js` | `createSurface` behind the PROTO-SPEC interface (`set`, `update`, `positions`, `mesh`, `adoptPositions`, `stats`; extras `prepare`, `relax`, `settle`, `result`): position-based baseline | works, deterministic; wrinkled (below) |
| `src/flat2222.js` | `solid`, `mapF`, `toStage`, `reduceSuperbase`, `lattice` copied from Twist of 2222; `flatSolid`, `flatPoint`, `flatPositions`, `flatCrossings`, `flatCell`, `flatFace`, `flatSealAngle`, `flatTipDistances` | exact, tested |
| `src/surface-model.js` | `createSurfaceModel` → `set`, `update`, `settle`, `flip`, `frame(j)`; `fitRigid` | works, tested |
| `test/flat2222.test.js` | 5 tests | pass |
| `test/surface-model.test.js` | 18 tests | pass |
| `dev/surface/*.mjs`, `make-shots.sh` | `smoke.mjs` (timings), `range.mjs` (the sliders' range, drags), `shift.mjs`, `sweep2.mjs` / `sweep-knobs.mjs` / `try-solver.mjs` (the solver against `proto/common/metrics.mjs`), `shots.mjs` + `make-shots.sh` (pictures), `debug-*.mjs` | tools |

Run in `standalone/pqrs-pillows`: `node --test test/surface-model.test.js test/flat2222.test.js` → 23 tests, 23 pass, about 3.3 s (last run 16:44). The whole folder at 16:38: `node --test` → 116 tests, 115 pass; the one failure was `print3d.test.js` "overlapping commas are baked as their union" (the pane owner's).

## Numbers (2,600 vertices asked: 2,738 closed, 2,888 frame vertices, 5,472 triangles; this machine)

| what | measured | by |
|---|---|---|
| cold start `sm.set` | 243–289 ms (hyperbolic), 6 ms (2222) | `dev/surface/smoke.mjs` |
| `sm.flip` (carry, 30 sweeps, re-pose) | 9–18 ms; never cold on 3333, 2345, 2223, 4444 at defaults, 3 flips each | `smoke.mjs` |
| slider frame `update(state, 4)` + `frame(0)` | 4.3 ms (budget 4 ms); 2222: 1.1 ms | `range.mjs` |
| `frame(j)` alone | 0.02 ms (j ≤ 1), 0.04 ms (opening); a slider frame's fixed part (two sweeps, re-pose, corners redone) 1.2 ms | `frame-cost.mjs` |
| mean / worst stretch after `set` at the defaults | 3333 0.27 % / 3.4 %; 2345 0.40 % / 6.9 %; 2223 0.37 % / 7.5 %; 4444 0.24 % / 2.9 % | `smoke.mjs` |
| the same over the sliders' range (7 signatures × L 0.4, 1, 2.6, 5, 7 × Twist 0, 0.3, −0.5) | all finite; mean 0.16 %–1.93 % (over 1 % only at L ≥ 5 with Twist 0.3, and 2223 at L 2.6, Twist 0.3) | `range.mjs` |
| after a flip | mean 0.38 %–0.68 %, worst edge up to 21 % (2345), before idle frames | `smoke.mjs` |
| Twist drag 0 → 0.5 → −0.5, steps of 0.005 | finite; mean stretch up to 1.26 % on the way, 0.83 % at the end | `range.mjs` |
| Length drag 0.4 → 7 with Twist, 240 steps | 5 cold restarts on the way (each a 0.25 s pause), 3.3 % at the end, 0.85 % after the idle restart | `range.mjs` |
| shared metrics, 3333 Twist 0.125 | strain mean 0.29 %, max 4.3 %; plain edges turning over 25°: 14.6 %; crossing triangle pairs: 22 | `sweep2.mjs` + `proto/common/metrics.mjs` |
| 2222, L = 1, Twist 0.25 | triangle sides crossing a crease: 560 → 0 of 16,416 | `shots.mjs` (scene `crease-2222`) |

## Pictures (looked at; `dev/surface/shot-*.png`, made by `node shots.mjs && bash make-shots.sh`)

- `shot-twist-3333.png`: 3333 at Twist 0, 0.125, 0.25. The right kind of shape: two pillows joined at a level loop, four pointed horns; at Twist 0 the two seals are parallel and the tips lie in one plane, at 0.125 the upper pillow is turned about 45 degrees, at 0.25 the seals are square. Defects, plainly: the surface is wrinkled near the seals, the seal lines have kinks, and P's horn is not the mirror image of Q's.
- `shot-journey-3333.png`, `-2345.png`, `-2223.png`, `-2222.png`: j = 0, 1, 1.5, 2. Parting shows both rims clearly; the opening reads as an opening (the mouths widen, the crowns at j = 2 are smooth and exact). 2223: one pillow whose rim is sealed on a nearly straight segment (the (2, 2) pair's seal, chord 0.975 of its length), which lifts off alone. 2222: the doubled square, two flat pockets, two tubes.
- `shot-flipA-before.png`, `shot-flipB-after-turned-back.png`, `shot-flipC-after-new-pose.png`: 3333 at Twist 0.1, flip to PS | QR, one camera. A and B show the same silhouette with the tips in the same places, painted with the new pillows, loop and seals: the surface is carried. C is the new pose, and it does NOT read as two pillows: this cut is long (L 3.46) at Twist 0.244, its four tips are nearly in one plane, and the solid lies almost flat, a four-pointed star seen from above with the loop winding round it. That is the shape, not a fault of the pose.
- `shot-flip-2222-03-12.png`, `shot-flip-2345-02-13.png`, `shot-flip-3333d-03-12.png`: the same three stages in one row for other flips (2222's is exact: the test puts each cone point back within 1e-6).
- `shot-flip-3333-02-13.png` (three shapes in a row): do not compare shapes across the row, the camera's perspective differs for each.
- `shot-crease-2222.png`: the tetrahedron at L = 1, Twist 0.25, before and after the vertices are moved onto the creases.
- `shot-sealcompare.png`: cold starts with the seals' straightening off and on (first 0.8 of the sweeps), 3333 at Twist 0.125 and 2345: no visible gain, the kinks stay; left off (`sealBendCold: 0`).
- `solver-3333-tw0.png`, `solver-2223.png`: the solver alone, at an earlier stage of this run (after the full-length seals, before the rod).
- The scene files are not kept (21 MB): `node shots.mjs` writes them again, `bash make-shots.sh` renders, `node clean.mjs` removes them.

## What does not work, or is weak

- **The baseline's shape is wrinkled** and depends on the path: a long drag ends in a poorer shape than a cold start of the same state (0.83 % against 0.27 % after the Twist drag), hence the restarts, which the reader sees as a pause and a jump. The solver round's winner should make both unnecessary; set `tiredAt` / `restartAt` high to switch them off.
- **After a flip the shape keeps settling** toward the new mesh's own rest shape: right after the flip the tips are within one mesh cell and the six tip distances within 5 % (tests); over the next 30 idle frames a vertex moves by up to 0.020–0.033 of the frame radius (mean under 0.01), a tip by up to 0.013–0.028, the mean stretch falls from 0.45–0.68 % to 0.21–0.26 %, no restart (`dev/surface/after-flip.mjs`, five flips).
- **The opening is a straight mix**: half way, a side that swings round is shortened by the cosine of half its swing; sides at a crumple of the relaxed shape can cross (6 of 8,424 on 2223 fell under 0.3 of their length at j = 1.5).
- **One grid per cold start**; `settle()` re-grids when the Length has left it (a ratio of 1.6 in nTheta).
- **Peaks past the rim** (`frame.exact === false`): the crowns at j = 2 are pillow.js's flange fallback there; nothing special is done.
- Not checked: the built page, phones, the print on the surface (the pane owner's), signatures beyond the seven of `range.mjs`, Twist beyond ±0.5.

## What was tried in the solver and dropped (`sweep2.mjs`, `sweep-knobs.mjs`)

- Stronger hinges (bend 0.3–1): more crossings (305–681 pairs against 22–66) and creases up to 177 degrees.
- A straightening term along every seal (`sealBend`): about the same metrics, but it ties the shape to the cut, and a flip then moved tips by over 5 %: off.
- Heavy seal chains while the mouths close (`sealHeavy`, `foldHeavy`): the seal crumples when let go (588 crossing pairs).
- A rod for the folded ring during the whole cold start: straight, but 41 % worst stretch at its ends; for the first 0.6 of the sweeps it is nearly straight with 14 crossing pairs and 7.5 % worst stretch: kept (`rodShare: 0.6`).

## Ideas not done

- Sweeps that respect the mesh's mirror symmetry (Jacobi-style or a symmetric ordering) so that 3333 at Twist 0 comes out symmetric.
- A coarse-to-fine cold start (the round's xpbd prototype does this).
- An opening that turns each triangle rigidly instead of mixing positions.
- Splitting, not moving, at 2222's creases where a seal's vertices cannot move (unreduced states: the seal itself crosses creases).
- Carrying the surface through a re-grid (as `flip` does) instead of a cold restart.
