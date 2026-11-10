# core agent — notes for the other owners

## 2026-11-09 — what `src/domain.js` and `src/mesh.js` actually do where the SPEC is silent or off

No change is needed in anyone's file. These are the facts to code against.

**Domain**
- `edges[i].nx, ny, c` are normalised: `(nx, ny)` is a unit vector, `nx*x + ny*y - c` is the signed distance from the
  edge line in straight coordinates (negative inside).
- SPEC 5.1 says `inverse(g)` maps edge i onto its partner "reversing the direction of travel". That holds for
  translations and rotations only. For a **glide** the direction is kept (start of i goes to start of j).
  `edges[i].rev` is `true` when the direction is reversed. The plane view's matching chevrons need it.
  Seam tests that use `x' = inverse(g)(x)` pointwise are unaffected.
- `outline(maxStep)` gives every edge an even number of steps, the same for both partners of a glued pair, so sample
  k of edge i is glued to sample `rev ? m - k : k` of its partner. Points include both end corners.
- Extras: `edges[i].len`, `edges[i].mid`, `domain.size` (= sqrt(domainArea)), `domain.seedActual` (warped seed;
  `domain.seed` is the clamped seed in straight coordinates), `domain.edgePoint(i, t, out)`.
- `makeWarp(group, amp)` is equivariant under the group itself (SPEC), **not** under `group.warp`; `group.warp` is
  unused. So with amp > 0 the tile crosses kaleidoscope creases in waves and the mesh has small lobe pieces.
  The field is divergence-free (sum of transverse waves), wavelength 0.75 sqrt(domainArea), peak displacement 8.5 %
  of sqrt(domainArea) at amp 1, Jacobian determinant between 0.82 and 1.42. `warp.inv(x, y, out, gx, gy)` takes an
  optional starting guess. Also `warp.vec`, `warp.jac`, `warp.peak`, `warp.jacMin`.

**Mesh**
- Pieces are in breadth-first order: `root === 0`, `cells[i].parent < i`. `mesh.triCell[t]` is the piece of
  triangle t; `mesh.cell[v]` of a vertex on a crease is the lowest piece index around it.
- A piece's T-coordinates `u = inverse(cells[c].g)(x)` can fall a rounding error outside T (1e-16 for a vertex on a
  crease, up to 1e-7 for a Float32 boundary sample). **Clamp distances to the sides of T at 0 before a square root.**
- Pieces smaller than 1e-13 in area are dropped, not 1e-10 as in the SPEC: a micro-lobe at a nearly degenerate tile
  corner is real, and dropping it leaves boundary points without a piece in their own cell (then seams do not close).
  Such a piece can have Float32-degenerate triangles (zero area in `mesh.xy`): guard normalisations.
- `cells[i].hinge` spans the shared crease segment; for a micro-lobe it is padded to 1e-3 sqrt(domainArea).
- `locate` goes by the point's kaleidoscope cell first (exact), then the nearest triangle of that cell. For glued
  boundary points this gives pieces whose cells correspond under the gluing: tested in `test/mesh.test.js`
  ("glued boundary points fold to the same point of the cell on the same sheet"; for 22x glides: antipodal).
- With amp > 0 the rim of the mesh is a polygon inscribed in the true boundary. It deviates from `mesh.boundary`
  by up to ~0.5 % of sqrt(domainArea) between rim vertices (largest in the middle of a kaleidoscope cell; it was
  ~0.8 % until the evening of 9 Nov, see the last section). `density` above 22 shrinks it quadratically.
- Triangles at default density (preset 0, amp 0): o 3568, 2222 2164, ** 2728, xx 5464, *x 2616, 333 968, 22x 968,
  22* 1936, *2222 968, 2*22 1936, 442 968, 632 968, 3*3 968, *333 484, 4*2 968, *442 484, *632 484.
  buildDomain + buildMesh: 1.5–9 ms per group in node on this Mac (worst seen under load 11 ms).

## 2026-11-09, afternoon — fixes after the two verifier reports (`test/verify-topology.test.js`, `test/verify-robust.test.js`)

No change is needed in anyone's file, and no exported name or field changed. What behaves differently:

**Mesh (`src/mesh.js`)**
- With a wavy cut the mesh is now always a disc: no T-junction on the rim, no hole, no island, no spike. Before, about
  1 wavy tile in 600 had a slit next to a corner of the tile; about 1 in 25,000 had a hole, or a group of triangles
  cut off from the rest (two pieces attached by the orphan fallback); and now and then a thin spike of triangles
  stuck out of the tile along a nearly straight corner or where a cut meets a mirror (rim up to 2 % too long).
  `dev/corefix-scan.mjs` sweeps random tiles for all of these; the counts are in the final report of this fix.
- How: (1) a fine triangle is clipped by every tile edge that a vertex of the clipped polygon is outside of, round
  after round, not only by the edges its three corners are outside of; (2) every edge of the fine mesh that a cut
  crosses twice (a lobe or a notch within one edge) gets a vertex at the deepest point, and its triangles are split
  there. So a wavy mesh has a few vertices more than before (0 to about 20; the roll groups too) and, rarely, lobes
  that used to be glued together along a crease are separate pieces now, as they are in the tile. Meshes at amp 0 are
  unchanged, bit for bit.
- `mesh.locate` gives the same answers, but no longer scans every triangle for a point on the rim or a rounding
  error outside the bounding box. On a lab box a boundary sample took 20 to 35 microseconds; now 0.2 to 0.9, and
  0.7 to 1.9 at 0.03 sqrt(domainArea) off the rim. The search still widens with the distance from the tile: 3 to 5
  microseconds at 0.1 sqrt(domainArea), and a point a tile size away costs a scan of all triangles as before (20 to
  65 microseconds). Nothing in `src/` asks there (`refineBoundary` of `folds/hinge.js` is the only caller, on the
  rim); say so in this file if you need it far out.
- Build time: 0.8 ... 3.4 ms per group on a lab box (see the last section).

**Domain (`src/domain.js`)**
- `conePoints` lists a rotation centre only if it lies ON the tile to 1e-9 (the tolerance vertices are merged at),
  not 1e-7. Presets and ordinary seeds give the same lists as before. A seed 1e-9 ... 1e-7 off a symmetric position
  used to list the glued twin of a cone point as well, although it lies outside the tile.
- A seed that is no seed (NaN, infinite, beyond 1e9) gives the tile of the group's first preset, from `clampSeed` and
  from `buildDomain`; so does a seed so far out that rounding leaves no closed, fully glued polygon. `buildDomain`
  never returns an empty tile. (Tiles of seeds more than about 1e4 lattice periods out are still not exact.)
- New: `warp.bend`, an upper bound of the second derivative of the inverse warp (0 at amp 0). `mesh.js` needs it; a
  warp object without it gets an estimate by finite differences.

## 2026-11-09, evening (18:40) — three more changes; again no exported name or field changed

**The warp is the same in node and in the browser now (`src/domain.js`, `makeWarp`)**
- The field of a group is built from waves with one of two phases, whichever gives the larger displacement. For
  `**`, `xx`, `*x`, `3*3` and `*333` the two are equal up to rounding, and node and Chrome rounded differently: the
  page drew another wavy cut than the tests had checked. The choice now takes the first phase unless the second is
  larger by more than 1e-9. Checked for all 17 groups in node 22, node 25 and Chrome
  (`node dev/corefix-warpdigest.mjs` against `window.__view.warpDigest()` of `dev/corefix-view.html`;
  `dev/corefix-warpcmp.mjs` compares the two outputs).
- So the wavy cut of `o`, `**`, `xx`, `*x`, `3*3` and `*333` in node is not the one it was this morning, and the one
  of `o` and `*x` in the browser is not either. A number you pinned from a wavy tile of these groups before 17:40
  may have moved. Tiles at amp 0 are untouched.

**Mesh, wavy cut only (`src/mesh.js`); meshes at amp 0 are still the morning's, bit for bit (1059 compared)**
- The rim follows the boundary more closely: an edge of the fine mesh that the cut crosses, and that is long for
  the bend of the warp there, is halved first. The largest gap between rim and boundary in the wide sweep of
  `test/mesh.test.js` (22,600 meshes, `CORE_SEEDS=300 CORE_AMPS=0,0.3,0.7,1`) went from 0.82 % of sqrt(domainArea)
  to 0.46 %. It costs up to 16 % more vertices in the hinge groups and 22x (442 "Triangle" at amp 1: 735 -> 849);
  the roll groups' grids are fine enough and do not change.
- A corner of the tile inside a fine triangle: the rim's vertex there is now on one of the two tile edges exactly
  and within the sagitta of the other (it was on neither). Where a cut meets a mirror the corner is exact.
- The trigger was the new default of 22x ("Pocket", 17:55): its glide edges run along the middle lines of two
  kaleidoscope cells, which are lines of the fine mesh. With the seed 1e-9 to 1e-6 off the preset the rim ran 4e-5
  past a corner of the tile and back (a needle of no width; the two suites called it a T-junction). Fixed in
  `mesh.js`, the preset is fine as it is. `test/mesh.test.js` pins these seeds, also derived from the lattice
  (`a/4`, `b/2`), so the lattice of 22x can change again.
- Double crossings of a cut are now looked for on every edge that a split makes, not only on the edges of the fine
  mesh (four levels deep at most). At the default density this changed nothing that the sweeps had found; on a
  coarse mesh (`density: 13`) it removes a spike of triangles next to a short tile edge.
- Sweeps of this code, `dev/corefix-scan.mjs` (manifold, Euler characteristic, one rim loop, no T-junction, rim on
  the boundary, rim length, area, pieces connected, no orphan): 0 defective of 102,000 wavy meshes at amp 0.5 and 1,
  0 of 102,000 at amp 0.05, 0.25 and 0.75, 0 of 25,500 at density 37. At density 13: 21 of 25,500 over a tolerance
  (area off by 1.0 to 1.3e-3, rim 0.10 to 0.12 % too long), none with a fault in its structure.
- Build time (buildDomain + buildMesh, default density, median): 0.8 to 3.4 ms per group at amp 1 on a lab box,
  0.3 to 0.9 ms at amp 0. On the Intel, busy as it was (load average 10): 2.3 to 8.6 ms at amp 1, 0.7 to 5.5 ms at
  amp 0, and inside the whole suite 21 ms at worst. The SPEC allows 30 ms; `test/mesh.test.js` holds the fastest
  of seven builds to it and prints the median (the verifier's timing test does the like with CPU time).

**Known limits**
- A mesh much coarser than the default (swept at `density: 13`; at 37 nothing was over) keeps its structure, but
  its rim chords are long: area and rim length can miss the tolerances of the tests by a little.
- A lobe or notch of the cut shallower than about 2e-5 sqrt(domainArea) within one fine edge can go unseen.
- `locate` far outside the tile: see the afternoon section.
