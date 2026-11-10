# hinge fixer, round 2 part A — 2026-11-09

Owner group "hinge": `src/folds/hinge.js`, `src/groupdata/hinge.js`, `test/hinge.test.js`, and this round
`dev/fold-demo.html`. Round 1 notes: `notes/hinge.md`. Pictures of this round: `qa/hinge-round2/`.

Task: the anchor contract of SPEC 7 in `src/folds/hinge.js` (and `hingeKinematics`, which the cross-cap fixer builds
on), its two tests, an `anchor=x,y` parameter in `dev/fold-demo.html`, and sheets of the 3D pane along seed paths.

Each entry below is written when the fix is finished: what, files, how verified.

## 1. The anchor contract in `src/folds/hinge.js` (done 2026-11-09 20:53)

What: `createFold(group, domain, mesh, { anchor })` and `hingeKinematics(group, mesh, { anchor })` implement SPEC 7.
C0 = the kaleidoscope cell of the nudged anchor; the straight walk anchor -> seed crosses lines l_1..l_k (found
cell by cell, `kin.walk`); the frame A(theta) = Rot(l_1) ∘ ... ∘ Rot(l_k) ∘ Z_eps multiplies the v1 kinematics on the
left (`kin.frame(theta)`). No anchor, a malformed one, or anchor = seed: exactly v1 (tested bit for bit).
The anchored form is documented at the top of `src/folds/hinge.js` ("THE ANCHORED FORM") for the cross-cap fixer:
`pose` includes the frame; `pillow` Z is minus on the ANCHOR's sheet; `unpillow` goes through `kin.anchorIso`
(= the cell C0: place the cross-cap's stage 2 with it, not with `rootIso`); `kin.sheet[c]` replaces `depth & 1`.

One thing the SPEC text does not say (and needed for its test to pass): 22*, 2*22, 4*2, 3*3 have mirrors of the
group among the kaleidoscope's lines, and the walk can cross them. Rotations alone would then land the tile on the
same pouch but with every point on the other sheet (the seams and the motif would jump between the sheets). A tile
an odd number of mirrors away (`kin.mirrored`, eps = -1) therefore folds the other way round (its own fold mirrored
in z), and A(pi) turns it over exactly onto the anchor's shape. 2222, 442, 333, 632, 22x: eps = 1. (Any tile several
creases from the anchor can pass below the plane mid-fold, eps = -1 or not: entry 4.)

Property found on the way (and tested): f(x) at any theta is the product of the hinge rotations along the path
anchor -> seed -> x, so a plane point that stays in the tile does not move AT ALL while the seed moves (also across a
crease), unless the segment anchor -> seed sweeps over a rotation centre (or the seed crosses a mirror of G).

How verified (`node --test test/hinge.test.js`, 26 tests, all green; the 22 v1 tests unchanged):
- anchor 1: 8 groups x every preset as anchor x 30 random seeds x amp 0/1 = 1440 folds (walks up to 10 lines,
  eps = -1 in 310): at t = 1 = an independent G-invariant reference map of the anchor (kaleidoscope folding in the
  test, nothing from hinge.js) to 6.6e-14 tile sizes at generic points; fixed plane points (their orbit point in each
  tile) land in one place for all seeds and both waves (2.1e-8; the preset seeds that lie ON a crease carry the square
  root of a rounding error); vertices 1.3e-4 (Float32 vertex at a 6-fold mirror corner of 3*3, as in v1); seams
  1.6e-11; at(0) exact identity; finite; at(t) = frame(theta) · v1 to 3.4e-15; folded flat onto C0; continuity in t
  (largest steps cut into 16 split evenly: worst piece 0.065 of the step; no jump next to 0, 1 and the inner times).
- anchor 2: every group x preset x amp (48 paths, 1392 tiles): a straight seed path across ONE crease (found with
  the independent kaleidoscope), at t = 0.5: 78695 plane points in consecutive tiles move <= 1.4e-15 tile sizes; the
  folded surface's centre moves <= 1.97 x the seed; control: without the anchor every path hops by >= 1.0 tile size.
- anchor 3: no / malformed / anchor = seed -> identical to v1 (Object.is on every coordinate, 6 times).
- anchor 4: 22x with anchors: pose(pi, 1) = the anchor's half pillow (1e-14), half-turn seams meet, glide seams
  antipodal, unpillow(pillow) = pose(pi, 1).
Probes: `dev/hinge2-probe.mjs`, `dev/hinge2-paths.mjs`, `dev/hinge2-vertdist.mjs`.

## 2. `dev/fold-demo.html`: `anchor=x,y`, `setAnchor`, the seed sheet (done 2026-11-09 21:00)

What: `&anchor=x,y` (or `&anchor=preset` = the chosen preset's seed, what the app passes) goes to createFold as
`opts.anchor`; `__demo.setAnchor(x, y | 'preset' | null)`. With an anchor the anchor's cell is drawn at z = 0 (thin
grey outline; `&anchorcell=0` hides it) as a fixed reference, and the readout gives the walk ("walk 2 lines", "folds the
other way round" when eps = -1). New: the SEED SHEET, `__demo.seedSheet({ path: [[x0, y0], [x1, y1]], n: 8, t, view })`
or `&seedsheet=x0,y0;x1,y1&n=8`: one panel per seed along the path, ONE camera frame for all panels (a shape that
stays put stays put on the sheet), and in each panel a small map of the plane (kaleidoscope lines: creases grey,
mirrors of the group ink; the anchor's cell shaded; the tile in its seam colours; the path, the seed, the anchor ring).
Steps: `dev/hinge2-steps-seedsheets.json`, `dev/hinge2-steps-closeups.json`; paths from `node dev/hinge2-paths.mjs --want 2
--paths-only --min-first 0.15 <groups>` (straight, from the anchor, two creases, no mirror, clear of rotation centres).

Looked at (all in `qa/hinge-round2/`, anchor = the default preset's seed):
- `{333,2222,442,22s}-seeds-t1.png`: seed along a path across two creases (walk 0 -> 1 -> 2 lines), t = 1: the closed
  shape does not move (every panel's bounding sphere identical, cone points on the same pixels); only the seams slide.
- `{333,2222,442,22s}-seeds-t05.png`: same paths at t = 0.5: the tile sits in the plane "pre-folded" toward the anchor's
  cell (pieces in that cell flat, one crease away turned 140 degrees about it, two creases away about both); coherent
  from panel to panel.
- `{333,22s}-cross-t05-{anchored,v1}.png`, `{2222,442}-cross-t05-anchored.png`: 8 seeds within +-0.03 of the first
  crossing at t = 0.5. Anchored: the shape is the same on both sides of the crease (frame centre moves smoothly);
  without the anchor (v1): it hops to the neighbouring cell at exactly that step (frame centre y 0 -> 0.2887 for 333,
  0.6 -> 1.0 for 22*).
- `333-farseed-tsheet.png`, `2222-farseed-tsheet.png` (seed two creases away), `22s-mirrorseed-tsheet.png` (22* seed
  across the group's mirror y = 0.4: eps = -1): t from 0 to 1, two directions. The tile swings up and over onto the
  anchor's cell and closes into the same shape as the anchor's own; for eps = -1 the tile turns up about the mirror
  line (the mouth) while its flaps turn to the paper's back; their outer ends dip a little below the plane near
  t = 0.15 (expected, see entry 1).

## For the cross-cap fixer: `hingeKinematics` with an anchor (ready 2026-11-09 21:01)

The anchored form is documented at the top of `src/folds/hinge.js` ("THE ANCHORED FORM"). In short, for crosscap.js:
- Pass it on: `hingeKinematics(group, mesh, { plump, root, anchor: opts.anchor })`. Without `anchor` nothing changes.
- `kin.pose(theta, beta)` already contains the frame A(theta); at theta = pi, beta = 1 it is the half pillow over the
  ANCHOR's cell C0, for every seed (tested: `test/hinge.test.js`, "anchor (SPEC 7) 4" for 22x).
- Stage 2 must be placed with `kin.anchorIso` (the cell C0), not `kin.rootIso` (the fixed piece's cell, which moves
  with the seed): `const r = kin.anchorIso` in place of `kin.rootIso` in `createFold` (xc, yc, sx, sy). For kRect both
  are diagonal (axis-aligned), so the sign trick sx = sign(r.a), sy = sign(r.d) keeps working.
- `kin.pillow` is relative to C0 (Z minus on the anchor's sheet); `kin.unpillow` goes through C0, so
  `pose(pi, 1)(p) = unpillow(pillow(p))` still holds. Half-turn seams meet, glide seams are antipodal, as before.
- For 22x every side of T is glued: `kin.mirrored` is always false (no "other way round" case).
- Your `pickRoot` may choose a root outside the seed's cell; the walk then goes on from the seed to that cell
  (documented), so any root works and the closed shape still sits over C0.
- With a seed far from the anchor (walk of several lines) stage 1 swings the tile over to C0 (see
  `qa/hinge-round2/333-farseed-tsheet.png` for the hinge fold); its seams close at HALF_END as before.

## 3. `fold.mirrored`: the closed shape keeps its colours across a mirror of the group (done 2026-11-09 21:05)

Seen in the real app (`dev/app-demo.html`, `qa/hinge-round2/app-22s-mirror-t1.png`, made with
`node dev/hinge2-seedstrip.mjs --jobs dev/hinge2-appjobs.json`): with the anchor, dragging the seed of 22* across the
mirror y = 0.4 at t = 1 leaves the pillowcase, its seams AND its motif in place — but the surface colours swap
(outside dark teal, inside light). Not a bug of the fold: a tile across a mirror of the group is the mirror image of
one on the anchor's side, so its paper is turned over in the closed shape (its +z side outside), and the renderer
colours the paper's sides (front = counter-clockwise from +z in the flat tile).
What: `fold.mirrored` (= `kin.mirrored`, documented in `src/folds/hinge.js`) tells the app that this tile's paper ends
up turned over. `dev/fold-demo.html` swaps `style.front` / `style.back` for such a tile (`&sides=paper` turns that off).
Then at t = 1 nothing at all changes when the seed crosses the mirror, and at t = 0 the flat tile — which jumps to its
mirror image there anyway, in the plane view too — shows its back. Tested: `fold.mirrored === kin.mirrored` in every
anchored fold of "anchor (SPEC 7) 1", false without an anchor ("anchor 3").
Looked at: `qa/hinge-round2/22s-mirror-swap-t1.png` (22*: pillowcase, seams and colours unchanged from panel 3 to 4),
`22s-mirror-swap-t0.png` (the flat tile flips over y = 0.4 and shows its back), `2s22-mirror-swap-t1.png`,
`4s2-mirror-swap-t1.png` (corner pocket and cone pouch: same).

### For the ui owner (`src/app.js`), 2026-11-09 — a request, nothing blocks
In `start()`, after a rebuild: `R.setStyle({ front: m ? SURFACE_BACK : SURFACE_FRONT, back: m ? SURFACE_FRONT :
SURFACE_BACK })` with `m = !!scene.fold.mirrored` (only when it changes). Why: otherwise the folded shape of 22*, 2*22,
4*2, 3*3 changes colour when a drag at t = 1 crosses a mirror of the group (the owner: "no face that suddenly flips or
changes colour"); with it, the change happens at t = 0, where the tile itself jumps to its mirror image. The other
folds never set `mirrored`. (Done that way in `dev/fold-demo.html`, function `rebuild`.)

## 4. Known property of the anchored motion (measured 2026-11-09 21:09; not changed — it is the SPEC 7 construction)

With the seed several creases from the anchor, the chain A(theta) = Rot(l_1) ∘ ... ∘ Rot(l_k) curls the tile through
space on its way to the anchor's cell, and mid-fold it can pass BELOW the plane: `node dev/hinge2-dip.mjs` (hinges
alone, beta = 0, 40 random seeds per group, anchors = the presets) finds the lowest point at 0.42 (2222, walk 4),
0.54 (333, walk 4), 0.45 / 0.94 (22*, eps = +1 / -1), 0.43 / 0.93 (2*22), 0.68 (4*2), 0.89 (3*3, walk 9) tile sizes
below z = 0, around t = 0.4-0.5; the v1 fold never goes below. It cannot be removed by giving the walk joints their own
timing: when the seed crosses a crease, the new joint must cancel the tile's own hinge on that crease exactly, so every
joint turns by the same theta. A seed-independent lift would leave long walks dipping; a seed-dependent one would give
up "a plane point that stays in the tile keeps its place". For the preset itself (anchor = seed) the motion is v1's.
Pictures: `qa/hinge-round2/333-farseed-tsheet.png`, `2222-farseed-tsheet.png`, `22s-mirrorseed-tsheet.png`.

## Suite (2026-11-09 21:10)

`node tools/test-all.mjs` (now runs on aifoundry1): 573 tests, 572 pass, 0 fail, 1 skipped (not mine). A run three
minutes earlier had one failure, `test/render3d.test.js` "labels: hysteresis", while the renderer fixer was editing that
file and `src/render3d.js` (it imports nothing of mine); it passed in the next run. `test/hinge.test.js`: 26 tests
(22 from v1, unchanged, + 4 anchor tests), 35 s on this Mac.
