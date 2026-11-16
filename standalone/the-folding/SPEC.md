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
| `src/pattern.js`, `src/shapes.js`, `src/sdf.js`, `src/patterns/` (+ tests) | integrator (the pattern round, §10–11) | the prints, the shipped shape patterns, their idle making |

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
- **klein (`xx`)** *(the figure-8 bottle: since 14 Nov 2026 no group uses it; xx folds into the classic bottle, §10.3)*:
  translation e2 = (0, b), glide (x, y) → (x + a/2, −y). Stage 1: bend the y-direction into a
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

### 10.2 The owner's page comments of 13 Nov 2026 (evening)

Four comments on the live page, https://spacesheep.dev/@yaroslavvb/the-folding (comment ids `bea4b3d5`, `88289462`,
`3c3de578`, `78a51a6f`, each answered in its thread). Three are done here; the second belongs to the pattern round that
is under way.

| comment (his words) | what changed |
|---|---|
| "*x visualizaiton is too narrow, I want the segment to be more balanced between x repeats and y repeats" | *x's tile is **T × w = 1.2 × 0.6** (2 : 1, as **'s), no longer 1.6 × 0.3 (5.3 : 1): the plane shows about 2 tiles across and 4 up, not 1.6 and 7.7. |
| "tiling of ** for checkerboard vis looks a bit weird, I think maybe tiling should appear from below (away from camera) side to give the impression of yellow side being the reverse side" | In the Tile step a copy that turns over (a reflection, a glide) turns **under the paper** and comes up on the far side of its mirror, sand side up. |
| "also the green vs yellow side unfolding comment applies to 22* reverse side of the unfolding should look like it's coming from the reverse side" | The same rule, for every group with a mirror or a glide. |
| "I want to reuse the two different shades from "checkerboard" pattern for all patterns" | Left to the pattern round (the Comma as a print in the checkerboard's tones). Rings already uses them. |

- **The *x strip** (`src/groupdata/roll.js`):
  - The Trapezoid keeps its 37 degree lean: metric `[1, 0, 1.5 T / w]`, so `[1, 0, 3]` here (the lean's tangent is
    q22 w / 2T).
  - The Möbius band needs R above its half-width, and the lattice alone gives 0.64. `TUNE.mobius` therefore has
    `ratio` 1.5 (R = 1.5 half-widths: a hole of half a half-width where the segment lies flat) and `maxStretch` 1.6
    (sigma 1.53; the checks on the band are about 2.4 times longer than wide).
  - `flap` is 0.7: with 0.6 the anchored drag's second difference was 0.00216 against the bound of 0.002
    (`dev/sx-balance/drag-sweep.mjs`); 0.7 gives 0.00170.
  - The comma needs no stretch: `FILL_STRETCH` is empty, where it was `{ '*x': 2 }`. *x reaches FILL_TARGET (30 %),
    wholly inside its tile, like the 13 groups that are not strips.
- **The flip under the paper** (`src/replicate.js` `cardState.under`, `src/plane.js` `renderTiling` and `drawCard`):
  - A flip's card is drawn first (the deepest first).
  - The paper hides it. The tile is opaque already. The landed copies get a white ground under their print, only while
    a card is under them, so u = 1 and every frame without such a card draw as before.
  - The card leaves its parent downward, hidden by it, passes edge-on below the mirror line, and rises on the other
    side with its back up. A glide's card also slides along its axis while it does this, so its ends show past the
    parent's.
  - While it is below, the paper's shade lies on it: INK at 0.14 × lift, or 0.08 for a quiet card. No card casts a
    drop shadow any more.
  - A rotation or a translation stays in the plane and passes over the tile, as before.
  - Settling cards are drawn over the tiling, as before.
- **The cards' colours under a print**:
  - A card of the first layer is now the paper itself, in its two full tones: teal front, or sand back once past
    edge-on, as in the 3D view. It fades into the pale tiling while it settles.
  - Before, the pale card that lay on the tile at the start of a translation or a turn washed the tile out until the
    card had left it (`**`: the whole tile for half of the translations' phase).
  - Quiet cards (the later layers) keep the plane's pale print on white.
- **Tests**:
  - `test/plane-flip-under.test.js`: `under` exactly for flips. In the plane: the flip's card is drawn before the
    tile's paper, under the white ground and with the shade on it; a turn or a slide is drawn after the tile; there
    is no ground without a card under it; the first layer's cards are in the full tones and the quiet ones pale.
  - `test/tiling-frame.lib.js` finds the tile's fill as the first ACCENT_SOFT fill that is not a card's tint (cards
    drawn before the tile have the same colour).
  - The *x numbers in `test/motif.test.js`, `test/motif-view.test.js` (the strip's period is read from the group),
    `test/roll.test.js` (the stretch bound for the band) and `test/roll-drag.test.js` (the flap is read from the
    fold).
- **Tools**: `dev/flip-under/tile-film.mjs` films the Tile step (frames of the plane pane over a range of u), as
  `tools/filmstrip.mjs` films the fold.

### 10.3 14 Nov 2026 — xx closes into the classic Klein bottle

The owner, looking at `#g=xx&t=1`: *"I expected to see a Klein bottle and only one surface; however, if I look through
it, I see two surfaces, so this visualization is confusing to me."* The figure-8 bottle is one surface, but its two lobes
read as two tori fused along a circle. `notes/bottle.md` has the reasons; the contracts:

- **The fold.** The fold type `klein` is `src/folds/bottle.js` (`src/folds/index.js`); `src/folds/roll.js` keeps the
  figure-8 fold and its tests, used by no group. The Fold has `type: 'klein'`, `stops` flat / folded over / tube in a
  tube / Klein bottle (0, `TUNE.tF`, `TUNE.tR`, 1), `duration` 7, `times`, `schedule(t)` → `{ f, a, h }`, `stage(t)` →
  `{ stage: 'flat' | 'flap' | 'roll' | 'hook' | 'closed', text }`, `doubleLine(t)`, `params` (radii, stretch, `wall`:
  the closed body's axis and radius).
- **The shape.** One tube: body, shoulder, neck, a hook to the side, in through the body's side wall, back to the axis
  inside and down to the base, where the wall turns in (a round rim) and becomes that inner neck. Proportions in units
  of b in `SHAPE`; `bottleShape(b, A)` solves the pieces so that the keel closes, and refuses a tile that does not fit.
  With today's lattice: body radius 0.18, neck 0.085, the paper stretched 1.26 across on the body and squeezed to 0.59 on
  the neck, 1.14 along.
- **The default cut is the home, and it folds with no paper passing through paper.** The Rectangle's two glide-sewn
  edges are the two sides of the curve where the neck goes through the wall: at t = 1 both rims lie ON the wall, point
  for point (the rows near a rim are sheared along the neck onto the saddle), one from outside, one from inside.
  `test/bottle.test.js` and `test/recut.test.js` measure it with the lab's detector (the rims within 0.03 tile sizes of
  the outline left out, as for every re-cut: a rim that ends on a sheet touches it). Every other cut is re-cut into the
  Rectangle first (§10), unchanged.
- **The motion**, three moves, each a bend with growing curvature, overlapping by `TUNE.ov`:
  1. *flap*: the end that becomes the inner neck folds up and over, about the line that becomes the base's rim. An
     isometry; the rest of the sheet lies still.
  2. *roll*: the sheet, doubled where the flap lies, rolls up about an axis that comes down from far above (a wedge of
     a surface of revolution), into a tube with a tube inside it; the far part narrows into the neck. The translation
     seam closes at `TUNE.tR` and stays closed. The stretch along the tube comes with this move.
  3. *hook*: the neck curls round to the wall; inside, the inner neck leans over to the same place. The glide seam
     closes at t = 1.
  The closed shape rests on the plane, centred on the anchor, the hook toward +across; it shows the paper's back (as
  the torus does: the sheet curls up, so the front is inside).
- **Other cuts, folded as one sheet** (`recut: false`; tests and comparisons only): the tile is pulled back next to the
  anchor by the nearest element of the group, rolled about its own middle (the closed tube then rolls over to the keel
  line, at most half a turn about its core), rows beyond a rim follow the straight neck and are drawn over to the other
  end of the tube as the rims close (they pass through the wall there). At t = 1 every plane point goes where the
  anchor puts it (SPEC 7).
- **Words over the fold pane.** `foldCaption` also speaks for a tile that needs no re-cut when its fold names its moves
  (`moveCaption`: only this fold): one line per move, a short one for a phone, and at t = 1 "the two ends are sewn
  through the wall (dashed)". A tile that is re-cut keeps the re-cut's words.
- **The comma** (`src/motif.js`, `tools/motif-place.mjs`): `SEAM_GROUPS` is empty. The comma across xx's glide seam
  would lie under the neck and inside the body (3 % of the default view); xx's comma now comes from the table like
  every other strip's: as large as its cap allows (22 % of the tile), where the default view at t = 1 shows most of it
  (on top of the body: front 56 %, seen 44 %). The seam rule stays in the file, unused.
- **Bounds** (`test/folds.test.js`): `MAX_STEP.klein` 0.046 and `MAX_BEND.klein` 0.0029, set anew by that file's own
  rule (the largest seen over dragged, wavy cuts, 0.031 and 0.0019, and half as much again). The default cut moves
  0.022 and 0.0012 per 1/200; `test/bottle.test.js` holds it to 0.025 and 0.0014.
- **Not changed**: xx's lattice (0.9 × 1.7), its presets, the print, the plane, the URL (`g=xx` links open the new
  shape at the same t).

## 11. 13–14 Nov 2026 — the pattern round: shape prints, Paisley the default, every pattern on the paper

The owner, 13 Nov (dictated; "hints" and "tensors" are tints): *"augment the-folding with more patterns … The tiling one,
I kind of don't like that it's too small, and the comma leaves too much empty space. Come up with some patterns which are
more like a comma but they fill more of the space. And they reuse the idea of the checkerboard by giving different
tensors to … the two sides."* And his page comment **88289462** (13 Nov, 22:10, on
https://spacesheep.dev/@yaroslavvb/the-folding; §10.2 left it to this round): *"I want to reuse the two different shades
from "checkerboard" pattern for all patterns"* — the complaint the two-shade Comma answers (below). The record of the
round (the eleven designs, the judges, what shipped and why): `notes/patterns-round.md`. The machinery:
`notes/patterns-foundation.md`, `notes/patterns-renderer.md`.

- **Shape prints** (`src/shapes.js`, `src/sdf.js`; the contracts in `notes/patterns-foundation.md`). The third kind of
  print (kind `shapes`, beside `linear` and `rings`): the dark tone is the union of g(motif) over EVERY element g of the
  group (W(x) = Σ ±[x ∈ g(P)] > 0, the nonzero rule), so it is a pattern of the orbifold by construction, whatever the
  motif. A motif is a few closed polygons `{ pts, hole? }`.
  - The rules (`validateShapes`): two copies coincide or are `GAP_MIN` (0.02 tile sizes) apart; polygons of a motif do
    not touch; none touches itself; at most `MAX_VERTS` (2400). `printable(print)` is the same with the gap the 3D texture
    holds (`TEXELS_APART` = 2 texels): what the page asks before it shows a print. `thinParts(print, w)` measures what
    is thinner than w (the 3D texture holds nothing under about 1.5 texels); `measureShapes` the dark share and the
    largest bare and solid discs; `texelPitch({ e1, e2 })` the texel of a print's texture from the lattice alone.
  - 3D: the renderer's print mode 3, one read per pixel of an R8 signed-distance texture of one lattice cell
    (`bakeShapes`: `BAKE_SIZE` 1024 a side, baked once per print, the last `BAKE_KEEP` 6 kept). The plane fills a shape
    print once per window into three cached layers; a card of the Tile step fills one world-space `Path2D` of the tile's
    share.
- **The patterns** (`src/pattern.js`). `PATTERNS`, frozen, is the selector's six in its order, each `{ key, label,
  hint }`: **`paisley`** Paisley, **`soft`** Soft commas, **`tomoe`** Tomoe, `checker` Checkerboard, `rings` Rings,
  **`comma`** Comma. The four shape patterns are the modules of `src/patterns/` (`index.js` `SHAPE_PATTERNS`: `{ meta,
  find }`; `find(group) → { shapes, info }`, pure). Every pattern of the selector is a print now, on the checkerboard's
  two-sided paper.
  - `DEFAULT_PATTERN` = `'paisley'` (it was `'checker'`).
  - `SHEET_PATTERN` = `'sheet'`: the picture before the prints, one comma per tile cut into a translucent sheet. Not in
    the selector or the address (`resolvePattern` does not know it, `registerPattern` refuses it). It is the default of
    the pure `buildScene` (its tests were written for it) and what a pattern without a print for a group falls back to:
    `printFor` gives null and one `console.warn`, the app shows the sheet there, `#app[data-print]` is absent — so a
    design that fails in some browser is seen (the layout gate, `app-sheet.mjs`).
  - `resolvePattern` takes the old names: `blobs` (Soft commas' design folder), `soft commas`; `printFor(group, key)` is
    cached per group; `printCached(group, key)` says whether it was asked already.
  - `registerPattern` stays for the dev pages; the keys of the six, their aliases and `sheet` are taken.
    `dev/patterns/app.html` registers a design whose key is built in under `dev` alone (`?design=designs/paisley/
    design.js` shows the design folder's copy beside the page's own) and leaves it out of `?designs=` (it is in
    `__designs.builtIn`, not an error). `app-sheet.mjs --pat <key>` takes any of the six.
- **The three new patterns** (the designs of `dev/patterns/designs/` as they were judged and polished, copied unchanged
  but for their imports; `test/patterns-shipped.test.js` holds each to its design file's motif in all 17 groups):
  - **Paisley** (`src/patterns/paisley.js`): a big comma and smaller ones nestled round it; every comma of one hand, so
    the other hand is the work of a mirror or a glide. Dark 0.48–0.59 of the paper, no bare disc over 0.43 tile sizes,
    2 to 4 marks a tile — in every engine (below: "The same pattern in every browser"). Its 17 default tiles DRAW the
    marks its search grew (`GROWN`, beside the table of winning starts `WINNERS`; 15 Nov): find well under a millisecond;
    a group without presets runs the full search.
  - **Soft commas** (`src/patterns/soft.js`, designed as `blobs`): the level set of a sum, over the group, of comma-shaped
    bumps: one big soft comma with a light eye per tile, exactly half the paper dark; in the narrow kaleidoscope
    chambers a big comma and one or two small ones.
  - **Tomoe** (`src/patterns/tomoe.js`): every tile (a bent copy of the default tile, so no channel runs along its rim)
    split by an S into a dark and a light comma, each with an eye: no background.
- **The same pattern in every browser** (15 Nov 2026, the fixer, after the WebKit review of the round). Playwright's
  WebKit 26.5 (Safari's engine) on the M5 showed ANOTHER Paisley than Chrome in all 17 groups: a mark of 4*2 0.28 tile
  sizes away, *632 another arrangement, dark 0.466 and a bare disc of 0.447 there (outside the bounds above). Paisley's
  search is greedy: it compares sizes, distances and flaws, and WebKit's libm gives another last bit than V8's for 4 to
  38 % of `Math.cos`, `sin`, `hypot`, `acos`, `atan`, `tan`; one bit tips one comparison and every round after it goes
  elsewhere (V8 is not one engine either: Chrome 157 grows a small mark of *333 elsewhere than node, which grows the
  same marks on arm64 and x86). So the 17 default tiles draw `GROWN`: per mark its place, turn, size, curl, cut and tip,
  exactly as the search left them in node on the mini (`dev/patterns/designs/paisley/lab/r3/grown.mjs make`; `check`:
  the same motif as growing, point for point, on the machine that made it), drawn as the search draws a mark (the
  comma's outline, thinned at its size, placed) with no search in between; `KNOBS.pinned` turns it off for the lab.
  - `test/patterns-engines.test.js`: (1) **ulp chaos** — with the last bit of `Math.cos`, `sin`, `hypot`, `acos`,
    `atan`, `atan2`, `asin`, `tan`, `cbrt`, `exp` and `pow` moved for a third of their arguments, the find of every
    shipped shape pattern gives the same outlines in all 17 groups (to 1e-9 tile sizes; within 1e-4 where an outline
    was thinned to other points): Paisley moved in 17 of 17 before `GROWN`, none now; Soft commas, Tomoe and the Comma
    in none either way; (2) a **fingerprint** — every outline's area and centroid (tile sizes, 6 decimals) in
    `test/patterns-fingerprint.json`, to 3e-6: a run on another CPU or engine, or a change that moves a motif, fails
    (`FOLDING_FINGERPRINT=write` after a deliberate one). A knob of Paisley changed needs `winners.mjs make` and
    `grown.mjs make` again.
  - The Checkerboard and Rings are found by searches too, but over a handful of exact candidates: the review found the
    same checks in every engine, and the rings on an equivalent lattice basis in 5 groups (the same picture).
- **The new default and why.** All five judges of the round asked to replace the checkerboard. Paisley has the best mean
  score (76.4 of 100; Tomoe 71.6, Soft commas 70.2), is in all five ship sets, and is the only design that stays
  commas in the kaleidoscopes (every one-mark design turned into bones, crosses or rosettes there). Two judges named it
  the default, two Tomoe, one Soft commas. A link without `pat=` opens with Paisley, so a link of the checkerboard made
  before 14 Nov now shows Paisley; a link of the checkerboard says `pat=checker` from now on.
- **The Comma on the paper** (`src/patterns/comma.js`; comment 88289462). The selector's Comma is the page's own comma
  (`motifFor(group)`: the table's centre, turn and scale) printed front teal and back sand. The print's copy of the
  outline keeps the tail at least `TIP_TEXELS` = 2 texels thick to a round end (`bluntComma(w)`: each point of the
  hollow is moved toward the comma's centre until it lies (t⁴ + w⁴)^¼ inside the back's circle, t its own distance; a
  half circle of diameter w closes it): motif.js's tail is a needle that the 3D texture cut short (under 1.5 texels for
  26–57 texels of outline). Read as the shader reads the texture, along the tail's middle line, motif.js's needle loses
  its last 8 to 22 texels in every group, the round end none (`test/patterns-shipped.test.js`). Nothing moves by more
  than w (0.003–0.007 tile sizes); the copies keep at least 0.07 tile sizes apart, as motif.js's. Under no print (the
  sheet) the plane and the sheet draw motif.js's comma as before. The comma's PLACE is motif.js's: on xx's classic
  bottle it lies over the body, so the closed bottle shows a dark band of sand rather than a comma's outline. In 3D the
  Comma reads fainter than the outlined comma of the sheet did (dark sand on light sand where the closed shape shows the
  back, no ink outline): what comment 88289462 asked for, but the owner should see
  `~/drive.unsynced/artifacts/the-folding-patterns/review-chrome/oldnew/comma-old-new.png` before judging it.
  - Motif.js's table places the comma for the page's 17 groups only. A turned, scaled, shifted or mirrored COPY of one
    (the same id; its lattice and centre carried by a similarity) gets that group's comma carried along (`pageCopy`,
    `info.from`; 15 Nov: motifFor threw for such a copy without presets, and shrank the comma of one that kept them);
    any other group is motif.js's to place (one without presets has no place: printFor shows the sheet, with a warning).
    Its hint no longer speaks of the page's history: "one big comma per tile, on the paper: front teal, back sand".
- **A group change does not wait for the print** (`src/patterns/warm.js`; `src/app.js`). A shape print's find,
  `makeShapePrint` and `printable` run when a group first shows it. Once the page is idle the current pattern's prints
  of the other 16 groups are made, ONE group per idle slot (`requestIdleCallback`; Safari has none: a chain of
  `IDLE_FALLBACK` timeouts), never within `QUIET_MS` (400 ms) of an input or a drawn frame (every input, frame and
  rebuild pokes it), never in a slot with under `MIN_SLOT_MS` (30 ms) left, the groups after the shown one first. A
  pattern change drops the queue (and its pending slot) at once; the texture is not made ahead (`BAKE_KEEP`).
  - Since the reviews of 15 Nov: a slot must also hold the longest print of the pattern so far (a 35 ms print had
    started with 31 ms left), but never more than 0.9 of the longest slot the scheduler gives (`longest`: 50 ms for
    `requestIdleCallback`, `IDLE_FALLBACK.slot` 40 ms for Safari's chain), so a print longer than any slot takes a
    whole idle period and never waits for ever. Safari's chain says a slot is empty when its timer came more than
    `IDLE_FALLBACK.late` (15 ms) after it was due: the main thread was busy, its only sign of that. A HIDDEN page
    (another tab in front: `document.hidden`) makes nothing and asks for no slot; on `visibilitychange` back to visible
    the page calls `warm` and the queue goes on.
  - `createWarmer({ ids, prepare, ready, idle, cancel, now, quiet, minSlot, longest, hidden })` → `{ warm(key,
    shownId), poke(), stop(), state() }`; `idleScheduler(win)` → `{ idle, cancel, native, longest }`.
    `getState().warm` = `{ key, left, made, skipped, ms, maxMs, slots, passed, errors }`; `__folding.warmer`: `stop()`
    holds only until the next group or pattern change, which starts it again — to time a change with nothing made
    ahead, stop it after EVERY change (the integrator's table of 14 Nov stopped it once, and the warmer made 5 to 11 of
    the 16 groups ahead between its changes; the review of 15 Nov).
  - Measured in Chrome on the mini: see the table at the end of this section.
- **App** (`src/app.js`): `state.pattern` starts as Paisley; `buildScene({ pattern = SHEET_PATTERN })`; the hash
  writes `pat=` when the pattern is not Paisley; `#app[data-print]` is set under every print of the selector (the
  shell's swatch and the legend's "front · back" follow it).
- **Shell** (the shell agent; `src/index.template.html`, `src/styles.css`): the six options in order; one swatch per key
  (`svg.pat-sw.pat-sw-<key>`, 18 × 18, the print's two tones); before the script runs the pill shows Paisley; the
  legend's paper item is one rule, `.app[data-print] .lg[data-paper]`, hidden under 360 px as before.
- **Tests**: `test/patterns-shipped.test.js` (each of the three in all 17 groups: printable, `GAP_MIN`, exactly the
  group's, 0.40–0.62 dark, no bare disc over 0.5, no part thinner than 1.5 texels, find pure and quick and equal to its
  design file; a turned, scaled and shifted copy of every group without presets; the Comma print: no thin part where
  motif.js's comma has one, the 3D texture holding its tail to the end, its outline motif.js's but for the tail's end;
  the template's options and swatches against `PATTERNS`); `test/patterns-warm.test.js` (a fake scheduler and clock;
  then the real prints in printFor's cache). Changed on purpose: `test/pattern.test.js` (six
  patterns, Paisley the default, the comma a print, the taken keys), `test/app-url.test.js` (no `pat=` for Paisley,
  `pat=checker` written, the old names, an unknown `pat` falls back to Paisley, the sheet), `test/recut.test.js` (the
  comma that rides on the re-cut pieces is the sheet's). The layout gate (`test/shell-layout.*`, opt-in) checks every
  pattern at every size in Chrome; `dev/recut/webkit-layout.sh` the same in WebKit on the built page;
  `dev/recut/browser-check.mjs` the selector, the address and the Comma's colours on the built page.
  - Added 15 Nov, after the three reviews: `test/patterns-engines.test.js` (ulp chaos and the fingerprint, above);
    `test/patterns-symmetry.test.js` (no shipped shape print has an isometry its group lacks: the print rasterised on
    the torus at 120 × 120, every lattice-preserving linear part outside the point group and every translation at once
    by FFT, a candidate over the raster's level for an exact symmetry checked with the exact tone; the nearest is
    Paisley's ** at 0.84 of its dark, an exact one reads over 0.96; the control finds 2222's half-turns when the print
    is looked at as one of its translations alone — the review had found no test that asked);
    `test/pattern.test.js` "the sharp check reads BOTH sides of an outline, and passes nothing it could not read" (a
    print dark in a thin band round the outside of the motif's copy one step along e1, and one light in a band round its
    inside; a print whose tone was moved off its outlines — the review's planted faults P7, P7b and P7c, and P7c's
    mirror that reads the light side only, all fail it); `test/patterns-warm.test.js` (a hidden page; a slot that must
    hold the longest print; Safari's late timer); `test/patterns-shipped.test.js` (the Comma of a turned, scaled,
    shifted or mirrored copy of every group); the layout gate wants a shape print of the Comma in every group (it took
    the Comma with no print at all); `dev/recut/browser-check.mjs` checks the page's wiring of the warmer: the 16 other
    groups made after the load, nothing made while Fold plays or while a frame is drawn every 250 ms, nothing while the
    page is hidden and all of it once it shows (planted in a copy of the sources, each of "rebuild never tells the
    warmer", "no drawn frame pokes it", "the warmer never hears the page is hidden" and "no visibilitychange listener"
    fails it; drawFold's poke alone taken away is no fault: the renderer's change listener pokes once per redraw too).
- **The time of a group change** (measured again 15 Nov, after `GROWN` and the warmer's changes: Chrome on the mini,
  1280 × 720, the BUILT page; a fresh page per pattern and mode, each group once per page, the median of three pages,
  the warmer stopped after EVERY change for "nothing made ahead"; the print's own first ask on the sources, in one loop;
  `dev/patterns/scratch-review-chrome/perf.mjs`, `dev/patterns/scratch-integrator/print-time.mjs`; JSON in
  `~/drive.unsynced/artifacts/the-folding-patterns/fixer3/perf-dist.json`, `print-time.json`):

  | pattern | its print, first ask (median / max) | the warmer's idle slots (mean / max) | setGroup, nothing made ahead (median / max) | setGroup, made ahead while idle (median / max) | a fresh page: its first scene drawn |
  |---|---|---|---|---|---|
  | Paisley | 1.0 / 5.1 ms | 4.5 / 7.7 ms | 24.8 / 48.8 ms | 22.7 / 48.7 ms | 56 ms |
  | Soft commas | 5.8 / 15.8 | 12.9 / 20.2 | 34.5 / 51.4 | 23.6 / 48.7 | 58 |
  | Tomoe | 3.8 / 8.3 | 11.8 / 17.7 | 31.2 / 47.5 | 23.2 / 48.8 | 58 |
  | Checkerboard | — | 8.5 / 15.3 | 19.1 / 45.8 | 11.6 / 43.5 | 43 |
  | Rings | — | 2.8 / 5.1 | 16.4 / 44.3 | 14.3 / 44.5 | 43 |
  | Comma | 0.7 / 2.2 | 3.0 / 3.9 | 19.7 / 47.3 | 18.1 / 46.9 | 46 |

  Paisley drawn from `GROWN` costs a millisecond where its grown start cost 8 (22.7 at most): its group change with
  nothing made ahead fell from 36.6 to 24.8 ms (the review's measure of 15 Nov, the warmer stopped after every change),
  and a fresh page draws its first scene 14 ms after the Checkerboard's, not 32. What the warmer still takes away is
  Soft commas' and Tomoe's print: 8 to 11 ms of a median group change. The rest of a group change (the tile, its mesh
  and fold, the plane's layers, the 3D texture: 5 to 12 ms of it is baking and uploading the print's texture, which the
  warmer leaves alone) is 15 to 45 ms either way, xx and 22x the most (their re-cut and the bottle). In every page the
  warmer made all 16 groups, one per slot, with no error. The integrator's table of 14 Nov had a "nothing made ahead"
  column with 5 to 11 of the 16 prints made ahead (its pages stopped the warmer once).
  - A phone, roughly (390 × 780, dpr 3, touch, Chrome's CPU slowed 4×; `phone-perf.mjs`): the first scene is drawn
    212 ms after the response under Paisley (188 under the Checkerboard; 270 before `GROWN`); the warmer's longest
    slot is Paisley 10.6 ms (48.9 before), Tomoe 21.6, the Comma 7.8, the Checkerboard 47.6 and Soft commas 64.6: a
    Soft commas print is longer than any idle slot there, so it takes a whole idle period (45 ms or more left), and a
    tap that comes during it waits up to that long, once per group, in the first second or so after a change.
  - Safari: WebKit has no `requestIdleCallback`; on the M5 the review measured the chain's slots at 32 to 38 ms before
    `GROWN` (Paisley 24 ms a group on average), all 16 groups made per pattern, no error; a group change there took 15 ms
    median (Paisley) and 13 (Soft commas) with nothing made ahead.
- **The build and the gates** (15 Nov 2026, 00:02–00:19): `node build.mjs` — the page is 453 362 bytes (442.7 kB, 175.4
  kB gzipped; it was 355 625 bytes: the four motifs and the warmer). The suite on the mini (`dev/patterns/suite.sh`):
  903 tests, 901 pass, 2 skipped (opt-in), 0 fail. The layout gate in Chrome: on the sources (210 s) and on the build
  (`SHELL_LAYOUT_PAGE=dist/index.html`, 226 s), every pattern at all 23 sizes for all 17 groups, the page opening with
  Paisley, no problem; the 3D pane at 375 × 498 is 183 px for 333 and at least 152 px for every group. In WebKit 26.5 on
  the M5, on the build: "all passed", "opened with paisley" (161 s). `dev/recut/browser-check.mjs` on the build: 33
  passed, 0 failed. The built page's sheets at t = 0.6, all 17 groups, of Paisley, Soft commas, Tomoe, the Checkerboard
  and the Comma: `integrate/dist-<pattern>-t06.png`.
  - Again after the fixes (15 Nov 2026, 01:24–01:53): the page is 459 446 bytes (178.6 kB gzipped; `GROWN` is most of
    the 6 kB more). The suite on the mini: 912 tests, 910 pass, 2 skipped (opt-in), 0 fail. The layout gate in Chrome,
    the Comma now held to a shape print in every group: on the sources (212 s) and on the build (211 s), the page opening
    with Paisley, no problem. `dev/recut/browser-check.mjs` on the build: 40 passed, 0 failed; the review's fast
    switching (`dev/patterns/scratch-review-chrome/fast.mjs`): 11 passed. Node (x86, the sources) and Chrome (the
    build) give every Paisley motif to 2e-16 in all 17 groups (`fixer3/fp/`). The built page's sheets:
    `fixer3/<pattern>-t06.png` for Paisley, Soft commas and Tomoe, and `fixer3/paisley-t0-close.png`. NOT re-run: the
    WebKit gate — the M5 was off the tailnet from 01:30 on. Before a deploy: `bash dev/recut/webkit-layout.sh`, and
    `bash dev/patterns/scratch-fixer3/wk-fp.sh` (every print's motif and the warmer in WebKit, to `fixer3/fp/`), then
    `node dev/patterns/scratch-fixer3/fp-compare.mjs` (Paisley should now be WebKit's too, to rounding).
- **Not done, not seen**: a real phone, and Safari itself (only Playwright's WebKit); the rest of a group change (15–45
  ms, with about 10 ms of noise between pages) is untouched, and so is the texture's bake on a group change (5–12 ms);
  Soft commas' print is longer than any idle slot on a phone-speed CPU (65 ms at 4×: see above); a group without
  presets that is no copy of a page group still has no Comma, and Paisley still searches for one (only the tests make
  such groups). (The Comma of a moved copy of a page group, `dev/patterns/README.md` and
  `notes/patterns-foundation.md` were done on 15 Nov.)

## 12. 15 Nov 2026 — one journey: the surface, the tile, the pattern (Conway's chapter 8)

The owner, 15 Nov 2026 (session message; the fixes link back to it from the page's
[SPEC on GitHub](https://github.com/yaroslavvb/animated-groups-fable/blob/main/standalone/the-folding/SPEC.md)):

> can you make sure that folding is compatible with Conway's approach to surfaces (chapter 8 in … The Symmetries of
> Things) and implementation in https://spacesheep.dev/@yaroslavvb/classification-of-surfaces . In particular, I'm
> confused about the folding of …#g=%2A632, Normally, the folded part is just the surface, but here there is a bit of
> confusion about which part lies in the folding and which part lies in the tiling. Unify those two. Also, maybe the
> Unfold and Tile buttons should be in the same place so I can first unfold and then tile. Also, get rid of
> crystallographic notation. I only care about ortho.

("ortho" is read as the orbifold notation.) Why and how it was decided: `notes/unify.md`.

### 12.1 The model

Chapter 8: "Any repeating pattern can be folded into an orbifold on some surface"; a surface is polygons and zippers.
The page shows that as ONE journey with three stops (`src/journey.js`):

| stop | what is on screen |
|---|---|
| **surface** | the tile with its zippers zipped: the orbifold's surface |
| **tile** | the tile, flat, alone |
| **pattern** | the copies of the tile that the group makes |

- `t` (the fold, 0–1) and `tile` (the copies made, 0–1) lie on one line. **A tile that is not flat has no copies:**
  `t > 0` means `tile = 0` (`normalizeState`). So there is no state "folded, with the pattern tiled" any more.
- **What is folded is always the tile alone; the copies are always the pattern.** That holds for every group.
- **A kaleidoscope's tile is its surface.** Every edge of the tile of `*2222`, `*442`, `*333`, `*632` is a mirror, so it
  has no zipper: nothing is glued, and the tile is the orbifold already, a disk (fig. 8.1: "a triangle is a tidy
  surface — it's a sphere with a hole in it") with a corner point at each corner.
  - Fold type **`disc`** (`src/folds/disc.js`): `at(t)` is the identity, `duration` 0, `still: true`.
  - The journey has no fold half for it. Its Fold is the pattern folding along its mirrors onto the tile: the tiling
    run backwards.
  - `src/folds/snowflake.js` (the star of 2n tiles folding onto the tile) stays in the tree with its tests, used by no
    group, as the figure-8 Klein bottle does. Its star was the confusion: copies of the tile shown in the folding.

### 12.2 The 3D pane shows the whole journey (`src/tiling3d.js`)

On the tiling's half the 3D pane shows the tile making its copies round it: the plane's own plan (`P.getPlan()`), the
same copies at the same moments. So the surface unfolds into the tile and the tile into the pattern in one view.

- **The copies shown**: a round patch about the tile (`tilingPatch`): copies whose centre is within `T3_LIMITS.reach`
  (4.4) tile radii, at most 64, each with its parent. The plane shows its whole window; the 3D pane this patch.
- **The motions** are motions of space whose view from above is exactly the plane's card (`copyPlace`, `placePoint`):

  | side pairing | motion | where |
  |---|---|---|
  | translation | slides | over the paper, lifted by `OVER` (0.014 tile sizes) |
  | rotation | turns about its centre | over the paper, the same |
  | reflection | a half-turn of space about the mirror line | under the paper; it lands back up (sand) |
  | glide | the half-turn while it slides, sunk by the tile's half-width | under the paper |

  A glide's tile lies on both sides of its axis, so the bare half screw would send half of it up through the paper;
  sinking it by `dip · sin(π s)` keeps all of it below, and it is still a rigid motion.
- A copy enters the picture once it has left its parent (`START_S`): before that it lies on its parent, and a second
  sheet on the same spot would only make the nearly opaque paper denser there.
- Every copy is the paper in its full tones, as the tile is. The tile is known by its bold edges and marked points.
- The labels of the tile's points fade as the camera backs off (`PATTERN_LABELS`); the creases of the fold to come
  fade as the first copies are made (`CREASE_GONE`).
- The camera's frame is the bounding sphere of what is shown, so it backs off as the pattern grows.

### 12.3 One transport (`src/index.template.html`, `src/styles.css`, `src/app.js`)

One scrubber under the 3D pane: the surface at its left end, the tile in the middle (`TILE_AT` 0.5; a kaleidoscope: at
the left end, named "tile = surface"), the pattern at its right end. A button at either end:

| button | where | what it does |
|---|---|---|
| **Fold** (`#fold-btn`) | left of the scrubber | plays to the surface. From the pattern the copies are gathered first, `GATHER` (3.2) times as fast as they were made. A kaleidoscope's gathering is its fold: `KALEIDO_GATHER` 1.5. Disabled at the surface. |
| **Unfold**, then **Tile** (`#next-btn`) | right of the scrubber | plays toward the pattern one stop at a time: Unfold to the flat tile, then Tile to the pattern. At the pattern, Tile gathers the copies (`REPLAY_GATHER` 7) and makes them again. |

- A button pauses the play it started; the other one turns the play round. Space pauses, or goes on the way the last
  play went.
- The button that goes on that way is solid, the other outlined (`#fold-controls[data-lead]`, `[data-quiet]`).
- The fill of the scrubber runs from the tile to the thumb, either way.
- The names of the stops show while the transport's row has room (`@container fctl`): all three from 352 px, the two
  ends from 272, none below. The narrowest row of the layout test's 23 sizes is 248 px (a 640 × 360 phone on its side).
- The Tile bar left the plane pane. The plane keeps the tiling's words (`#tile-caption`) and, on a phone, its frame
  under the words while copies are being made.
- **The pale map** (`plane.js` `GHOST`): at `tile = 0` (the tile stop, and all through the fold) the plane keeps the
  pattern under the tile at 0.4 of its strength, so a cut can still be chosen by eye. It is one cached image, gone by
  `tile = 0.07`. Without a document (node) there is none.

### 12.4 The address

- The keys are unchanged: `g, pat, cut, seed, wavy, tile, t, view`. `tile` is written only when `t = 0`.
- Decoded: `t > 0` sets `tile = 0`. An old link with `t=1` and no `tile` shows the surface, as before; its plane now
  shows the pale map, not the full pattern.
- A kaleidoscope has no fold: a `t` in its link shows its tile alone (`tile = 0`), which is its surface.

### 12.5 The words (Conway's, and the Classification of Surfaces page's)

- **No crystallographic names** anywhere: `hm` is gone from the group data, the chip, the picker and the dev pages.
- The chip shows the orbifold symbol and `group.surface`, the surface's plain name: sphere, disk, torus, annulus,
  Möbius band, Klein bottle, projective plane.
- The caption (`group.topology`) says the surface as chapter 8 does, with its points:

  | orbifold | caption |
  |---|---|
  | `o` | a sphere with a handle; no cone points, no mirrors |
  | `**` | a twice-punched sphere; both rims are mirrors |
  | `*x` | a punched crosscap; its rim is a mirror |
  | `xx` | a pair of crosscaps; no cone points, no mirrors |
  | `22x` | a sphere with a crosscap and two cone points of order 2 |
  | `2222` `442` `333` `632` | a sphere with … cone points … |
  | `22*` `2*22` `4*2` `3*3` | a punched sphere with … cone point(s) …; its rim is a mirror with/without corners |
  | `*2222` `*442` `*333` `*632` | a punched sphere; its rim is a mirror with … corners … |

- Its first words (`group.tidy`) are a link into the Classification of Surfaces page (`group.tidyAt`): the example of
  its tab 4 for the torus, annulus, Möbius band, Klein bottle and disk; the crosscap of tab 1 for `22x`; tab 2 for the
  spheres. `build.mjs` lets that one address through besides the companion link.
- That link is a link in a sentence, one line high: the one control that is not a 44 px tap target (the chip is 2 px
  above the caption's first line and the plane 4 to 8 px below it). WCAG 2.5.8 exempts such a link ("Inline"). The
  layout gate and `tools/qa-matrix.mjs` ask of it: every piece inside the caption's box (the clamp cuts nothing of
  it), at least 44 px wide, at least 14.5 px high.
- The chip's tooltip counts the surface as that page does: χ, boundaries, sides (`groups.js` `surfaceFacts`).
- The legend: "same colour = a zipper", "ink = mirror: the rim of a hole (∗)", "ring ∗n = corner point", "dashed =
  the surface crosses itself (×)".
- The shapes checked against chapter 8's examples (pp. 105–106): the disk ∗, the annulus ∗∗, the torus ○, the Möbius
  band ∗× and the Klein bottle ×× are each drawn as that surface. The bottle is the cross-handle picture, which the
  chapter shows equal to two crosscaps (⊗ = ××, p. 101).

### 12.6 Removed

- From `app.js`: the star's support — `motifFades`, `motifFade`, `ghostColor`, `ghostEase`, `GHOST_PRINT_MIX`,
  `scene.star`. No mesh sets tint bit 0 now.
- From the shell: `#tile-bar`, `#tile-btn`, `#tile-slider`, `#tile-scrub`.
- From `__folding.getState()`: `tileBarOpen` (now `tileOpen`). Added: `journey`, `journeyStop`, `journeyTile`, `lead`,
  `going`, `nextButton`. Added to `__folding`: `setJourney(j)`, `press('fold' | 'next')`.
- `__folding.setT(0)` keeps the copies as they are; `setTile(0)` gives the tile alone.

### 12.7 Tests and tools

- New: `test/journey.test.js` (the line, the stops, the buttons' targets, the seconds, which groups have a fold half);
  `test/tiling3d.test.js` (the patch; the mesh; every copy starts on its parent, lands on its place, is moved rigidly,
  a flip under and a turn or slide over the paper, its view from above the plane's card; a mirror image lands back up;
  nothing jumps; the lines); the pale map in `test/plane-tiling.test.js`.
- `test/folds.test.js` takes the `disc` fold through the generic checks (still: nothing moves).
- The layout gate (`test/shell-layout.lib.js`) checks the transport: the row's order, the buttons' words, the
  scrubber's width, and the stops' names measured with their own font.
- Tools: `dev/unify/journey-film.mjs` (the journey frame by frame), `dev/unify/transport-check.mjs` (the buttons, Space
  and old links in a real Chrome), `dev/unify/drag-cost.mjs`. `tools/filmstrip.mjs` films the fold of the tile alone.
  `tools/qa-matrix.mjs --interact` drives the new transport.
- After a deploy: `dev/unify/live-check.mjs` on the real viewer — the owner's link `#g=%2A632`, the torus through
  Fold, Unfold and Tile with the viewer's address, no crystallographic name for any group (text, tooltips, labels, the
  picker), every caption's link, a click on `*x`'s opening the Möbius band of the Classification of Surfaces page, and
  a phone. `dev/recut/ss-live.mjs` and `dev/recut/webkit-live.mjs` know the new chip and the new row.
