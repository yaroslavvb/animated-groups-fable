# cross-cap fixer, round 2 part A — 2026-11-09

Owner group "crosscap": `src/folds/crosscap.js`, `src/groupdata/crosscap.js`, `test/crosscap.test.js`.
Round 1 notes: `notes/crosscap.md`. Pictures of this round: `qa/crosscap-round2/`. Scratch probes and step files of
this round live outside the workspace (session scratchpad); every picture named below is in `qa/crosscap-round2/`.

Each entry is written when the piece is finished: what, files, how verified.

## 1. The anchor contract (SPEC 7) for 22x — code in place 2026-11-09 ~21:40, tests: entry 3

What (`src/folds/crosscap.js`):
- `createFold(group, domain, mesh, { anchor })`: the closed shape sits on ONE kaleidoscope cell C0 that depends on the
  anchor alone, `anchorCell(group, anchor, metric)`: round 1's rule for the fixed cell (pickRoot) applied to the
  ANCHOR'S OWN straight tile (seed = anchor, same metric, no wave): the cell in front of the anchor when it is less
  than ROOT_SHIFT hy behind a crease and a quarter of its tile lies there, else its own cell. Why not simply "the cell
  of the nudged anchor" (what hinge.js does): the Pocket's seed lies ON the crease y = b/2; nudged toward +y it falls
  in the cell BEHIND, and the pocket would then be the near half of that cell: the whole tile would have to be turned
  over in stage 2. With the rule all three presets share C0 = [0, a/2] x [0, b/2] (as in round 1), so choosing another
  cut at t = 1 still moves only the seams.
- hingeKinematics is handed, as ITS anchor, a point of C0 next to the anchor (`anchorCell(..).point`, inside by 1e-5 of
  the cell, more than hinge.js's nudge), so its walk starts in C0; kin.anchorIso = C0.
- Stage 2 is placed with kin.anchorIso (centre, signs of the axes) and uses kin.pillow (T-coordinates, the sheet
  relative to C0): never the seed's cell. So at t = 1 every plane point goes to C(pillow over C0), for every seed and
  wave. fold.anchor = the anchor used (null without one).
- No anchor or a malformed one: round 1 exactly (pickRoot, no frame). Anchor = seed: C0 is pickRoot's cell for that
  tile, the walk goes there and back (identity frame): the same fold to rounding (test/folds.test.js checks 1e-9).
- `kin.mirrored` is always false for 22x (all four sides of T are glued), so the fold has no `mirrored` flag.

## 2. Stage 2 for the cuts other than "Pocket": design 'acts' (pinch, roll, fold back) — code in place ~22:20

The problem (round 1, `qa/app/look-22x-bowl-t08.png`): whatever part of the tile lies in the NEAR half of the pillow
(eta < 0) ends at the image of its antipode. Round 1 twisted it about the depth axis while it slid back in y at the
same time, so it was dragged THROUGH the far half: "Bowl" (half of the tile is near) and "Hexagon" (22 %) curl through
themselves between t = 0.6 and 0.9.

The new design. C(P) = R(pi) C(P*) for a near point P, with P* = (xi, -eta, zeta) its mirror point (a point of the far
half) and R the half turn about the double line. So the near part can be moved as: the far part's own zip applied to
its mirror point, a roll about the double line, and a fold back. Three acts on the time u of stage 2:
1. pinch (u in [0, 0.3] for a tile reaching far into the near half): the great circle eta = 0 closes onto the double
   line from both sides; the near part becomes a front pouch hanging from it (the bowl turns into a bow tie).
2. roll (u in [0.08, 0.6]): the front pouch turns half a circle about the double line, in front of the tip, where
   nothing is; next to the double line it waits for the pinch (the gate of round 1's twist).
3. fold back (u in [0.42, 1]): it swings back over the tip, up and over (lift 0.4 of half its travel), keeping its
   bulge, and lands on the far part; the glide seams close last, as in the Pocket.
The quick pinch is weighted by `fold.nearReach` (|L(eta)| at the tile's nearest point; smoothstep over [0, 0.25]):
the Pocket (nearReach 0) zips exactly as in round 1.

Compared before settling (real renderer, `dev/fold-demo.html` sheets, default view az 0 el 55 and side view az 70
el 15, t = 0.5 ... 1):
- `demo-bowl-twist.png`, `demo-hex-twist.png`: round 1 (opts.stage2 = 'twist'): the near half curls through the far
  half (Bowl t = 0.66-0.9, Hexagon t = 0.74-0.82).
- `demo-bowl-acts.png`, `demo-hex-acts.png`: chosen. Bowl: hourglass (0.58), bow tie with the front pouch rolling
  (0.66), a dome in front (0.74), a lid rising (0.82), landing (0.9). Hexagon: its small front flap does the same.
- `demo-bowl-acts-nolift.png` (lift 0: the near rim slides back along the plane; reads less like a lid closing),
  `demo-bowl-acts-rollleft.png` (twist -1: the mirror image, equivalent).
- `demo-pocket-acts.png`: the Pocket, unchanged.
First looks with the software rasteriser: `r-bowl-twist.png`, `r-bowl-acts0.png` (acts crammed into t 0.66-0.84),
`r-bowl-acts1.png`, `r-bowl-acts2.png`, `r-hex-*.png`.
Speeds (largest vertex step per 1/200 of the play, tile diameters): Bowl 0.0250 (round 1: 0.0244), Hexagon 0.0166
(0.0153), a seed in the front of the cell 0.0233 (0.0225); round 1's flap in stage 1: 0.0221.

Two refinements found by measuring (a triangle-triangle crossing count, near part x far part, leaving out the band
|eta| < 0.15 that becomes the double line):
- the NECK (ACTS.neck 0.2): while it rolls, the front pouch keeps the cleft's backward shift mu zeta^2 only next to
  the double line; before, its deep middle reached back over the double line and swept through the back lobes during
  the roll (22-50 crossing triangles at t 0.65-0.75, up to 0.27 tile sizes from the double line). Now 0.
- the LIFT direction: `fold.lift` = 3 x (mean of -zeta over the near part, weighted by |L(eta)|) / (mean of |zeta|),
  clamped to [-1, 1] (a near part mostly on one sheet swings fully to its side), and lift 0.5: the wavy Bowl's near
  edge, which the wave pushes onto the upper sheet, no longer grazes the far part over the tip.
- ACTS.nu0 0.5 (was 0.25): the quick pinch fades in over a wider range of reach, so at t = 0.75 a drag moves a point
  at most 4.7 x as far as the seed (was 7.5x).
Result: 0 crossing triangles at t = 0.55 ... 0.99 for Bowl, Hexagon, a hair behind the cell centre (straight and
wavy) and drags of 0.04 around the Pocket and the Hexagon (also of 0.08). Drags of 0.04 around the Bowl toward the
camera (3 of 8 directions): 7-20 crossing triangles at one or two instants while the near part lands (t 0.85-0.9),
59 in all against round 1's 907 on the same 18 tiles. Their near part lies on both sheets (the tile reaches over the
crease in front), so one swing direction cannot clear all of it. Tried and dropped: each point swinging to its own
side (up from the lower sheet, down from the upper): the wavy Bowl then crossed too (27 triangles).

## 3. The four "2" labels of the Bowl (task 2) — tried a nudged seed, reverted (~23:45); the labels now move legibly

The Bowl's tile is the cell itself: its four corners are cone points (two pairs glued by the glides), so four labels
show until they merge at t = 1. With the acts design the far two never move and the near two ride on the near edge
through the roll and the swing back, landing on the diagonally opposite far corners at t = 1 (`film-bowl.png`).
Tried: the seed b/100 behind the centre ([a/4, 0.26 b]): two cone points only, the far corners, like the Pocket's and
the Hexagon's (`demo-bowl046-acts.png`; two labels from t = 0 to 1; the tile is the cell with two 0.06 bevels).
Reverted because two tests of other owners depend on this preset: `test/hinge.test.js` "hingeKinematics on 22x" needs
a one-piece 22x tile among its cases (only the cell-centre Bowl is one), and `test/motif.test.js` "motifInTile" wants
more than a quarter of its sampled tiles to cut a glyph (272 of 1092 with the nudged seed, needs 273). If the owner
prefers two labels, the hinge and motif owners would add their own one-piece case / sample, and the seed above works
(every crosscap test passes with it).

## 4. Tests (`test/crosscap.test.js`, 35 tests: the 25 of round 1 unchanged, + 10) — done ~23:05, final ~23:55

- anchor 1 (SPEC 7): 8 anchors (the presets, b/100 behind the cell centre, 0.05 behind the crease y = b/2, 3 random) x 30 random
  seeds, straight and wavy: 16 fixed plane points, each mapped into the tile by a group element, land where a
  from-scratch closed shape over the anchor's cell puts them (folding by the kaleidoscope's mirrors in the test, the
  sheet by parity, the cleft map written out again): worst 2.7e-15 tile sizes; same frame, same double line; walks
  of up to 6 lines.
- anchor 2: anchored folds invariant at t = 1 under the half-turn, both glides and products: 10580 pairs, 1e-14.
- anchor 3: seed paths across one crease (Bowl across y = b/2, Hexagon across x = a/2, Pocket across the crease its
  seed lies on), 40 steps, straight and wavy: a plane point that stays in the tile does not move at t = 0.2 (2e-11),
  at the pause (5e-9) and at t = 1 (7e-9); in stage 2 at most 4.7x the seed's step, and the worst step cut into 8 and
  64 shrinks (no jump); control: without the anchor the shape hops a cell along every path.
- anchor 4: anchor = seed equals no anchor (presets straight and wavy, 10 random seeds; 1e-9) at 7 times; six
  malformed anchors give the very same numbers as no anchor.
- anchor 5: the anchor's cell rule (presets, just behind / further behind / in front of a crease, across x creases).
- stage 2 crossings: 54 tiles (Bowl, Hexagon, b/100 behind the centre, drags of 0.04, straight and wavy): 0 for
  acts on the 38 strict ones (round 1's twist: 1322 on the same tiles: the count has teeth); Bowl drags 59 against
  the twist's 907 (<= 1/10 required).
- stage 2 labels: the far corners (the cone points of Pocket and Hexagon, two of the Bowl's four) do not move from
  the pause to t = 1; the Bowl's near two stay in front of the tip until the swing back is half way, behind it after,
  well apart from their partners until t = 0.95, on them at t = 1.
- stage 2 Pocket: acts = round 1's zip (1e-6) and the same double line.
- actsTiming: [0, 1], monotonic, at rest at both ends, no kinks, nearReach 0 = round 1's zip, order of the acts.
- speed: stage 2's largest vertex step at most 1.15 x the twist's (9 cuts; measured 0.96-1.09).
`node --test test/crosscap.test.js`: 35 / 35, 15 s. Remote (`tools/test-all.mjs`): folds, plane, domain, groups,
hasse: 79 / 79; the app's drag-walk diagnostic "folded shape (t = 1) wandering over the walk with one anchor" reads
crosscap 0.00058 tile sizes (3.5 before).

## 5. Looked at, after the last change (real renderer; all in `qa/crosscap-round2/`) — ~23:30

- The real app, `dev/app-demo.html` (the app passes the preset's seed as the anchor), `tools/filmstrip.mjs`, t 0.45-1:
  `film-bowl.png`, `film-bowl-side.png` (az 70 el 15; final Bowl, the cell itself), `film-hex.png`,
  `film-hex-side.png`. Bowl: hourglass 0.55, bow tie 0.6, the front pouch rolls in front 0.65-0.75, swings back over
  the top like a lid 0.8-0.95; the far labels stay, the near two ride on the near edge and land on them at 1.
  Hexagon: its small front flap hangs from the pinched double line (0.6), rolls over in front (0.65-0.75), swings back
  onto the top (0.8-0.95). Nothing passes through anything in the side views.
- With the nudged Bowl seed of entry 3 (before the revert; the motion is the same): `app-bowl-t0.png`,
  `app-bowl-t1.png` and `app-bowl-drag2-t1.png` (a drag at t = 1 to (0.2, 1.05): the same closed shape, frame centre
  identical to 1e-8, the seams moved), `app-bowl-t078.png` (t = 0.78, where round 1 showed the tangle of
  `qa/app/look-22x-bowl-t08.png`: a clean upturned dome in front of the back lobes), `app-bowl-phone-t08.png`.
- Seed sheets, `dev/fold-demo.html` with &anchor=preset (one camera frame for all panels, a plane map in each):
  `seeds-bowl-t1.png`, `seeds-hex-t1.png`, `seeds-pocket-t1.png` (seed across a crease at t = 1: the closed shape does
  not move, only the seams slide; frame centre (0.325, 0.675, 0) in every panel), `seeds-pocket-t1-noanchor.png`
  (control: hops to y = 1.575), `seeds-bowl-t075.png`, `seeds-hex-t075.png` (stage 2 changes smoothly panel to
  panel), `seeds-bowl-t02.png` (stage 1: the part in the anchor's cell flat, the rest folded up about the crease).
- Neighbouring cases: `demo-bowl-wavy.png` (amp 1), `demo-hex-dragged.png` (seed 0.43, 0.6, anchor Hexagon),
  `demo-centre-acts.png` (the exact cell centre, round 1's Bowl: four labels, the two near ones carried onto the far
  ones along the roll and the fold back): the same story, clean.

## 6. Suite (2026-11-09 ~23:58)

`node tools/test-all.mjs` (remote): 583 tests, 582 pass, 0 fail, 1 skipped (the opt-in topology dump of
verify-topology). A run before the revert of entry 3 had exactly the two failures named there. The app's drag-walk
diagnostic: crosscap 0.00058 tile sizes of wandering at t = 1 over the walk with one anchor (3.5 in round 1).
`src/groupdata/crosscap.js` differs from round 1 in its comments only.

## For the other owners (nothing blocking)

- ui: nothing to do. The fold now also has `fold.stage2` ('acts'), `fold.nearReach`, `fold.lift`, `fold.anchor` (all
  informational); `fold.doubleLine(t)` grows with the pinch (complete at t ~ 0.65 for the Bowl; as before for the
  Pocket). The group data is unchanged (the Bowl nudge of entry 3 was reverted).
- hinge, motif (only if the owner wants two labels for the Bowl): `test/hinge.test.js` "hingeKinematics on 22x" and
  `test/motif.test.js` "motifInTile" would need a one-piece 22x tile / sample of their own before the Bowl's seed can
  move to [a/4, 0.26 b] (entry 3).
