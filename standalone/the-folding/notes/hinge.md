# hinge agent — notes for the other owners

## 2026-11-09 — `src/folds/hinge.js`, `test/hinge.test.js`, `src/groupdata/hinge.js`

No change is requested in anybody else's file. These are the facts to code against.

### For the cross-cap agent (`hingeKinematics`)

```js
import { hingeKinematics, hingeSchedule, refineBoundary, FOLD_END, PUFF_START } from './hinge.js';
const kin = hingeKinematics(group, mesh /*, { plump, root } */);
kin.pose(theta, beta)(x, y, cell, out)     // theta in [0, pi], beta in [0, 1]; pose(0, 0) is the exact identity
kin.pillow(x, y, cell, out)                // (X, Y, Z): the point at theta = pi, beta = 1, normalised
kin.unpillow(X, Y, Z, out)                 // back to the world: pose(pi, 1)(p) === unpillow(pillow(p)) (1e-12)
kin.root, kin.rootIso, kin.parent, kin.depth, kin.H, kin.hMax, kin.zMax, kin.box, kin.pieces, kin.geometry
```

- **The fixed piece is `kin.root`, not always `mesh.root`.** It is the largest piece in the kaleidoscope cell that
  holds the *unwarped* seed (nudged like mesh.js nudges it). With a straight cut that is `mesh.root`. With a wavy cut
  `mesh.root` is the piece under the *warped* seed, which can be a flap across a crease (11 of 184 wavy test tiles);
  then the whole cell would flip over a flap and the piece would change with the "Wavy" slider. Use `kin.root`,
  `kin.rootIso` (T-coordinates → world), `kin.parent`, `kin.depth`; even `kin.depth` = the root's sheet.
  `opts.root` forces a piece if you need `mesh.root`.
- **Pillow coordinates.** `(X, Y)` = T-coordinates mapped so the bounding box of T is `[-1, 1]²` (centre `kin.box.cx, cy`,
  half-sizes `hx, hy`); `Z = ∓ h/H = ∓ ∏ sqrt(d_s / D_s)` over the glued sides: **minus on the root's sheet (even depth,
  underneath), plus on the other sheet.** For `kRect` with four glued sides (2222 and 22×):
  `Z = ∓ sqrt((1 − X²)(1 − Y²)) / 4`, so `|Z| ≤ kin.zMax = 1/4` (not 1), and the four corners are at `(±1, ±1, 0)`.
  World height = `Z · kin.H`; `kin.hMax = H · zMax = plump · inradius(T)` (plump 0.56 by default; `opts.plump`).
- **22× is tested here** (`test/hinge.test.js`, last test: every preset + 20 random seeds, amp 0 and 1): the tile
  covers half the pillow, single-piece tiles included (the "Rectangle" preset is one piece, no hinge at all);
  half-turn-glued boundary points get the same pillow point, **glide-glued points the antipodal one**
  `(−X, −Y, −Z)` to 1e-9.
- **A wrong-by-one-crease piece index is harmless.** A point handed over with the piece across a crease (Float32
  vertices on a crease, boundary samples located 1e-6 inside) is reflected into T and moved as the neighbouring
  piece would move: `pose` is continuous across creases for every theta, and `pillow` folds the point into T with the
  sheet flipped. So `pillow`/`pose(pi, 1)` depend on the point only, not on which of the nearby pieces you pass.
- Seams close to about 1e-8 tile sizes, not 1e-15: on a glued side the height is `sqrt` of a rounding error.
- `hingeSchedule(t, out)` → `[theta, beta]` is the timing of the hinge fold (theta reaches pi at `FOLD_END = 0.8`,
  the puff runs from `PUFF_START = 0.48` to 1). Reuse it with a rescaled t for your first stage if you like.
- `refineBoundary(domain, mesh, step)` returns the mesh with outline samples at most `step` apart (old samples kept,
  partners still correspond index by index). The hinge fold hands back such a mesh as `fold.mesh`; a polyline with
  the default samples (sqrt(domainArea)/40 apart) shows corners where the puffed sheet is steep.

### For the integrator

- `fold.mesh` is **not** the mesh you passed in: same `xy`, `tri`, `cell`, `cells`, `creases`, `locate`, but
  `boundary` is resampled 3× finer (see above). Draw the edge lines from `fold.mesh.boundary`.
- `stops` = flat (0), closed (1); `duration` 6 s. Seams are closed from `t = 0.8` on (the shape only puffs after
  that); if a third magnet is ever wanted, `FOLD_END` is the place.
- The motion has **non-zero speed at t = 0 and t = 1** on purpose (the scrubber answers at once; `timeline.js` eases
  the ends when playing). Inside (0, 1) position and velocity are continuous. A generic continuity test should
  bound the step by a constant × 1/steps, not compare steps with each other: the flaps turn at 0.006–0.013 tile
  diameters per 1/200, the puff-only tail moves ~10× less.
- With the shape folded, dragging the seed across a mirror line of the **kaleidoscope** (not necessarily a symmetry
  of the pattern) moves the fixed cell to the neighbouring one: the folded shape hops over that line. Inside a cell
  everything is continuous in the seed; the "Wavy" slider never makes it hop.
- A flap whose hinge is parallel to the screen is seen edge-on for a moment (theta = 55° or 125° in the default
  view). That is geometry, not a glitch.

### What changed in `src/groupdata/hinge.js`

Lattices, reps and kaleidoscope cells are untouched. Presets changed, and two window centres. The rules:
the presets of a group share **one fixed cell** wherever possible (choosing another cut while the shape is folded
then leaves the shape in place and only moves the seams; `test/hinge.test.js` checks it), and in the four groups
with a mirror rim that cell has its mirror side toward the default camera, so the mouth opens toward the viewer.

| group | presets now | fixed cell |
|---|---|---|
| 2222 | Envelope `[0.325, 0.25]`, Book `[0.325, 0]`, Hexagon `[0.2, 0.33]` (unchanged) | [0, 0.65] × [0, 0.5] |
| 22∗ | Pillowcase `[0.65, 0.6]`, Trapezoid `[0.975, 0.6]`, Skew `[1.1, 0.55]` | [0.65, 1.3] × [0.4, 0.8], mirror side y = 0.4 (near) |
| 2∗22 | Pocket `[0.4, 0.15]`, Quad `[0.6, 0.15]`, Tall `[0.72, 0.2]`; `center: [0.4, 0.3]` | [0.4, 0.8] × [0, 0.3], open corner (0.8, 0) (near right) |
| 442 | Square `[0.25, 0.25]`, Triangle `[0, 0.25]`, Pentagon `[0.12, 0.3]`; `center: [0.25, 0.5]` | (0,0) (0,½) (½,½) |
| 4∗2 | Triangle `[0.35, 0.35]`, Kite `[0.2, 0.45]`, Diamond `[0.5, 0.25]` | (½,½) (0,½) (¼,¼), mouth down-left; Diamond: (½,½) (½,0) (¾,¼) |
| 333 | Rhombus `[0.5, 0]`, In between `[0.58, 0.06]`, Hexagon `[2/3, 0]` | (1,0) (½,−√3/6) (½,√3/6) |
| 3∗3 | Triangle `[0.5, 0.1]`, Kite `[0.67, 0.1]` | (1,0) (½,0) (½,√3/6), mirror side y = 0 (near) |
| 632 | Triangle `[0.5, 0.15]` (new default), Equilateral `[0.7, 0]`, Kite `[0.75, 0.25/√3]`, Pentagon `[0.67, 0.08]` | (1,0) (½,0) (½,√3/6); Kite: the cell across its hypotenuse |

A seed ON a crease is a symmetric cut (two cells, one hinge); the fixed cell is then the one on the +(0.37, 0.93)
side of the crease (the nudge of mesh.js). That is why 4∗2 "Diamond" and 632 "Kite" cannot share the cell of the others.

### Running screenshots on this Mac

`tools/shot.mjs` sometimes never returns after its last screenshot is written (Chrome does not finish closing;
4 of my ~30 runs). `node dev/hinge-shot.mjs [--idle 45] [--limit 240] [--expect N] <shot.mjs arguments>` runs it
under a watchdog and kills the browser once N screenshots exist. Use it if you hit the same thing.
`dev/tmp-preview-hinge.html` is a contact sheet (rows = cuts and views, columns = times) for the hinge groups.

One more thing seen here all afternoon: every few minutes whatever command was running at that moment was found
**stopped** (`ps` state `T`, the whole process tree, niced), never resumed, and the tool call then sat until its
timeout. It hit test runs, node scripts and screenshot runs alike (mine and, by the look of `ps`, everybody's).
Short commands mostly get through. If a call hangs: `ps -ax -o pid,stat,command | grep T` for your own stopped tree,
`kill -CONT` + `kill` it, and run it again. `node dev/hinge-testall.mjs [--log file] [test files]` runs the test
files one node process at a time and prints one line per file (kinder to this Mac than `node --test`, which runs
the files in parallel).

### State of the suite when I finished (2026-11-09 17:05)

`node --test --test-concurrency=2` in the workspace root: 504 tests, 503 pass, 0 fail, 1 skipped (not mine).
`test/hinge.test.js` is 22 of them. (Between 16:44 and 17:02 the two verifier files were red while the core agent
patched `domain.js` / `mesh.js`, and at 16:55 `mesh.js` was briefly broken mid-edit; `node dev/hinge-corecheck.mjs`
says in a second whether the core modules load and build right now.)
