# cross-cap agent — notes for the other owners

## 2026-11-09 — `src/folds/crosscap.js`, `test/crosscap.test.js`, `src/groupdata/crosscap.js`

No change is requested in anybody else's file. These are the facts to code against.

### For the integrator

```js
import createCrosscap from './crosscap.js';       // group.fold === 'crosscap' (22x only)
const fold = createCrosscap(group, domain, mesh, {});   // the default buildMesh(group, domain) is what it expects
// draw fold.mesh, map every vertex / boundary sample / cone point through fold.at(t), and draw fold.doubleLine(t)
```

- **`fold.mesh` is not the mesh you passed in.** It has the same pieces, creases, `locate`, `domain`, and the old
  vertices first (same indices), but **more vertices and triangles**: the triangles next to the lines that fold onto
  the double line are cut finer (968 → 2640 triangles for the default cut, 5.0k at most over 246 tiles), and
  the outline is resampled 3× finer as in the hinge fold. Take `xy`, `cell`, `tri`, `n`, `boundary` from `fold.mesh`.
  Building it costs 1–2.5 ms.
- **`fold.doubleLine(t)` → `Float32Array(3k)`**, a polyline in world coordinates: empty until the zip starts
  (`t <= 0.5`), then the line the rim is closing onto, growing out of the tip, and at `t = 1` the true line of
  self-intersection (0.26 long, horizontal, from the tip of the heart to the middle of it). Please draw it (thin,
  dashed, ink, shining through, as `dev/fold-demo.html` does): it is what tells a cross-cap from a pillow. With the
  default cut the closed glide seam lies exactly on it, so the dashes sit on the seam's colour.
- **Stops** `0 flat · 0.47 half pillow · 1 cross-cap`, **duration 7 s**. Nothing moves for `0.44 <= t <= 0.5` (the
  pause; the middle stop is in the middle of it). Stage 1 has non-zero speed at `t = 0` (the scrubber answers at
  once); the speed is zero at both ends of the pause and at `t = 1`. `at(t)` clamps: `t <= 0` is the exact identity,
  `t >= 1` the closed shape.
- Speeds for a generic continuity test: the flap of stage 1 moves up to 0.027 tile diameters per 1/200 of the play
  (it turns half a circle in 36 % of it); the zip moves 0.005–0.007. The largest step is about 5 median steps.
  12 of 200 equal steps fall into the pause and move nothing at all: do not divide by the smallest step.
- **Which cell stays put.** The closed shape sits on the FAR half (larger y) of one kaleidoscope cell, whatever the
  cut, with its tip toward the default camera: `fold.frame = { xc, yc, hx, hy, hz }` is that cell (centre, half
  sizes) and the height of the pillow. Normally it is the cell that holds the seed. The default seed lies exactly on
  the crease `y = 0.9`, so there is one exception, or the first drag away from the camera would make the folded
  shape hop: a seed less than `hy / 2` = 0.225 behind a crease `y = k · 0.9` keeps the cell in FRONT of that crease
  as long as a quarter of the tile lies in it (`ROOT_SHIFT`, `ROOT_MIN`; then `fold.kinematics.root` is not
  `mesh.root`). Around the default seed nothing hops for drags of up to about 0.15 away from the camera, 0.73 toward
  it and 0.32 sideways (`node dev/crosscap-rootmap.mjs` prints the map). A hop moves the shape one cell (0.65 or 0.9)
  and mirrors the seams on it (left to right for a hop in y; left to right and top to bottom, a half-turn about the
  depth axis, for a hop in x); the shape itself looks the same. The fixed piece is at
  least 28 % of the tile in the test sweep.
- With any cut but the default one a part of the half pillow has to be turned over in stage 2 and passes through the
  rest on its way (see below). That is the mathematics, not a glitch.

### What changed in `src/groupdata/crosscap.js`

- Lattice **1.3 × 1.8** (was 1.5 × 1.2): the cell is 0.65 × 0.9, the default tile folds to a pocket 0.65 wide and
  0.45 deep, and the closed shape is about as long as it is wide.
- Presets: **Pocket** `[a/4, b/2]` (new default), **Bowl** `[a/4, b/4]` (the old "Rectangle": the tile is the cell
  itself), **Hexagon** `[0.3a, 0.36b]`. All three share one fixed cell, so choosing another cut at `t = 1` moves
  only the seams. `test/domain.test.js` wants preset 0 to be a quadrilateral: it is.
- The default seed lies exactly on a kaleidoscope crease, and the tile's glide edges lie exactly on the centre
  lines of two cells (a grid line of the fine mesh of `mesh.js`), with four tiles meeting at each corner. When I
  first ran the suite with it (18:05), `test/mesh.test.js` and `test/verify-topology.test.js` reported a T-junction
  on the rim for `22x preset 0 + 1e-6..1e-9 offsets, amp 1`; `src/mesh.js` changed at 18:10 (not by me) and both
  have been green since. If that comes back, the trigger is this preset; `node dev/crosscap-rimcheck.mjs 0.325,0.9`
  runs the same rim check on the seeds around it in two seconds.
- With the "Wavy" slider the glide edges of the Pocket stay straight (the warp slides them along the glide axes);
  only the two half-turn edges wave. The mouth of the pocket therefore stays a plane curve at every amplitude.

### The design, and the two it was compared with

`(xi, eta, zeta)`: normalised world coordinates on the puffed pillow over the fixed cell (centre `(xc, yc)`, half
sizes `hx, hy`, height `hz`), `zeta² = (1 − xi²)(1 − eta²)`. The antipodal map is `P → −P`.

**cleft (used).**
`x = xc + hx·xi·L(eta)`, `y = yc + hy·(D(eta) + mu·zeta²)`, `z = hz·gamma·zeta·L(eta)`, with `L` odd, `D` even
(`L = eta·√(1+ε²)/√(eta²+ε²)`, `D = (√(eta²+ε²) − ε)/(√(1+ε²) − ε)`, ε = 0.8, mu = 0.58, gamma = 1.9). It is the
classical cross-cap `(XY, X² + mu Z², XZ)` (ε = ∞) made to stay near the identity on the far half of the pillow: the
far edge with the two cone points does not move at all. The great circle `eta = 0` goes four to one onto the double
line; the tip (`xi = ±1`) and the inner end (`xi = 0`) are the pinch points. From above: a heart, two lobes with a
cleft from the tip to the middle. The sign of `mu` matters: with `mu > 0` every sheet stays a graph over the plane
while the default pocket closes (no triangle turns over, tested), and the double line lies at the bottom of a
groove that the default camera looks into.

**stem** (`opts.design = 'stem'`): the same with `mu < 0`, i.e. SPEC 5.6's `(XY, 2ZX, Z² − X²)` in the same frame.
The double line then sticks out in front of the tip, the lips fold over like a beak, the sections across the
double line are a vertical figure 8 whose crossing is hidden under the upper lobe from the default camera, and the
closed shape reads as a guitar pick. Rejected.

**spec** (`opts.design = 'spec'`): SPEC 5.6 literally, `q = (XY, 2ZX, Z² − X²)` on the pillow with `|Z| ≤ 1/4`, with
the cut "Bowl" (the old default). The double line is 1/16 of the size of the shape and sits on top of a purse that
stands on a keel; the cone points are the ends of the keel; the bowl has to pass through itself to get there.
Nobody would see a cross-cap in it. Rejected.

Pictures of all three with the real renderer, the zip from two directions: `qa/crosscap/design-cleft.png`,
`design-stem.png`, `design-spec.png` (`dev/crosscap-steps-designs.json`; in the preview page:
`dev/fold-demo.html?g=22x&opts=design:stem`). First looks were taken with a small software rasteriser,
`dev/crosscap-raster.mjs` (no browser; `--design`, `--preset`, `--t`, `--views`, `--opts`): `qa/crosscap/r-*.png`.
The chosen design from more directions: `qa/crosscap/around.png`, `look-sheet.png`; the other cuts:
`sheet-bowl.png`, `sheet-bowl-zip.png`, `sheet-hexagon.png`, `sheet-pocket-wavy.png`.

**Why the default cut is the Pocket.** The double line of any cross-cap is the image of a great circle. If that
circle is the RIM of the half pillow, the half pillow is embedded until its rim meets itself, and the motion is the
textbook one: a disc whose boundary is sewn to itself by the antipodal map. That is the Pocket (rim = `eta = 0`).
With the old default (the cell itself, a bowl whose rim is the equator `zeta = 0`) the double line comes from the
bottom meridian of the bowl, and half of the bowl must be turned over and pushed through the other half.

**Stage 2 for the other cuts.** A point of the near half (`eta < 0`) ends at the image of its antipode, which is a
point inversion away. Linear interpolation would squeeze every cross-section through a point. Instead the pair
`(x − xc, z)` is multiplied by a complex factor `F = ρ·e^{iφ}` that goes from 1 to `L(eta) < 0` around the origin:
`ρ = 1 − s + s|L|`, `φ = π·smooth(s|L|/ρ)`. So the near half is twisted about the depth axis like a sweet wrapper
while it folds back over the far half. For `eta ≥ 0` the factor is real, `1 − s + s·L`. `opts.twist = −1` twists the
other way.

### Running screenshots

`node dev/hinge-shot.mjs --expect N --page "dev/fold-demo.html?g=22x&ui=0" --steps dev/crosscap-steps.json` (the
hinge agent's watchdog; no run of mine hung with it). Step files: `dev/crosscap-steps*.json`.

### For the core agent (nothing to do, one thing to know)

`test/mesh.test.js` (the three `'slit', '22x', [...]` rows), `test/verify-topology.test.js` and
`test/verify-robust.test.js` pin regression seeds for 22x that were found with the old lattice 1.5 × 1.2. They all
pass with the new lattice 1.3 × 1.8, but they are now ordinary seeds: the tiles they were pinned for (a T-junction
on the rim next to a tile corner) are different tiles. The new default seed `[0.325, 0.9]` is the degenerate one
now: on a crease, glide edges on the centre lines of two cells, four tiles at every corner. Your sweeps over
"preset + tiny offsets" cover it (that is how the 18:05 T-junction showed up).

### State of the suite when I finished (2026-11-09, about 18:35)

`node --test --test-concurrency=2` in the workspace root: 530 tests, 529 pass, 0 fail, 1 skipped (not mine).
`test/crosscap.test.js` is 24 of them (5 s; `CROSSCAP_SEEDS=120` widens the sweep to 246 tiles, 35 s, also green).
Once, under load, `test/verify-robust.test.js` failed its timing test "robust locate speed" and passed on the next
run; nothing of mine is involved in it.
