# The Folding — build contract

Workspace: `~/drive.unsynced/artifacts/the-folding` (served on the tailnet at `http://intel/scratch/the-folding/`).
Everything is plain ES modules, no runtime dependencies, bundled at the end into ONE self-contained `dist/index.html`.

## 1. What we are building (the owner's intent)

A small web app, **"The Folding"**, the companion of his page "The Unfolding" (which cuts an orbifold open into the plane).
This one goes the other way:

1. **Pick an orbifold.** A chip shows the current wallpaper group in orbifold notation (e.g. `333`). Clicking it pops up the
   **Hasse diagram** of the 17 groups (`o` on top, curvy lines, `*632` at the bottom); clicking a node selects it.
2. **Choose a cut on the 2D symmetry plane.** The plane shows the pattern's symmetry (mirrors, glide axes, rotation centres,
   a motif) tiled by copies of one tile (fundamental domain). The cut = the tile's non-mirror boundary. He tries different cuts
   by dragging in the plane (the tile changes shape continuously), by named presets ("Rhombus", "Hexagon", …) and by a
   "Wavy" slider that makes the cut edges wavy.
3. **Press Fold.** The chosen tile folds/rolls up, in 3D, into the orbifold: pillow, pillowcase, cone pouch, torus, tube,
   Möbius band, Klein bottle, cross-cap. Edges that get glued carry the same colour in 2D and 3D and visibly close up.

Things he asked for in the earlier session (binding):
- Focus: "just the most important parts" — no walls of text, few controls. A reader should understand it from the pictures.
- The 3D surface is **translucent**, edges are **bold and shine through** (he could not see what happens in `22×`).
- He can **rotate** the 3D view and it **keeps its orientation** while playing or scrubbing ("shift the visualization, then
  scrub to see it from a different direction").
- A scrubber goes to **any point continuously**, with *slight magnets* at the main points — never a jump to the nearest tick.
- **Smooth**: no discontinuities, no face that suddenly flips or changes colour.
- All 17 groups. Must work on a phone (most views) and on a laptop.
- Register: he is a professional mathematician; captions are short, precise, peer-to-peer (orbifold notation leads, HM name second).

## 2. Rules for every agent

- **Read this file first**, then the source you depend on. Existing, tested code: `src/geom.js`, `src/kaleido.js`, `src/groups.js`,
  `src/groupdata/*.js`, `src/hasse-data.js`, `src/palette.js`, `test/groups.test.js`, `tools/shot.mjs`.
- **Ownership.** Edit only the files assigned to you (§3). If you need a change in another agent's file, do not edit it:
  append a dated note to `notes/<your-name>.md` describing exactly what and why, and work around it locally. Never touch `dist/`
  unless you are the integrator.
- **Tests.** Math modules ship `test/<module>.test.js` (node:test; run all with `node --test` in the workspace root; it must stay
  green, including tests you did not write). Never weaken another agent's test to make it pass.
- **Seeing your work.** `node tools/shot.mjs --page <path> --out qa/<name>.png [--w 1280 --h 720] [--eval "js"] [--steps file.json]`
  serves the workspace over http, opens the page in headless Chrome (WebGL2 works) and writes PNGs; it prints console errors and
  the value of every `eval`. **Look at your screenshots** (Read the PNG) and judge them critically before you report —
  "tests pass" is not "looks right". Phone check = `--w 390 --h 780`.
- **This Mac is shared and power-limited.** Never run more than ONE `shot.mjs` at a time, never loop it in parallel, keep each
  run short (batch several screenshots into one `--steps` file), and run nothing that keeps cores busy for minutes.
- Bash: put any multi-line script in a file under `tools/` or `dev/` and run it with one plain `node <file>` / `python3 <file>` call.
  No background `&`, no `bash -c`.
- Do not start servers, do not install global packages, do not publish or deploy anything, do not use git. The only network
  use allowed is `npx --yes esbuild` (the integrator/build agent).
- Coordinates: world plane has x right, y up (the 2D canvas flips y). In 3D the plane is z = 0 and **+z points toward the viewer**.
- Report honestly: what you built, what you verified and how, and what is still wrong or unverified.

## 3. Files and owners

| File | Owner | Role |
|---|---|---|
| `src/geom.js`, `src/kaleido.js`, `src/groups.js`, `src/hasse-data.js`, `src/palette.js` | orchestrator (done) | isometries, group registry, layout data, colours |
| `src/groupdata/hinge.js` | hinge agent | data for 2222, 22*, 2*22, 442, 4*2, 333, 3*3, 632 |
| `src/groupdata/roll.js` | roll agent | data for o, **, xx, *x |
| `src/groupdata/crosscap.js` | crosscap agent | data for 22x |
| `src/groupdata/kaleido.js` | snowflake agent | data for *2222, *442, *333, *632 |
| `src/domain.js`, `src/mesh.js`, `test/domain.test.js`, `test/mesh.test.js` | core agent | Dirichlet tiles, glue classes, warp, tile meshes |
| `src/folds/hinge.js` (+ test) | hinge agent | fold: rigid hinges along kaleidoscope mirrors + puff |
| `src/folds/roll.js` (+ test) | roll agent | folds: torus, cylinder, mobius, klein |
| `src/folds/crosscap.js` (+ test) | crosscap agent | fold for 22x |
| `src/folds/snowflake.js` (+ test) | snowflake agent | fold for the four kaleidoscopes |
| `src/render3d.js`, `dev/render-demo.html`, `dev/fold-demo.html` | renderer agent | WebGL2 renderer, trackball, fold preview harness |
| `src/plane.js`, `src/motif.js`, `dev/plane-demo.html` | plane agent | 2D symmetry plane, dragging the cut |
| `src/hasse.js`, `dev/hasse-demo.html` | hasse agent | the picker dialog |
| `src/timeline.js`, `src/index.template.html`, `src/styles.css`, `build.mjs`, `dev/shell-demo.html` | shell agent | layout, scrubber, bundling |
| `src/folds/index.js`, `src/app.js`, `tools/qa-matrix.mjs`, `test/folds.test.js`, `dist/` | integrator | wiring, generic fold tests, build |

## 4. Existing API (read the files for details)

`src/geom.js`: isometry `{a,b,c,d,tx,ty}`; `iso, IDENT, trans, rot, rotN, refl, reflThrough, glide, compose, inverse, apply, det,
isoEquals, classify, polyArea, polyCentroid, clipHalfPlane`.

`src/groups.js`: `GROUPS` (17, display order), `BY_ID`, and per Group: `id, label, hm, shape, topology, e1, e2, reps, fold,
kaleido {group, cell, glued}, warp, presets [{name, seed, metric?}], viewHalf, center, cellArea, domainArea`.
Helpers: `contains(group, g)`, `elementsNear(group, cx, cy, radius, qx?, qy?)`, `symmetryElements(group, cx, cy, radius)`
→ `{centers:[{x,y,order,onMirror}], mirrors:[{px,py,ux,uy}], glides:[{px,py,ux,uy,dist}]}`, `latticeCoords`.

`src/hasse-data.js`: `HASSE_BOX, HASSE_TIERS, HASSE_NODES [{id,x,y}], HASSE_EDGES [[upper, lower, index]]`.
`src/palette.js`: all colours (`ACCENT`, `CLASS_COLORS`, `MIRROR_COLOR`, `SURFACE_FRONT/BACK`, …). Use them; do not invent others.

### The mathematics in one paragraph
For a wallpaper group G the orbifold is the plane mod G. A **tile** (fundamental domain) D has boundary edges of two kinds:
edges on mirror lines of G (they stay as the orbifold's mirror rim) and **cut** edges, which come in pairs glued by an element
of G (a 2-fold rotation glues an edge to itself, folded at its midpoint). Folding = a continuous family of maps
f_t : D → R³ with f_0 = the flat tile and f_1 = a map that is **G-invariant**: f_1(x) = f_1(g x) for every glued pair.
So a fold module is correct exactly when *paired boundary points coincide at t = 1* — that is the test every fold must pass.
We take D = the Dirichlet (Voronoi) domain of a draggable **seed** p: D(p) = {x : dist(x,p) ≤ dist(x, g p) for all g}; it is a
convex polygon, every edge is the bisector of p and one neighbour g p, and the element g gives the gluing for free.
A G-equivariant diffeomorphism ψ ("warp") turns straight cuts into wavy ones without changing any of the combinatorics.

## 5. Modules to write

### 5.1 `src/domain.js` (core agent)

```js
makeWarp(group, amp) -> { amp, fwd(x, y, out), inv(x, y, out) }
```
ψ(x) = x + amp·A·v(x). `v` is a fixed smooth vector field, **equivariant under `group`** (G itself, not `group.warp`):
v(g x) = L_g v(x). Build it by symmetrising a generic lattice-periodic field w0 over the coset representatives:
v(x) = (1/|reps|) Σ_k L_k w0(g_k⁻¹ x), with w0 a short sum of sines of the lattice coordinates (a few low integer
frequencies, generic phases, so the wave has ~2–3 undulations per cut edge). Consequences you can test: v is tangent to every
mirror of G, vanishes at rotation centres, ψ(D) is again a tile. Scale A per group so that at amp = 1 the waves are clearly
visible (peak displacement ≈ 7–10 % of sqrt(group.domainArea)) while ψ stays a diffeomorphism (sampled Jacobian determinant
≥ 0.35). `inv` by fixed-point iteration (5–6 steps is plenty). amp = 0 must be the exact identity (fast path).

```js
clampSeed(group, x, y) -> [x, y]
```
Moves a seed off the loci where it has a non-trivial stabiliser: at least δ = 0.06·sqrt(group.domainArea) from every mirror
line and rotation centre (push it away along the normal / radially). Glide axes and kaleidoscope creases are fine.

```js
buildDomain(group, { seed, metric, warp }) -> Domain
```
- `seed` is clamped with `clampSeed`. `metric = [q11, q12, q22]` (optional, default Euclidean [1,0,1]) is a positive quadratic
  form Q; distances are measured in Q: the half-plane for a neighbour q = g(seed) is n·x ≤ c with n = Q(q − p),
  c = (qᵀQq − pᵀQp)/2. Q must be invariant under the point group (Lᵀ Q L = Q for all reps) — if it is not, ignore it.
- Neighbours: `elementsNear(group, seed, R, seed)` with R ≈ 2.5 × the lattice diameter; skip the identity. Clip a large square.
- Robustness: the presets deliberately include seeds on kaleidoscope creases and symmetric positions (ties, four tiles
  meeting at a point). Merge vertices closer than 1e-9, drop zero-length edges, never return slivers.

```js
Domain = {
  group, seed, metric, warp,
  poly,                       // [[x,y],...] counter-clockwise convex polygon in STRAIGHT (pre-warp) coordinates
  edges,                      // edges[i] runs poly[i] -> poly[(i+1) % n]:
                              //   { g, kind: 'mirror'|'cut', partner, cls, halfTurn, nx, ny, c }
                              //   g        the element with D ∩ g(D) = this edge
                              //   kind     'mirror' when g is a reflection, else 'cut'
                              //   partner  index j of the edge glued to this one: inverse(g) maps edge i onto edge j, reversing
                              //            the direction of travel along the boundary (j === i for mirrors and half-turns)
                              //   cls      glue class 0..classes-1 shared by the two partners; -1 for mirrors
                              //   halfTurn true when g is a 2-fold rotation (the edge is folded in half at its midpoint)
                              //   nx,ny,c  the half-plane n·x <= c
  classes,                    // number of glue classes
  area,
  contains(x, y, eps = 0),    // straight coordinates
  outline(maxStep),           // -> [{ edge: i, pts: Float32Array(2m) }]: each edge subdivided (steps <= maxStep) and mapped through warp.fwd
                              //    = the tile's true boundary in the plane, in order, counter-clockwise
  conePoints,                 // [{x, y, order, onMirror}] rotation centres of G lying on the boundary of the tile, in ACTUAL (warped = same) coordinates
}
```
Tests (`test/domain.test.js`), over all 17 groups × every preset × ≥ 30 random seeds (seeded PRNG) × amp ∈ {0, 1}:
area = group.domainArea (1e-7); every edge has a partner, partners have equal length, `inverse(g_i)` maps the endpoints of edge i
onto those of edge j in reversed order; exactly one of the tiles g(D) contains a random point (tiling property);
cut classes are consistent; warp: `inv(fwd(x)) = x`, equivariance `fwd(g x) = g fwd(x)` for random elements, Jacobian bound.

### 5.2 `src/mesh.js` (core agent)

```js
buildMesh(group, domain, { density } = {}) -> Mesh
```
A triangle mesh of the (warped) tile D' = ψ(D), cut along the kaleidoscope's mirror lines when the group has a kaleidoscope.

- **Cells.** If `group.kaleido` exists (fold types hinge, crosscap, snowflake): the cells are the copies k(T) of the kaleidoscope
  cell T = `group.kaleido.cell` under `elementsNear(group.kaleido.group, …)` that meet D'. Otherwise there is ONE pseudo-cell
  (index 0, the whole plane).
- **Fine mesh per cell.** T gets one fixed fine triangulation, **graded toward its sides** (the puffed pillow has a
  square-root profile at glued sides, so node spacing must shrink quadratically there): for a triangle use barycentric grid
  points (i,j,k)/N mapped by λ → λ²/Σλ²; for a rectangle use Chebyshev-like nodes (1−cos(πs))/2 in each direction.
  N ≈ 20–24 (density option). Lift it to each cell with the cell's isometry; vertices on shared sides of adjacent cells
  coincide exactly — **weld** them (one index). The pseudo-cell of the roll types uses a regular grid over the tile's bounding
  box with ~56 steps across the longer side (the roll agent may ask for more via `density`).
- **Clipping to the tile.** For every fine triangle (actual coordinates x_i): compute straight coordinates y_i = warp.inv(x_i);
  if all y_i satisfy all half-planes keep the triangle; if all violate one half-plane drop it; otherwise clip the triangle
  (y_0,y_1,y_2) by the half-planes exactly (convex clipping, tracking barycentric coordinates) and place the new vertices in
  actual coordinates by the same barycentric combination of (x_0,x_1,x_2). At amp = 0 this is exact. **Weld all vertices by
  position** (hash of coordinates rounded to ~1e-9), so triangles that share an edge share two vertex indices — also across a
  crease, and also where the tile boundary cuts a shared edge (both neighbours compute the same cut point).
- **Pieces, not cells.** The rigid units of a fold are the **connected components of (cell ∩ D')** — "pieces". With a wavy
  cut the boundary can weave across a crease line, so one cell may hold several pieces (small lobes that wrap around the rim);
  each is its own piece. Find them by union-find over triangles that share an edge and lie in the same cell.
- **Tree.** Two pieces are hinged when triangles of the two (in adjacent cells) share an edge; that edge lies on a crease
  (a mirror line of the kaleidoscope). Rotation centres of the kaleidoscope are never interior to a tile, so creases do not
  cross inside D' and the piece graph is a **tree**. Root = the piece containing the (slightly nudged:
  + 1e-6·(0.3713, 0.9285)) warped seed; BFS gives `parent`, `depth` and the hinge line. If numerical dust leaves a piece
  unattached, hinge it to the tree piece in the cell across its nearest crease line (never leave an orphan); drop pieces with
  area < 1e-10 together with their triangles.

```js
Mesh = {
  n, xy: Float32Array(2n),          // vertex positions in the plane (actual, warped coordinates)
  cell: Uint16Array(n),             // index into `cells` (= PIECE index) for each vertex (for a vertex on a crease: either neighbour)
  tri: Uint32Array(3m),             // counter-clockwise triangles
  cells: [{ index, g,               // a PIECE. g: kaleidoscope isometry with (its cell) = g(T)  (IDENT for the pseudo-cell)
            parity,                 // 0 if det(g) > 0, 1 if it reverses orientation
            poly,                   // the full cell polygon in the plane (g applied to T); null for the pseudo-cell
            area,                   // area of this piece
            parent, depth,          // tree; parent = -1 for the root
            hinge }],               // null for the root, else {ax, ay, bx, by}: two points spanning the crease LINE shared with the parent
                                    //   (the extent of the shared segment), ordered so the piece lies to the LEFT of a -> b
  root,                             // index of the root piece
  locate(x, y),                     // -> index of the piece containing the plane point (nearest piece if on / just outside the edge)
  boundary: [{ edge, cls, kind, pts: Float32Array(2p), cells: Uint16Array(p) }],   // the tile outline per edge (from domain.outline),
                                    //   each point with the piece found by locating the point nudged 1e-6 toward the tile's interior
  creases: [{ a, b, pts: Float32Array(4) }],   // hinge segments inside the tile (piece indices a = parent, b = child)
  bbox: [minx, miny, maxx, maxy],
}
```
`locate` must be fast (it is called for ~2k points on every rebuild while the seed is dragged): fold the point into T to get
its cell, and only if that cell holds several pieces search that cell's triangles. A full rebuild (domain + mesh) must take
well under 30 ms. Tests (`test/mesh.test.js`): triangle areas sum to domainArea (1e-6 at amp 0, 1e-3 at amp 1);
no inverted triangles; the piece graph is connected and acyclic with no orphans (all presets, random seeds, amp 0 and 1);
`locate` of each triangle's centroid returns that triangle's piece; boundary points lie on the tile boundary; for hinge
groups the even-parity pieces and the odd-parity pieces each have total area = area(T) (the tile covers front and back once).

### 5.3 The fold interface (all fold agents)

Each fold module default-exports a factory:
```js
export default function createFold(group, domain, mesh, opts) -> Fold
Fold = {
  mesh,          // the mesh to draw (normally the argument; snowflake supplies its own star mesh with extra `tint: Uint8Array(n)`)
  stops,         // [{t, label}] the main points of the motion for the scrubber's magnets; must include t = 0 and t = 1
  duration,      // seconds for a full play 0 -> 1 (4–7)
  at(t),         // -> fn(x, y, cell, out): position at time t of the plane point (x, y) (actual coords) belonging to `cell`;
                 //    out is a length-3 array; everything that depends only on t is precomputed in at(t)
}
```
Hard requirements, each one a test in your `test/<name>.test.js` (use every preset of your groups, ≥ 20 random seeds, amp 0 and 1):
1. `at(0)` is the identity: (x, y, cell) → (x, y, 0), exactly.
2. **Seams close:** for every cut edge i (partner j, element g) and sample points x on boundary[i]: with x' = inverse(g)(x)
   (it lies on edge j) and cells from `mesh.locate` of the points nudged inward, |at(1)(x) − at(1)(x')| < 1e-6 × tile size.
3. Continuity: for 200 time steps the largest vertex displacement per step is small and of the same order throughout
   (no jump anywhere, in particular none at stage boundaries or at t → 0, 1). Use smooth easing inside stages.
4. No NaN/Infinity for any t in [0, 1], including the exact stage boundaries (small-curvature limits need series forms).
Also required: folding goes **toward +z** (the seam closes on the side facing the viewer); the folded shape stays near where the
tile was; the result must look *good* — check with `dev/fold-demo.html` (renderer agent) via `tools/shot.mjs`, at several t
and from two directions, and iterate on proportions, timing and heights until it reads clearly as the named shape.
**The one exception (10 Nov 2026, the final fix; notes/integrator-final.md § 7): 22x folds toward −z.** Its flaps tuck under
the sheet that holds still (`src/folds/crosscap.js` FLAPS = 'under': round 3's motion mirrored in z = 0), so that the comma that
sheet carries — placed where no fold turns it over, after the owner's "the painting jumped from one side of the surface to
another" — ends ON TOP of the closed shape (front 53 %, seen 39 % in the default view, against 0 / 8 % toward +z), and the outside
of the cross-cap is the paper's front, as the flat tile is. The mouth that zips shut still faces the default camera. Tests:
test/folds.test.js `TOWARD`, test/crosscap.test.js `DESIGN_UP`.

### 5.4 `src/folds/hinge.js` — rigid hinges + puff (2222, 22*, 2*22, 442, 4*2, 333, 3*3, 632)

The orbifold is two copies of the kaleidoscope cell T (front, back), joined along the `glued` sides, open along the mirror sides.
- **Kinematics.** Each piece c (an entry of `mesh.cells`) moves rigidly: M_root = identity, M_c(θ) = M_parent(θ) ∘ Rot(hinge_c, θ):
  rotation by θ about the hinge line (taken in the flat layout) in the sense that lifts piece c toward +z. θ goes 0 → π. At θ = π
  every piece lies on the root cell's footprint, even depth face-up, odd depth face-down, and same-parity pieces tile T without overlap.
- **Puff.** A point x of piece c has T-coordinates u = inverse(g_c)(x). Height h(u) = H · Π over glued sides s of
  sqrt(dist(u, line of side s) / D_s), D_s = the largest distance from T to that side (h does not vanish on open sides, so the
  mirror rim opens like a mouth). Near a glued side h ~ sqrt(distance): the two faces join smoothly; at a corner where two glued
  sides meet h is linear in the distance: a cone point. Position: f(x) = M_c(θ) · (x, y, −β·h(u)) (the −z side of the flat tile
  is the outside of the finished shape). β goes 0 → 1; start puffing well before θ reaches π so the two faces never coincide.
  Choose H so the pillow is pleasantly plump (max h about 0.5–0.6 × the inradius of T).
- Export the kinematics for the crosscap agent: `export function hingeKinematics(group, mesh)` →
  `{ pose(theta, beta) -> fn(x, y, cell, out), pillow(x, y, cell, out) }` where `pillow` gives pillow coordinates at θ = π, β = 1 in
  the root frame, normalised as (X, Y, Z): (X, Y) ∈ T mapped to its bounding box [−1,1]² (rectangle cells) and Z = ±h/H.
- stops: 0 flat, 1 closed. Tune the look: equal angles on all hinges is fine; make sure nothing looks like a sudden flip.

### 5.5 `src/folds/roll.js` — torus (o), cylinder (**), mobius (*x), klein (xx)

All are "bend with growing curvature" maps of the pseudo-cell (cell argument ignored). With κ → 0 the formulas must reduce to
the flat tile (use sinc-style series near 0). Centre every roll on the warped seed (x0, y0) so the tile curls symmetrically.
Conventions per group are in `src/groupdata/roll.js` (you own it; lattice sizes there set the proportions).
- **cylinder (`**`)**: mirrors are x = k/2 · |e1|, the translation is e2 = (0, b). Roll along y: (x, y) → (x, sin(κ(y−y0))/κ + y0,
  (1 − cos(κ(y−y0)))/κ), κ: 0 → 2π/b. The mirror rims become the two end circles. Isometric.
- **torus (`o`)**: e1 = (L, 0), e2 = (s, h2). Stage 1: roll along x into a tube (κ1: 0 → 2π/L, tube axis along y, opening
  upward so the seam closes at the top). Stage 2: bend the tube's axis into a horizontal ring (κ2: 0 → 2π/(σ h2)) while twisting
  the tube by −2π(s/L) per turn so that x ~ x + e2 closes up; σ is a gentle lengthwise stretch chosen so that the final ring
  radius is about 2.2× the tube radius. Final map = torus(2π·s-coordinate, 2π·t-coordinate) in lattice coordinates — invariant
  under both translations. A tile wider than L wraps past a full turn before the tube closes: give the roll a slight spiral
  offset that vanishes as it closes so sheets never coincide mid-way. stops: 0, end of stage 1, 1.
- **mobius (`*x`)**: strip between the mirrors x = 0 and x = w (w = a/2); the glide (x, y) → (w − x, y + b/2) closes it. With
  c = x − w/2, φ = 2π(y − y0)/(b/2): final position (R + c·cos(φ/2))·(cos φ, sin φ) + ẑ·c·sin(φ/2) (ring in the horizontal
  plane), invariant under (c, φ) → (−c, φ + 2π). Bend with curvature 0 → final while the twist grows in proportion; stretch the
  length a little if needed so the band is not too fat (R ≥ 1.3 × half-width).
- **klein (`xx`)**: translation e2 = (0, b), glide (x, y) → (x + a/2, −y). Stage 1: bend the y-direction into a
  **figure-8 cross-section** by a regular homotopy: take the arclength-parametrised figure-8 (lemniscate of Gerono scaled to
  length b, parameter origin at the crossing… any symmetric choice with γ(−s) = −γ(s)) with tangent angle ψ8(s); the curve at
  stage parameter u is γ_u(s) = ∫ (cos(uψ8), sin(uψ8)) ds — straight at u = 0, an S in between, the closed 8 at u = 1.
  Stage 2: bend the tube axis (x) into a ring of circumference σ·a/2 while rotating the cross-section by half a turn per
  circuit; the final map is the standard figure-8 Klein bottle, invariant under (x, y) → (x + a/2, −y). stops: 0, stage 1, 1.
Tests as in §5.3 for every preset; additionally check invariance of at(1) under the generators at random interior points.

### 5.6 `src/folds/crosscap.js` — 22× (pgg)

The half-turn subgroup p2 folds the tile onto **half of the pillow** (use `hingeKinematics`; the tile's area is one cell).
The glides act on the pillow (X, Y, Z) as the antipodal map (X, Y, Z) → (−X, −Y, −Z). Stage 2 pushes the pillow through an
**even** map q: R³ → R³ so antipodal points meet: a cross-cap. Start from q(X, Y, Z) = (X·Y, 2·Z·X, Z² − X²) (the classical
cross-cap applied to the pillow rather than the round sphere, so the pillow's four conical corners survive as the two cone
points, at q = (±1, 0, −1)); interpolate P_s = (1−s)·P_pillow + s·A·q(P_pillow) with a similarity A chosen so the motion is
modest and reads as "the open rim zips shut". You may redesign q (any even polynomial map that is an immersion of the
projective plane away from two pinch points and keeps the cone points off the double line) — the owner found 22× hard to
read last time, so legibility is the whole job here: translucent surface, the seam and the double line clearly visible, cone
points marked, slow enough. Export `doubleLine(t)` (polyline of the self-intersection at t = 1) if you can, so it can be drawn.
stops: 0 flat, pillow-half done, 1 closed. Tests as §5.3 (seam closure covers both the half-turn edges and the glide edges).

### 5.7 `src/folds/snowflake.js` — the kaleidoscopes (*2222, *442, *333, *632)

Nothing is cut or glued; "folding" shows the plane folding onto the tile along its mirrors, like a paper snowflake.
Patch = the star of all 2n cells around the corner of T with the largest order n (12 cells for *632, 8, 6, 4). Build your own
mesh for the star (each cell one flat piece is enough: no curvature) with `tint` 0 for the base tile T (the tile containing the
seed — re-base so the base tile is the one the domain gives) and 1 for the others; `boundary` = the base tile's edges (all
mirrors). Fold sequence: repeatedly fold the patch in half along a mirror line through the pivot (region [0, A] of polar angle
→ crease at β = ceil((A/2)/(π/n))·(π/n), the part beyond β rotates by π about the crease, **over the top (+z)**) until only the
base tile's sector remains; the first fold halves the full disc. Layers must never coincide: keep a small stack spacing
(≈ 0.008 × tile size per layer) and interpolate it smoothly. stops: one per completed crease. Test: at t = 1 every cell's
image is the base tile (apply the cell's reflection sequence), layer spacing aside.

### 5.8 `src/render3d.js` (renderer agent) — WebGL2, no libraries

```js
createRenderer(canvas, { labelLayer }) -> R
R.setSurface({ positions: Float32Array(3n), indices: Uint32Array(3m), tint?: Uint8Array(n) })
R.updatePositions(Float32Array(3n))      // same topology, new positions — called every animation frame
R.setLines([{ points: Float32Array(3k), color:[r,g,b], width /*css px*/, alpha = 1, dashed = false, xray = 0.35, loop = false }])
R.setMarkers([{ p:[x,y,z], color:[r,g,b], size /*css px*/, shape:'dot'|'ring'|'square', label? }])
R.setFrame({ center:[x,y,z], radius }, immediate = false)   // what must stay in view; eased
R.setStyle({ front, back, ghost, opacity, background })     // from palette.js
R.render()                 // draw now; the renderer also redraws by itself while the camera glides
R.onChange(cb)             // camera moved
R.project([x,y,z]) -> [cssX, cssY, visible]
R.getView() / R.setView(v) / R.resetView()                  // orientation quaternion + zoom; nothing but resetView ever resets it
R.resize(); R.dispose()
```
- **Translucent surface**: two-sided lighting (front/back colours, `tint` 1 → ghost colour), alpha ≈ 0.62 rising toward grazing
  angles (reads as thin plastic), triangles depth-sorted back-to-front on the CPU every frame (≤ 20k triangles), blending on,
  depth writes off for the colour pass; smooth vertex normals recomputed on the CPU when positions change.
- **Bold edges that shine through**: first a depth-only pass of the surface; lines are screen-space quads with round caps
  (distance-to-segment in the fragment shader, anti-aliased), drawn twice: where hidden (depth test GREATER) with alpha × `xray`,
  where visible with full alpha. Markers likewise; labels are HTML elements in `labelLayer`, positioned with `project`.
- **Trackball**: drag rotates (free trackball about the frame centre, y-up initially), with momentum that decays in ~0.4 s;
  wheel / pinch zooms with soft limits and a slight elastic overshoot; double-tap/double-click = resetView; arrow keys rotate
  when focused. `touch-action: none`; never scrolls the page. Default view: looking down at the plane from elevation ≈ 55°,
  plane's +y pointing up-screen, perspective FOV ≈ 28°. devicePixelRatio capped at 2. Handles context loss gracefully.
- `dev/render-demo.html`: a torus + thick coloured lines + markers, to prove translucency, x-ray lines, sorting and the trackball.
- `dev/fold-demo.html?g=<id>&preset=<i>&t=<0..1>&amp=<0..1>&az=<deg>&el=<deg>`: generic fold preview used by every fold agent:
  builds domain + mesh, dynamically imports the fold module for `group.fold` (hinge → `src/folds/hinge.js`, crosscap →
  `crosscap.js`, torus/cylinder/mobius/klein → `roll.js`, snowflake → `snowflake.js`; show a readable message if the module
  is missing or throws), draws the surface, the tile boundary coloured by glue class (mirrors in ink, width 4–5 px), creases
  (thin, dashed, grey) and the cone points, sets `window.__demo = { setT(t), setView(az, el), ready }` so `shot.mjs --steps`
  can step t and the view in one run.

### 5.9 `src/plane.js` + `src/motif.js` (plane agent) — Canvas 2D

```js
createPlaneView(canvas, { onSeed(x, y, phase /*'start'|'move'|'end'*/) }) -> P
P.setScene({ group, domain, motif, star? })   // star: optional list of cell polygons to outline faintly (snowflake patch)
P.render(); P.resize(); P.toWorld(cssX, cssY) / P.toCss(x, y)
motifFor(group) -> { polylines: [Float32Array(2k), ...], at: [x, y] }   // an asymmetric glyph at a generic point (no symmetry through it)
motifInTile(group, domain, motif) -> [Float32Array(2k), ...]            // the pieces of all motif copies that lie inside the warped tile (dense sampling is fine)
```
Draw, bottom to top: white ground; every copy g(D') of the tile in view — thin grey outlines, with a faint tint on the
orientation-reversing copies; motif copies in soft ink; the pattern's symmetry elements — mirrors solid (ink, 2 px), glide axes
dashed, rotation centres as the crystallographic glyphs (lens for 2, triangle 3, square 4, hexagon 6); the current tile filled
with `ACCENT_SOFT`, its edges bold: cut edges in their glue-class colour (same colour = sewn together; a small chevron pair at
each edge's middle shows the matching direction, half-turn edges get a dot at the midpoint), mirror edges in ink; the seed
handle (a 14 px dot with a white ring). Window: square, centred on `group.center`, half-width `group.viewHalf`, device-pixel crisp.
Dragging **anywhere** on the canvas moves the seed by the pointer's world delta (relative drag — forgiving on phones); convert
through `domain.warp.inv`; keep the seed inside the window; `touch-action: none`. A one-line hint ("drag to move the cut")
shows until the first drag. No hover-only information.

### 5.10 `src/hasse.js` (hasse agent)

```js
createHassePicker({ mount, groups, onPick(id) }) -> { open(currentId), close(), isOpen() }
```
A modal dialog (role=dialog, aria-modal, focus trapped, Esc and scrim-click close) drawn as inline SVG from `hasse-data.js`:
`o` on top, tiers by point-group order, **curvy** edges (`M sx sy C sx midY, ex midY, ex ey`), index-3 edges dashed, nodes are
rounded pills showing `group.label` (font ≥ 13 px effective on a 360 px phone; tap targets ≥ 44 px via transparent hit areas).
The current node is filled with `ACCENT`; hovering/focusing/keyboard-arrowing a node highlights its edges and neighbours and
shows one line under the diagram: `label · hm · shape`. Click/Enter picks and closes. Styling follows `palette.js`
(white card, hairline border, radius ≤ 8 px, no shadows heavier than a soft one, no red). Faint tier guides labelled with the
point-group order are welcome if they stay quiet. `dev/hasse-demo.html` shows it open; screenshot at 1280 and 390 wide.

### 5.11 Shell (shell agent): `src/index.template.html`, `src/styles.css`, `src/timeline.js`, `build.mjs`

Layout (fits the window without scrolling, `100dvh`; the page lives in an iframe under a ~50 px host bar):
- Header (≈ 48 px): "The Folding" · the orbifold chip (big symbol, then `hm · shape`, a ▾) · nothing else.
- Two panes: **Plane** (2D canvas) and **Fold** (3D canvas + label layer). Side by side when the window is wider than tall,
  stacked (plane on top) when it is taller than wide; both always visible; canvases fill their panes.
- Under the plane: cut presets as chips + the "Wavy" slider. Under the fold pane: a primary **Fold / Unfold** button, the
  scrubber, a small "reset view" button. All tap targets ≥ 44 px, inputs ≥ 16 px font.
- One quiet legend line: coloured = edges that are sewn together · ink = mirror (stays an edge) · dots = cone points, and a
  plain link `<a href="https://spacesheep.dev/@yaroslavvb/the-unfolding" target="_blank" rel="noopener">The Unfolding</a>` as the companion.
- A one-line caption that changes with the group: `group.topology` (e.g. "sphere with three cone points of order 3").
- White ground, ink `#1a1a1f`, system font stack, colours from `palette.js` (mirror them as CSS variables), cards ≤ 8 px radius,
  no side stripes. `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>The Folding</title>`.
  Put `data-ss-comments="off"` on the two stage panes and `data-ss-thumb` on the main stage. No external URLs for assets.
```js
createTimeline({ slider /*<input type=range>*/, button, onChange(t) }) -> { setStops(stops), setDuration(sec), set(t), get(), play(target), stop(), isPlaying() }
```
The slider scrubs **continuously**; near a stop (within ±3.5 % of the track) the mapping from thumb position to t flattens
(soft detent: t − stop ∝ sign(d)·|d|^1.6) — a slight magnet, never a jump. Fold animates to 1 (smooth, duration from the
fold; restart from the current t), the button then reads Unfold and animates back to 0; touching the slider stops playback.
Draw small ticks at the stops. Keyboard: arrows step the slider, Space toggles play.
`build.mjs`: `npx --yes esbuild src/app.js --bundle --format=iife --minify` and inline the JS and `styles.css` into the template →
`dist/index.html` (escape `</script>`; keep it one file, no source maps). `dev/shell-demo.html` exercises the layout with
placeholder canvases; screenshot at 1280×720 and 390×780.

### 5.12 Integration (integrator): `src/folds/index.js`, `src/app.js`, `test/folds.test.js`, `tools/qa-matrix.mjs`

State: `{ groupId, presetIndex | custom seed, metric, amp, t }`. Group change → preset 0, t = 0. Seed / preset / amp change →
rebuild domain, mesh, fold and keep t (so with the shape folded, dragging in the plane makes the seams slide over it live).
Per frame: positions = fold.at(t) over mesh vertices → `R.updatePositions`; lines = tile boundary per edge (class colour /
ink for mirrors), creases (thin dashed, fading out as the fold completes), the motif pieces; markers = cone points with their
order as label; frame = bounding sphere of the positions. The 3D view never resets its orientation except by "reset view".
`window.__folding = { setGroup(id), setPreset(i), setSeed(x, y), setAmp(a), setT(t), setView(az, el), getState(), ready }` for tests.
URL hash `#<id>` selects the group on load and follows the selection. `test/folds.test.js`: the generic §5.3 tests for all
17 groups through `src/folds/index.js`. `tools/qa-matrix.mjs`: one Chrome, for every group: t ∈ {0, 0.5, 1} at 1280×720 and
t ∈ {0, 1} at 390×780 → `qa/matrix/<id>-<w>-<t>.png`, plus the picker open; report console errors.

## 6. Platform constraints (spacesheep)

The page is served inside a sandboxed iframe from its own origin: one self-contained HTML file, **no external scripts, styles,
fonts or images**, no fullscreen API, query parameters are not forwarded (use the hash), `localStorage` may be unavailable
(wrap in try/catch). Inline scripts are fine. No `position: fixed` headers (use sticky/flex layout). Never a red/pink surface.

## 7. Round 2 (review and polish) — additional contracts

State: v1 is built, deployed and green (554 tests). A snapshot of it is in `snapshots/v1/` (read-only reference; never edit it).

- **Tools.** `tools/filmstrip.mjs` makes ONE picture of a whole fold (N frames of the 3D pane in a grid) — use it to judge
  motion: `node tools/filmstrip.mjs --g 333 --preset 2 [--seed x,y] [--amp 1] [--frames 12] [--az 40 --el 20] [--pane fold|plane|stage]
  [--page dev/app-demo.html] --out qa/<you>/<name>.png`. `tools/shot.mjs` and `tools/qa-matrix.mjs` as before.
  **Browsers run on the mac mini.** `tools/shot.mjs`, `tools/filmstrip.mjs` and `tools/qa-matrix.mjs` take a Chrome from a pool
  of 5 on the mini (about 1 s to get one, against 20 s for a Chrome on this busy Mac), and fall back to this Mac (2 slots) only
  when the pool is busy or down. Pages are still served from THIS Mac's files (through an ssh tunnel), so they always show the
  current code. In any script of your own use the same door instead of `chromium.launch`:
  `import { openBrowser } from '../tools/browser.mjs'; const B = await openBrowser(); try { const page = await
  B.browser.newPage({ viewport }); await page.goto(B.url('dist/index.html')); … } finally { await B.close(); }`
  (`B.where` says 'mini' or 'local'; screenshots with `path:` are written on this Mac). Close it as soon as you have your
  pictures. If a tool prints "mini pool unavailable", the pool may have idled out: `bash tools/remote/start-pool.sh` restarts it.
  Never launch Chrome on this Mac without a slot (`acquireChromeSlot()` in `tools/chrome-slot.mjs`).
- **Which page.** Only the final integrator runs `node build.mjs`. Everyone else looks at their work through the unbundled app
  `dev/app-demo.html` (pass `--page dev/app-demo.html` to shot.mjs / filmstrip.mjs; it exposes the same `window.__folding`) or
  through `dev/fold-demo.html`. These pages load every module live, so another agent's half-finished edit can break them for a
  minute: wait and retry, do not "fix" files you do not own.
- **Tests.** While iterating run only your own test files (`node --test test/<yours>.test.js`). Run the whole suite as
  `node tools/test-all.mjs` (about 30 s): it sends this workspace's src/, test/, tools/ to a lab box or the mini and runs it there
  with 5–8 workers (`node tools/test-all.mjs test/a.test.js test/b.test.js` for several files; FOLDS_SEEDS-style knobs are passed
  along). Never run a bare `node --test` in the workspace root. Never weaken or delete a test to get green; if a test is wrong,
  say why in your report.
- **Write as you go.** Usage limits can cut any agent off mid-task; a previous round lost everything because findings were only in
  the final answer. Reviewers append each finding to `qa/review-<lens>/findings.md` the moment they are sure of it; fixers append
  each fix (what, files, how verified) to `notes/<owner>-round2.md` as they finish it.
- **Anchor contract (new).** `createFold(group, domain, mesh, opts)` receives `opts.anchor = [x, y]`: a plane point that the app
  sets when a group or a preset is chosen (the preset's seed) and does NOT change while the cut is dragged or made wavy.
  For the hinge and cross-cap folds the shape at t = 1 must depend only on the anchor, never on the seed: the folded shape stays
  put while the seams slide over it. Construction: let C0 be the kaleidoscope cell containing the (nudged) anchor and walk
  straight from the anchor to the seed, crossing creases l_1, …, l_k in order; the frame A(θ) = Rot(l_1, θ) ∘ … ∘ Rot(l_k, θ)
  (each rotation about the crease in the flat layout, in the sense that lifts the far side toward +z; for 22x the whole motion
  is then mirrored in z = 0, § 5.3's exception) multiplies the usual
  root-relative kinematics on the left: f = A(θ) · M_c(θ) · (x, y, −β h). At θ = π this is the reflection chain that carries the
  root cell onto C0, so the result is the same whichever way one walks; for 0 < θ < π it is continuous in the seed except when the
  walk sweeps across a rotation centre of the kaleidoscope. Missing `opts.anchor` means anchor = seed (v1 behaviour).
  Tests: at t = 1 the image of a fixed plane point is the same for 30 random seeds sharing one anchor (hinge and cross-cap
  groups); at t = 0.5 the positions vary continuously along a seed path that crosses one crease.
- **Owner groups for fixes** (each fixer edits only its own files, plus tests for them):
  hinge = `src/folds/hinge.js`, `src/groupdata/hinge.js` · crosscap = `src/folds/crosscap.js`, `src/groupdata/crosscap.js` ·
  roll = `src/folds/roll.js`, `src/groupdata/roll.js` · snowflake = `src/folds/snowflake.js`, `src/groupdata/kaleido.js` ·
  plane = `src/plane.js`, `src/motif.js` · renderer = `src/render3d.js` · core = `src/domain.js`, `src/mesh.js` ·
  ui = `src/app.js`, `src/folds/index.js`, `src/styles.css`, `src/index.template.html`, `src/timeline.js`, `src/hasse.js`,
  `tools/qa-matrix.mjs`, `dev/app-demo.html`.
- **URL state contract (new, the owner's ask on 9 Nov: "make sure that the state is saved in the URL so that I can select the
  various parameters and when I copy the URL over, the parameters are carried over").** The whole visible state lives in the
  hash, and the address bar of the spacesheep page shows it:
  - Format (every key optional; defaults omitted): `#g=<id>&cut=<preset index>&seed=<x>/<y>&wavy=<0..1>&tile=<0..1>&t=<0..1>&view=<az>/<el>/<zoom>`.
    `<id>` is the group id with `*` written `%2A` (`#g=%2A632`); `seed` appears only when the cut was dragged away from the
    preset (then `cut` still names the preset whose metric and anchor apply); numbers rounded (seed 4 decimals, t 3, wavy 2,
    tile 3, az/el 1, zoom 2). The legacy form `#<id>` (e.g. `#333`, `#4*2`, `#*632`) still loads.
  - `tile` (10 Nov, the replication step, § 9): how far the plane's replication has come; absent = 1 = tiled as always.
    It is removed when the replication completes and on a group change; while it plays it is written throttled like t, and
    at once on Pause, at the end and after a scrub. A malformed value is dropped (the tiling as always).
  - The spacesheep wrapper accepts only hashes matching `/^#[A-Za-z0-9_.=%&\/-]*$/` (no `*`, `,`, `:`, `~`, `+`, spaces).
  - On every state change (throttled to one update per ~250 ms, and immediately when a drag, scrub or rotation ends) the app
    1. replaces its own hash with `history.replaceState` (no new history entry), and
    2. posts `parent.postMessage({ type: 'ss-hash', hash }, '*')` when it is inside a frame: the spacesheep viewer then rewrites
       the address bar to `…/the-folding#<hash>` (verified 9 Nov: without this message the address bar does not follow).
  - On load and on `hashchange` (the wrapper forwards a pasted link's hash into the frame, and re-forwards when the address bar's
    hash changes) the app applies the state: group, cut (preset + anchor + metric), seed, wavy, t, and the 3D view.
  - Test it in node (encode/decode round trip, legacy forms, rejection of malformed values) and in a browser inside
    `dev/app-frame.html` (a stand-in for the wrapper that also listens for `ss-hash` — extend it to show the received hash).
- **Klein bottle work in progress (9 Nov).** A separate design workflow owns `src/folds/roll.js`, `src/groupdata/roll.js`,
  `src/motif.js`, `test/roll.test.js`, `test/motif.test.js` and `src/palette.js` until it reports; it leaves requests for other
  files in `notes/klein.md`.

## 8. Round 3 (fixing the round-2 review) — ownership and contracts

The findings, numbered, with the orchestrator's decisions, are in `qa/round3-triage.md`, one section per fixer. Round 3 owns:

| fixer | files (edit only these, plus new test files of your own) |
|---|---|
| ui-app | `src/app.js`, `src/folds/index.js`, `test/folds.test.js`, `dev/app-demo.html`, `dev/app-frame.html`, `tools/qa-matrix.mjs` |
| ui-layout | `src/styles.css`, `src/index.template.html`, `test/shell.test.js` |
| ui-picker | `src/hasse.js`, `src/timeline.js`, `test/hasse.test.js`, `test/timeline.test.js` |
| plane | `src/plane.js`, `test/plane.test.js`, `dev/plane-demo.html` |
| core | `src/domain.js`, `src/mesh.js`, `test/domain.test.js`, `test/mesh.test.js` (and `test/verify-*.test.js` only to correct a provably wrong check, saying why) |
| hinge | `src/folds/hinge.js`, `src/groupdata/hinge.js`, `test/hinge.test.js`, `dev/fold-demo.html` |
| crosscap | `src/folds/crosscap.js`, `src/groupdata/crosscap.js`, `test/crosscap.test.js` |
| snowflake | `src/folds/snowflake.js`, `src/groupdata/kaleido.js`, `test/snowflake.test.js` |
| renderer | `src/render3d.js`, `test/render3d.test.js`, `dev/render-demo.html` |
| Klein-bottle work (separate) | `src/folds/roll.js`, `src/groupdata/roll.js`, `src/motif.js`, `test/roll.test.js`, `test/motif.test.js`, `src/palette.js` |

Nobody runs `build.mjs` in round 3; look at your work through `dev/app-demo.html` (unbundled) or your module's demo page.

**C1 — page attributes, legend, kaleidoscope note, turn hint (ui-app sets, ui-layout styles):**
- On every group change `src/app.js` sets on `#app`: `data-fold="<group.fold>"` and `data-features="<space-separated subset of
  seams mirrors cones corners double>"`: `seams` the tile has cut (glued) edges; `mirrors` it has mirror edges; `cones` the
  orbifold has cone points (rotation centres not on a mirror); `corners` it has mirror corners (rotation centres on mirrors);
  `double` the closed shape has a self-intersection line (xx, 22x).
- The legend items in the template carry `data-feature="…"` and are shown only when `#app[data-features~="…"]`. Texts:
  seams "coloured = edges sewn together"; mirrors "ink = mirror (becomes the rim)"; cones "dot n = cone point";
  corners "ring ∗n = mirror corner"; double "dashed = self-intersection". One line wherever it fits.
- `#app[data-fold="snowflake"]`: the preset row and the Wavy field are hidden and a static `#cut-note` (template, same place)
  reads "Every edge is a mirror: Fold folds the plane onto the tile." The plane pane shows no hint for kaleidoscopes.
- `#turn-hint`: a small hint in the fold pane, "drag to turn", styled like `#hint`; `src/app.js` sets `hidden` on it after the
  person's first rotation of the 3D view and never shows it again in the session.
**C2 — plane:** `P.setScene({ group, domain, motif, star, interactive })`; `interactive` defaults to true; false = no seed
handle, no drags, default cursor. The plane may pan its window by itself to keep the tile in view; `toWorld`/`toCss` stay exact.
**C3 — presets and folds:** a preset may carry `anchor: [x, y]`; the app passes `opts.anchor = preset.anchor ?? preset.seed`.
A fold may expose `mirrored === true`; the app then swaps the renderer's front and back colours for it.
**C4 — renderer:** API unchanged; it handles `prefers-reduced-motion` and WebGL context loss (labels hidden, a one-line
message) by itself.
**C5 — picker and timeline:** `createHassePicker` and `createTimeline` keep their APIs (additions allowed, documented at the
top of the file).

## 9. Final integration (10 Nov) — additions to the contracts

- **Anchor contract, rolls** (src/folds/roll.js, THE ANCHOR): for o, **, *x, xx, F_t is continuous in the seed except
  where the copy of the anchor that the tile is rolled onto (`fold.anchorImage`) changes while a slide is under way: the sheet
  slides round the shape by at most half a turn. At t = 1 the closed shape depends only on the anchor, as for the hinge folds.
- **C3 addition:** a fold may expose `fold.mirroredAt(t)` in [0, 1]; the app then blends front and back by it at every drawn t
  (`fold.mirrored` alone means mirroredAt = 1 at every t).
- **Final fix (10 Nov, notes/integrator-final.md § 6)** — four contract changes:
  - *Hinge page turn.* In the anchor frame A, each mirror of G on the walk turns by φ = `pageTurn(t)` (θ's ramp run in
    `PAGE_END` = 0.5), each crease by θ as before; at t = 1 nothing changes. A tile across a mirror from the anchor turns
    over onto the anchor's side first, and from `PAGE_END` on a drag across a mirror changes nothing in the shape.
  - *mirroredAt everywhere a tile can be mirrored.* The hinge folds (22*, 2*22, 3*3, 4*2) and *x expose `mirroredAt(t)`:
    0 at t = 0 (the flat tile shows its front, as the plane does), 1 once the turn is done, a cross-fade of about
    0.08 of t where the turning piece is seen edge-on from the default camera (az 0, el 55). For *x, `fold.mirrored` is
    "an odd number of mirrors from the anchor's strip", not `params.flip`.
  - *Plane zoom on small panes.* The short side shows 2 viewHalf, except that a tile (√domainArea) takes at least
    `zoomShare(m)` of a pane m px short: 0.3 up to 240 px, fading to 0 at 400 px. The kaleidoscopes never zoom (but for
    the replication's frame on a phone, § 9 Replication step).
  - *Rim chords.* A wavy mesh's rim stays within 0.25 % (`RIM_SAG`) of the true boundary between its vertices
    (the boundary's own points are inserted into long chords); at a tile corner it takes the true corner.
- **Big comma** (qa/fill-judge.md, notes/fill.md): one filled comma per tile, about 30% of it; placements come from
  `node tools/motif-place.mjs`, which writes `src/groupdata/motif.js`. The table carries fingerprints of the group data and of
  the folded shapes, so any change to a lattice, a preset, a default tile or a fold's closed shape makes
  `test/motif.test.js` / `test/motif-view.test.js` fail until the tool is run again. The cross-cap's comma is held to the
  part of the sheet that no preset's fold turns over (`tools/motif-place.mjs` STILL; 29 % of the tile); with its flaps
  tucked under (§ 5.3) that sheet ends on top, and 22x is held to the same view floors as every shape.
- **Replication step** (10 Nov; the owner's ask "add another step where it actually shows how the tiling and replication
  is done"; design qa/rep-judge.md, port notes/replication.md). The plane shows how the tiling is made out of the tile:
  - *The construction* (`src/replicate.js`, pure; owner: plane): the side pairings `domain.edges[i].g` generate G
    (Poincaré), so the copies grow out of D breadth first by word length: the copy across edge i of h(D) is h g_i(D).
    Each copy reaches its place by the continuous motion h ∘ m_i(s), m_i(0) = id, m_i(1) = g_i exactly: a turn about the
    centre (a half-turn by +π), a slide, a flip over the mirror line seen from above, a half screw along the glide axis.
    Layer 1 plays one side pairing at a time (one glue class, or one mirror edge), named in orbifold terms ("half-turn
    about a 2-fold centre", "rotations by ±2π/3 about a 3-fold centre", "reflection in a mirror", "glide reflections",
    "translations"), with a ring on the centre or the dashed glide axis; later layers play whole ("layer k · …"). Each
    copy is a card carrying the tile's seam colours, so edge j lands on the same-coloured edge i; it settles into the
    plain tiling drawn under it. The copies of the window tile it exactly; at u = 1 the plane is drawn as always.
  - *Plane API, a C2 addition* (documented at the top of src/plane.js): `P.setTiling(u, fade = 0)`, `P.getTiling()`,
    `P.tilingPlan()` → `{ duration, stops [{ t, label }] in u, layers, phases }`, `P.tilingCaption(u)` (the short words on a
    pane under `CAPTION_SMALL` = 360 px), `P.setTilingTiming(t)`, and the option `onTilingPlan(info)`. The pattern is
    cached in two layers ('base': motif fills and glide axes; 'mirrors').
  - *DOM* (src/index.template.html): `#tile-caption` (p.hint, top of the plane pane), `#tile-bar` (bottom-left corner;
    `[data-open]` while u < 1 or playing) holding `#tile-btn` (Tile / Pause, `[data-label]`, `data-state` play | pause) and
    `#tile-scrub[data-scrub]` with `#tile-slider`.
  - *App* (src/app.js): `state.tile` with a timeline of its own (`createTimeline({ button: null, keyTarget: null })`: Space
    stays with Fold; magnets at the ends of layers, at least 0.08 of the track apart). Tile plays on from u < 1; from
    u = 1 it fades every copy but the tile out (0.35 s) and replays from the tile alone; Pause pauses. The bar lingers
    1.4 s after the end; `#hint` is hidden while it is open. A group change sets u = 1; a cut, a preset or Wavy keep u.
    The Fold, its scrubber, t and the 3D pane are untouched by the step. `__folding` gains `setTile(u)`, `playTile()`,
    `tilePlan()`; `getState()` gains `tile, tilePlaying, tileCaption, tileBarOpen`.
  - *Tests*: test/replicate.test.js (exactness, the window tiled once, the cards continuous, the URL), test/plane-tiling.test.js
    (u = 1 draws exactly the plane as always, the plan and its words, every stage draws), test/app-url.test.js (`tile` in
    HASH_KEYS and its round trips); tools/qa-matrix.mjs `--interact` has a Tile session; dev/ui3-url-loop.mjs carries tile=.
  - *The final fix (10 Nov 2026; notes/integrator-final.md § 7)*:
    - the side pairings are taken in an order a drag does not change (`replicate.js edgeKey`: mirrors by their outward
      normal, seams by their colour `edge.color`), so a paused or playing replication does not swap its turns mid-drag;
    - **u keeps its moment through a drag, a nudge or a wave**: the plane keeps the replication's length (`rep.lock`;
      replicate.js `opts.total`: layer 1 as it is, the later layers stretched or squeezed within LOCK_RANGE to fill); a new
      group, a cut chosen from outside, a resize, or a plan made at u = 0 or 1 takes its own length. Where the tile's side
      pairings themselves change (an edge shrinks away) the first layer is made of other copies: a new plan;
    - the later layers are quiet (`cardState.quiet`): plain paper, commas, a faint teal, a thin grey outline, mirror edges
      in ink; seam colours, rings and dashed axes are layer 1's;
    - the words end when the last copy has landed (`plan.landed`); the first later layer says what a layer is ("layer 2
      (words of length 2 in the side pairings) · …");
    - *the step's frame on a phone* (a C2 addition): `P.setStepFrame({ top, bottom } | null)` — while the app says the step
      shows on a pane whose short side is under CAPTION_SMALL (app.js `syncStepFrame`, `STEP_INSETS` 30 / 48 px for the words
      and the bar), the window eases (STEP_FRAME_MS 420, smootherstep) to frame the tile and its first layer's paths between
      the words and the bar (scale within STEP_SCALE [0.4, 1.8] of the window as always; the kaleidoscopes too), and back when
      the bar folds away; at mix 0 it is exactly the window as always. `P.getStepFrame()`; `getState().tileFrame` (0..1);
    - the Tile button is the accent-outlined twin of Fold; a replay's fade takes the thumb back with it;
    - tests: test/replicate.test.js (the drag order with an edge-index control, the kept length, quiet, the words),
      test/plane-tiling.test.js (a paused drag through the pointer handlers, quiet layers, the step's frame), and
      **test/plane-tiling-cover.test.js**: the drawn frames read back and checked against the group (every outline g(D)
      with g in G once, every card a tile or h ∘ m_i(s), no overlap, the window covered once at the end, the words name
      the moving cards), with planted defects caught.

## 10. 13 Nov 2026 — the print, the pattern selector, re-cut first

The owner, after the 22× lab (`lab22x/`, the space `@yaroslavvb/the-folding-22x`): *"make the foldings … more
understandable, consider the-folding-22x and use the 'Checkerboard' choice, and for the motion use 'Re-cut first' in the
cases where there is a self-intersection of the surface. Also, I want more of the surface to be covered with pattern, for
instance in \*x, most of the surface is empty, so it's not obvious how the unfolding is happening. Maybe add a selector
at the top which allows me to pick different patterns."* Notes: `notes/recut-prints.md`.

- **The print** (`src/pattern.js`, pure). A print is a two-tone pattern of the plane that EVERY element of the group
  leaves as it is, so it is a pattern of the orbifold: the plane shows it everywhere, the tile carries its share, it
  closes without a break across every seam, and a piece of a re-cut tile, carried by an element of the group, lands in
  register. (The lab's checkerboard was a square grid on one tile's paper; it broke at every seam.)
  - `PATTERNS` = `checker` (the default), `rings`, `comma`; `resolvePattern`, `printFor(group, key)` (null for
    `comma`), `printUniforms(print)`, `fillPrint(c, print, map, box, style)`, `invariantUnder(group, print)`.
  - kind `linear`: dark ⇔ ⌊c₁⌋ + ⌊c₂⌋ + ⌊c₃⌋ is odd for three linear forms cₖ = lₖ·x + oₖ (an unused form is 0): one
    form = stripes, two = checks, three with c₃ = c₁ + c₂ = the alternating triangles of a triangular grid, three with
    half offsets = hexagons and triangles. kind `rings`: dark ⇔ ⌊d / width⌋ is odd, d = the distance to the nearest
    point of a lattice (a reduced basis with a·b ≤ 0: the nearest point is a corner of the cell).
  - The checkerboard is FOUND, not tabulated: grids on the group's own lattice vectors (on a hexagonal lattice the
    triangular grids on it and on its 30° refinement, from the rotation centres), kept when every coset representative
    and both translations leave the tone unchanged at generic points, scored by the size, squareness and right angle
    of a mark and by running along the lattice's shortest vectors. Result: checks for the twelve groups without a
    3-fold centre, triangles for 333, 3\*3, \*333, hexagons and triangles for 632 and \*632 (a half-turn swaps the
    two kinds of triangle). `rings`: the centres of rotation of the highest order (a lattice); without rotations,
    bands along the mirrors (\*\*, \*x), the glide axes (xx), a lattice vector (o).
  - Colours (`palette.js`): the paper has two sides, `PRINT_FRONT` teal and `PRINT_BACK` sand, each [light, dark];
    `PRINT_OPACITY` 0.96 (paper, not glass); the plane's pale tones `PRINT_PLANE_ALPHA`, `PRINT_PLANE_ALPHA_BACK`.
- **Renderer, a C4 addition** (`src/render3d.js`): `setSurface({ …, uv })` (each vertex's point of the paper = the
  mesh's `xy`); `setStyle({ print: printUniforms(print) | null, printFront, printBack, ghostMix, palette })`. The
  fragment shader evaluates the print per pixel at `uv`, anti-aliased by the pixel's footprint (the product of
  sin-shaped square waves; a mean tone when the marks are finer than a pixel). No mesh is cut for a print.
  `ghostMix` < 1 lets the print show through a star's secondary tiles. `palette` + tints ≥ 4: the lab's piece colours
  (the lab now uses this renderer; its generated fork is gone).
- **Plane, a C2 addition** (`src/plane.js`): `setScene({ …, print, recut })`. Under a print: its dark tone, pale, on
  every copy of the tile — teal on the tile's own hand, sand (the paper's back) on the copies of the other hand, which
  replace the grey tint; the tile itself in the paper's two front tones; a card of the replication carries the tile's
  print through its motion, in the colour of the face that is up. `recut: { home, cuts }`: the home tile dotted, the
  cuts dashed, over the tile and under the glyphs.
- **Re-cut first** (`src/folds/recut.js`; `src/folds/index.js` `createFold(…, { recut: true })`, `canRecut(group)`).
  For the two shapes that pass through themselves (fold types `klein`, `crosscap`). The group's DEFAULT cut (presets[0]:
  the Pocket of 22×, the Rectangle of ××) has its own cut along the lines that land on the double line, so it closes
  with nothing passing through anything. Every other tile is first re-cut into it:
  - the pieces are the parts of the tile in the copies e⁻¹(P) of the home P; each is carried rigidly to its place by
    its element (a half-turn swings it about a 2-fold centre, a translation slides it, a glide turns it over its axis
    while it slides: a glide's piece shows the paper's back from then on), one after another — half-turns,
    translations, glides, larger pieces first — hopping over the paper; then the home tile folds by the fold module's
    own motion. At t = 1 the map is the home fold's closed map: the same shape for every cut.
  - the home copy is the one whose seed is nearest the anchor (SPEC 7; the presets' anchors give P itself), without
    an anchor nearest the seed; ties go to the identity.
  - the mesh is the tile's own (the direct fold's, as fine as that fold wants it), cut along the copies of the home's
    rim, with no vertex shared between two pieces; `cells[tag] = { part, home, g, … }`; `boundary` (per edge) and
    `boundaryRuns` (cut where the piece changes: what is drawn); `creases` and `cuts` (the home's creases and rim, on
    the pieces); `locate`. The pieces' areas, order and timing come from the tile's OUTLINE, never from the triangles
    (the draft mesh of a drag and the full mesh move alike); a piece under `DROP_SHARE` of the tile is left out.
  - the fold: `recut { home { name, poly, element }, pieces [{ part, type, text, area, from, to, moves }], movers,
    tau0, seconds, foldSeconds }`, `foldFrom`, `creaseAlpha(t)`, `cutStyle(t)`, `stage(t)`, `doubleLine(t)`,
    `homeFold`, `base`. `duration` = the home fold's + at most `RECUT_MAX_SECONDS` (so up to 12 s: SPEC 5.3's 4–7 s
    is the fold proper).
  - **The claim is tested**: `test/recut.test.js` measures with the lab's detector (`src/selfx.js`) that no paper
    passes through paper over the whole motion (every preset, random cuts, straight and wavy; the triangles within
    0.03 tile sizes of a piece's rim left out: a rim that ends ON a sheet touches it), and that the same detector finds
    the crossing in the one-sheet motion of the same cuts.
- **App** (`src/app.js`): `state.pattern`; `buildScene(group, { …, pattern = 'comma', recut = true })` (the default
  pattern of the PURE half stays the comma, which its tests were written for; the page's default is the
  checkerboard); `scene.print`, `scene.cuts`; `printStyle`, `foldCaption`, `planeRecut`, `ghostEase`,
  `GHOST_PRINT_MIX`. The hash key **`pat`** right after `g`, written when it is not `checker`. `#app[data-pattern]`;
  `#app[data-features]` gains `recut` while the tile on screen is re-cut. `__folding.setPattern(key)`;
  `getState()` gains `pattern, print, recut, foldCaption`.
- **DOM** (`src/index.template.html`): `#pattern-box` (label), `#pattern` (a native select under a pill: swatch, name,
  caret), `#pattern-label`; `#fold-caption` (p.hint at the foot of the fold pane: "re-cut, piece 1 of 2: a glide …");
  the legend's first item under a print, `[data-paper]`: front · back of the paper.
- **Tests**: `test/pattern.test.js` (every group's checkerboard and rings against hundreds of elements of the group,
  planted faults, the shader's formula and the canvas paths against the one tone function), `test/recut.test.js`
  (above, and the SPEC 5.3 contract for the re-cut fold), `test/app-url.test.js` (`pat`), `test/folds.test.js`
  (a re-cut scene's runs and creases; the anchor and crease-window tests ask for the fold modules' own motion).

### 10.1 The same day, after an independent review and the layout test

A second reader of the round's diff (nothing blocking, eight small real findings) and `test/shell-layout.test.js`
(opt-in: `SHELL_LAYOUT=1`, needs a Chrome), which the round had shipped without running. What they changed:

- **`recut.js`**
  - `creaseAlpha(t)`: a tile that is re-cut shows no crease before its home tile folds; the HOME TILE ITSELF (no piece
    moves) shows its creases exactly as the fold module's own fold does, from the flat tile on (the default cut of
    22× had lost its dashed crease at t = 0).
  - every piece above `DROP_SHARE` has its triangles: there is no shortcut for a copy of the home that holds no vertex
    of the mesh (a piece smaller than a triangle lies inside one).
  - `boundaryRuns`: between two samples of the outline the walk goes through EVERY piece on the way, so a third
    piece's sliver gets a run of its own (a stub of the next piece's run had lain on it, 0.019 tile sizes off).
    The only samples that land outside the home tile when their piece carries them are those on the rim of a speck
    that is left out (below `DROP_SHARE`).
  - `mesh.cutsFlat` `[{ pts }]`: the cut lines once each (`cuts` holds every cut twice, as the rim of the piece on
    either side). The flat tile (`sceneLines` at t ≤ 0) and the plane (`planeRecut`) draw these: two dashed lines on
    each other filled each other's gaps.
- **`pattern.js`** `exactlyInvariant(group, print)`: the tone a millionth of a mark either side of the print's own
  lines, under every representative and both translations. The finder asks for it besides the sieve at generic points:
  for a group that does not sit at the origin (turned, scaled, shifted) a grid a hair off the group's centres had
  passed the sieve. The 17 groups of `groups.js` were never affected; `test/pattern.test.js` now moves them about.
- **The plane's two colours are fixed in the plane.** Which copies of the tile are sand is decided by `chamberParity`:
  the number of mirror lines between the tile's seed and the fixed point where the group's comma sits (`motif.at`),
  as for the grey tint before (and as the 3D view's `mirroredAt` swaps front and back). The tile itself is always
  drawn in the front's two tones. So after a drag across a mirror the pale copies of the tile's own hand are the sand
  ones. Kept: recolouring the whole plane at the moment the seed crosses a mirror flickers during the drag.
- **The shell on a phone** (the layout test is the gate for any change to the header or the legend):
  - the pattern selector is its swatch and caret alone under 560 px AND in a low landscape window (the caption
    shares the header's row there); its name shows from 560 px, the word "Pattern" from 720 px.
  - the title is visually hidden under 370 px: with title, chip and selector in a 360 px row the chip lost a word
    (`p3m1 · equilateral…`). It stays in the page for a screen reader.
  - the legend's "front · back" shows from 360 px up (at 320 px it cost the legend a line and the 3D pane its 150 px).
  - the words of a re-cut (`foldCaption(fold, t, short)`): the short ones are at most 40 characters (one line of a
    296 px pane): `re-cut into the Rectangle first`, `re-cut 2/4: half-turn`, `Rectangle folds: nothing passes
    through`. On a 3D pane under 450 px (either side) they have a strip of their own, 26 px at the foot of the pane,
    and the canvas and its labels' layer end above it — over the picture they covered the lower end of a tall tile.
    The strip is there for the whole fold of a re-cut tile (`#app[data-features~="recut"]`), also at t = 1, so the
    picture keeps its size when the words go. `.pane-fold` is a size container (`fold`) for this.
  - Safari: the invisible native `<select>` clips its own text (`overflow: hidden`). WebKit counted "Checkerboard" at
    16 px, 103 px wide in the 49 px pill of a phone, as page width: the page was 42 px wider than its window. Chrome
    clips it by itself, so only WebKit shows it.
- **The layout checks run in two engines.** `test/shell-layout.lib.js` holds them (no import; any Playwright page);
  `test/shell-layout.test.js` runs them in Chrome on the sources, `bash dev/recut/webkit-layout.sh` in WebKit (on the
  M5) on the built page. Both before a change to the shell ships.
- **Tests added**: the reviewer's two cuts and a sweep of 360 folds for the runs (`test/recut.test.js`); the home
  tile's creases against the fold module's own (`test/recut.test.js`, `test/folds.test.js`); turned, scaled and shifted
  copies of all 17 groups (`test/pattern.test.js`); in the layout test the selector, the title, the legend's paper
  item with all three patterns, and the words of a re-cut at seven window sizes.
