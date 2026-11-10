# Roll folds, round 4 (the roll fixer) — Tue 10 Nov 2026

Findings: `qa/round3-triage.md` § DEFER-roll (4, 27, 28, 44, 45, 46). Files: `src/folds/roll.js`, `src/groupdata/roll.js`,
`test/roll.test.js`, `test/klein.test.js`, new `test/roll-anchor.test.js`. Scratch: `dev/roll4/` (preview tree with the
judge's big comma, film script, comma-visibility script; deletable when round 4 is integrated). Pictures: `qa/roll-round4/`.
Backups of my four files as they were at the start: `dev/roll4/*.v1-backup.js`.

## Log (as I go)

### 00:25 — before pictures
`node dev/roll4/films.mjs dev/roll4/jobs-before.json` (one Chrome on the mini, 32 films in 82 s, 0 console errors):
`qa/roll-round4/before-{o,ss,sx,xx}-*.png` — every preset at az 0 el 55 (900 x 640), phone 390 x 780, az 70 el 20,
az -110 el 30, a dragged seed, amp 1, and `before-*-anchor-t1.png` (t = 1, six seeds along a drag). Confirmed: at t = 1 the
seams stay put and the comma travels round the torus / tube / band / bottle as the cut is dragged (finding 4); xx stage 1
is a needle from the default view (finding 28); ** is a lampshade (44).

### 00:41 — finding 4, the anchor contract for the rolls (src/folds/roll.js; header § THE ANCHOR)
- `anchorFrame`: g = the element of G carrying opts.anchor nearest the warped seed (into the seed's strip for ** and *x):
  a translation for o, *x, xx; for ** a translation, or tau_v o r_l when the strips are an odd number of mirrors apart.
- F_t(x) = M_t(R_t^{c(t)}(g^-1 x)): the tile is pulled back next to the anchor and rolled about a centre moving from
  g^-1 p to the anchor (two-stage folds: across with stage 1, along with the ring); M_t = tau_{(1-s) v} carries it back
  (slide by stage). For ** with a reflection, M_t also turns the tile over the mirror like a page (first half of the
  fold, smootherstep), about the mirror line lifted to half the rolled sheet's height: nothing dips below the plane.
  fold.mirrored = true then (SPEC 8 C3: the app swaps the surface colours).
- At t = 1: Phi_a(g^-1 x) = Phi_a(x). Without an anchor (or a malformed one): exactly v1. fold.anchor, fold.anchorImage.
- The *x band's lift is now taken over the tile's actual extent along the strip (it was sin(pi w / 2) x half-width,
  enough only for a tile centred on the roll; an anchored, off-centre tile dipped to -0.05 tile sizes mid-motion).
  v1 tiles: same lift (exactly sin(pi w / 2) for the Strip preset, a little more for skewed tiles, 1 at t = 1).
- Verified: new `test/roll-anchor.test.js` (480 anchored folds: 4 groups x every preset's seed as the anchor x 30
  random seeds x amp 0/1): at t = 1 every point lands where the anchor's own closed map puts it (1.4e-15 tile sizes;
  Float32 vertices on a mirror 1.2e-7), seams 1.4e-15, at(0) exact, 200 steps max 0.058 tile sizes (max/mean 2.81),
  finite at the stops, lowest z -0.0000, 48 mirrored ** tiles exactly when they should be, continuity in the seed at
  t = 0.25/0.5/0.75 (a point moves at most 0.74 x the seed's step while the anchor's image is the same), no anchor /
  NaN / string / short anchor = v1 bit for bit, anchor = seed = v1 to 1e-12. `test/roll.test.js` (v1 path): 29 pass.
- Pictures (preview with the big comma): `qa/roll-round4/a1-{o,ss,sx,xx}-anchor-t1.png` (t = 1, six seeds of a drag:
  the surface and the comma stay, the seams slide), `a1-ss-mirrored-film.png` (a ** tile across a mirror turns over
  and closes onto the same tube), `a1-o-drag-film.png`.

### 00:50 — finding 28 (+ item 1), xx from the default view (src/folds/roll.js TUNE.klein; the judge's design kept)
- flat -1: while the 8 closes it turns a quarter turn about its crossing (smootherstep from a = 0.45 to the stop), so
  the stage-1 tube lies with its two lobes side by side, each half of the tile in its own lobe: two scrolls meeting
  along the dashed glide axis, the flat 8 visible at the near end. No needle (`x3-xx-stage1-{laptop,phone}.png`).
- phase 0.5 kept: the head end (+A/2) holds its 8, the curl end turns over by pi w. With flat -1 the 8 at the seam lies
  flat (the joined comma on the tops of both lobes); the closed bottle is v1's point for point, turned about the vertical.
- spin +1: the whole ring turns a quarter turn about the vertical through its centre during the ring stage, in
  proportion to it, so the seam closes IN FRONT: the two ends, the two halves of the comma, one end turning over, meet
  facing the camera (`x2-xx-spin1-closing.png`). Compared: the frame turned in the group data instead (glide axes
  horizontal, `x2-xx-turned-*.png`): stage 1 then seen from the side (two thin horizontal rolls), and it would have
  moved xx's seeds, URLs and the motif seam rule (a tie between the left and right edges) — not taken.
- The lift: the 8's support in the downward direction over the turns present along the tube (exact at t = 1: the
  lobe's half-length), so the lowest cross-section rests on the plane throughout.

### 00:55 — findings 44, 45, 46 (src/groupdata/roll.js)
- 44: ** turned a quarter turn: mirrors x = k w, translation (0, b), seed and centre (w/2, b/2) = (0.3, 0.6). The tube
  lies across the default view, rims at the sides, the comma on its front (`s1-ss-turned-*.png`); no lampshade.
  CONSEQUENCE: the comma table (src/groupdata/motif.js) entry of ** is stale until `node tools/motif-place.mjs` is run
  (test/motif.test.js 'the placement table is fresh' fails until then; motifFor shrinks the stale comma meanwhile).
  Regenerated in the preview tree: ** at (0.18, 0.04), angle 0.392, s 0.357, cover 27.8 %, inTile 44.5 %.
- 45: *x preset 1 'Skew' -> 'Trapezoid': same seed (0.8, 0.075), metric [1, 0, 8] (diagonal: invariant under the point
  group). Isosceles trapezoid, angles 126.9 / 53.1 degrees (Skew: 95.4 / 84.6), area 0.48. Its anchor's foot on the
  strip's centre line is the Strip's, so both presets close onto the same band (another cut moves only the seams).
- 46: captions: o 'torus; no cone points, no mirrors'; xx 'Klein bottle; non-orientable, no cone points, no mirrors';
  *x 'Möbius band; non-orientable, its rim is a mirror'; ** unchanged ('annulus; both rims are mirrors').

### 01:10 — xx timing redone to keep test/folds.test.js's generic bounds (step <= 0.025, second difference <= 0.0012)
- The port agent saw 'folds 3' and '3c' fail for xx at amp 1 (notes/fill.md 01:45): my first flat turn (smootherstep
  in the stage parameter a, a = 0.45 -> 1) swept the tile's far edge on a long chord: step 0.028, second difference
  0.0046 tile sizes (seed (0.713, 1.873), amp 1; measured with a script that applies the test's own measure to 2
  presets + 40 seeds x amp 0/1). The spin by a full quarter turn added 0.0012 at the stage junction (linear in w) or
  0.0278 steps (smoothstep in w).
- Now: the flat turn is a cosine ramp in TIME from t = 0.12 to 0.6 (62 degrees at the inner stop, flat from 0.6 on);
  the spin is 0.75 of a quarter turn, eased in over the first 30 % of the ring stage (the seam closes 22 degrees left
  of the front). Measured over 2 presets + 160 seeds x amp 0/1: largest step 0.0219, largest second difference 0.00107
  tile sizes (v1: 0.015, 0.0007; the bounds 0.025, 0.0012). No bound was touched.
- Films (live dev/app-demo.html, the ported big comma): `after-xx-p0-{default,stage1,stage1-phone,closing,closing-phone,
  side,back,amp1}.png`, `after-xx-p1-default.png`, `after-xx-drag-default.png`, `after-xx-anchor-t1.png`. Stage 1: the
  narrowest frame (t about 0.3) is twice the old needle's width and brief; two scrolls from t = 0.37. Closing: the head
  end's flat 8 faces the camera, the other end turns over, they meet at the front-left, on the phone too.

### 01:13 — test/klein.test.js rewritten to the new contract (the port changed the comma; my turns changed the 8)
- Kept, renamed: invariance + seams at t = 1; identity, continuity, finite, above the plane.
- Replaced: 'xx glyph: straddles ...' / 'only xx has a seam glyph; every other group keeps its v1 placement' /
  'motifTintMesh (xx)' -> one test of what the fold relies on (only xx straddles a seam; one piece on the glide-sewn
  edge at +A/2, the other on its partner; the comma's centre beyond +A/2, so the head rides on the end that holds).
  The placement, size, gap and the 3D fill of every group's comma are test/motif.test.js's now (the port's file).
- 'before the ring stage it is v1 exactly; at t = 1 v1's bottle turned half way' -> 'until the 8 starts to lie down it
  is v1 exactly (bit for bit); at t = 1 it is v1's bottle turned about the vertical by the spin (point for point)'.
- 'the end at +A/2 holds its 8 upright' -> 'the 8 lies down while it closes (the +A/2 end at |rho(t)| from upright,
  flat from flatTo on; 62 degrees at the inner stop); the end at -A/2 is turned by pi w relative to it' (angles mod pi:
  a quarter period from an odd glide axis is the lower lobe).
- 'xx scene (app.js)': no longer 'no other group has a tinted mesh' / ghost = MOTIF_FILL_3D (every group is filled now,
  in the renderer's `fill`): draws fold.mesh with the comma cut in, flat at t = 0, seams and the comma's pieces meet.
- 7 / 7 pass; with roll, roll-anchor, folds and motif: 87 / 87 (remote, 01:14).

### 01:16 — finding 27, the comma's side (checked against the ported table, src/groupdata/motif.js)
- `node dev/roll4/commaview.mjs` (z-buffer of the closed shape along the default view, 360 x 360): share of the comma
  that is the front layer / share of the picture that is comma: o 42 % / 24 % (the comma, 0.46 across, wraps the tube,
  centred over the top near the last seam: the old complaint, the comma on the bottom circle, is gone with the table's
  placement); ** 93 % / 48 % (turned: the whole comma on the tube's front); *x 100 % / 20 % (Strip and Trapezoid);
  xx 54 % / 22 % (two lobes wide, it wraps the 8-tube; in front). Torus spin -1 / 0 / +1 and side -1 change o by at most
  4 points (46 / 42 / 40 / 40 %): nothing to gain, the torus is left as it was.
- The table is the port's and still moving: at 01:04 it held o and ** whole in the default tile (the comma then lands on
  the torus's lower outer front and on the tube's front: both in the front layer, `after-o-p0-phone.png`,
  `after-ss-live-stale-table.png`); the file of 01:07 has the judge's places again (o (0.031, 0.052), ** (0.18, 0.04)),
  which the numbers above are for. Either way each comma faces the default camera.

### 01:18 — item 5: the header of src/folds/roll.js
- THE ANCHOR (the construction, M_t, the page turn, t = 1, v1), the klein paragraph (flat, phase, spin, the lift),
  the comma's side with the measured shares, Exports (fold.anchor, anchorImage, mirrored, opts.tune), TUNE comments.

### 01:20 — the whole suite (node tools/test-all.mjs, remote): 681 tests, 679 pass, 0 fail, 2 skipped (opt-in).
- test/folds.test.js drag walk (one anchor, the cut wandering over mirrors, centres, creases and waves): the folded
  shape at t = 1 now stays put for the rolls: torus 0.00028, cylinder 0.000089, klein 0.00044, mobius 0.00015 tile
  sizes (the frame of a differently sampled surface).

## Requests (files I do not own) — none blocking
- core (test/mesh.test.js BROKEN 'slit' '**' [1.6181752597913146, 0.9288813577964901] amp 1, and the same seed in
  test/verify-topology.test.js SLIT_SEEDS): with ** turned a quarter turn (mirrors x = k w now) these pinned seeds no
  longer reproduce the configuration they were found in (they still pass). If the regression should stay pinned:
  re-find it with the sweep that found it (VR_WAVY / the topology sweep) in the new frame; the preset-based ** case
  (verify-robust: preset 0, amp 0.99) moved with the data and still pins its configuration.
- ui-app (none needed): xx's spin and flat turn are inside the fold; the app passes opts.anchor already, fold.mirrored
  (** across a mirror) is honoured by surfaceStyle; URLs made before today with a ** seed (#g=%2A%2A&seed=...) now name
  another point of the turned strip.

## Fix-up after the round-4 verification (qa/verify-rolls/r4, findings 1-5) — Tue 10 Nov 2026, the roll fix-up agent

Scratch: `dev/roll5/` (backups `*.before-fixup.js` of my four files as the verifier saw them; probe and film scripts).
Pictures: `qa/roll5/`. Baseline before any change (remote): roll, klein, roll-anchor 45 / 45 pass.

### Plan (written before the change)
- Finding 1 (major, the whirl): xx and *x pull back by orientation-reversing elements too, without a page turn: the
  pull-back is a translation v (nearest in the periods of the shape: A along and b across for xx; T along for *x,
  the strip offset across), and when tau_v is not in G the reflection is done by an extra half turn of the
  cross-section (xx: the 8 about its crossing, grown with the ring like the phase, so the OTHER end holds; *x: the
  band's segment about its centre line, in the first half, a page turn over the mirror for an adjacent strip).
  Slides then stay within half a period. The torus: round the lattice coordinates (both slides <= half a turn) and
  slide round the tube with the ring, not with stage 1, so the stage-1 tube closes on top (SPEC 5.3).
- Finding 2: a smaller spin for xx (seam 45-60 degrees from the front), chosen from films; header wording fixed.
- Finding 3: the *x mirror crossing becomes continuous once the flip is done (t >= 0.5), xx's crossings of the glide
  axes become continuous at every t (the 8's phase is absolute: no slide across, a rigid travel); what remains is
  documented (request for SPEC 7).
- Finding 4: fold.mirroredAt(t) (0 -> 1 across the edge-on moment of the page turn); app.js must use it (request).
- Finding 5: test/roll-drag.test.js (new): anchored folds for dragged cuts, per-type step and second-difference
  bounds, the whirl bound, the switch continuity, the stage-1 seam on top, mirroredAt.

### Finding 1 (the whirl) — fixed (src/folds/roll.js: pullBy, torusFold, mobiusFold, kleinFold; header THE ANCHOR)
- xx: v = k b across + m A along (rounded); m odd = a glide image of the anchor: the 8 turns a further half turn with
  the ring AGAINST the phase (beta = -pi w), so the other end holds and its partner turns over (the glide's s -> -s is
  the 8's half turn about its crossing; at t = 1, R_{1, beta = -pi}(x - v) = Phi_a(g^-1 x) exactly). No page turn.
  Across nothing slides (the 8's phase tau is the material's own): the centre stays on p - v and the shape travels
  across rigidly at constant speed (o_s = v_s + t (a - p)_s).
- *x: v = j T along (rounded) + the strip offset across; tau_v not in G (j - k odd: a glide or a mirror image) -> the
  band's segment turns over about its centre line (beta = +-pi f, f = smootherstep over the first flap = 0.6), the
  tile crossing to the anchor's strip meanwhile ((1 - f) v_across; for a neighbouring strip this is a page turn over the
  mirror between them). No colour swap (one-sided band; F_1 = Phi_a on D whatever g is).
- o: v rounds the lattice coordinates of p - a (both slides <= half a turn at t = 1 and on the way: the slide round the
  tube is k1 w (alpha L + (1 - w) beta s) <= pi); the slides and the travel go with the ring (w), so stage 1 is v1's
  tube at the seed, closing ON TOP (the verifier's "o, cut dragged half a period across: the stage-1 seam closes
  underneath" is gone: qa/roll5/drag-o-across-1280.png).
- The verifier's whirl script (dev/verify-rolls-r4-whirl.mjs, 1500 seeds): *x 181 median / 360 max -> 115 / 180;
  xx 144 / 286 -> 106 / 180; o ring 102 / 186 -> 102 / 180; ** unchanged (104 / 180). Its "roll / 8 slide" of o reads
  224 max now: it projects on e1 without the shear; the true slide round the tube is 2 pi alpha, |alpha| <= 1/2.
- Smoothness of the new turns: the lift had a kink where the range of turns of the band (the 8) passes a flat one and
  the end that rests on the plane changes while the segment turns fast: *x second differences 0.0101, xx 0.0057 tile
  sizes per 1/200. Rounded (liftShare / liftFor eps, only while an anchored tile flips; checked: the 8's support is
  monotone from upright to flat for every stage, dev/roll5/support-check.mjs; never lower than exact; exact at t = 1):
  *x 0.0016 (flap 0.6), xx 0.0031. Old anchored: *x 0.0035, xx 0.0058. dev/roll5/probe.mjs, sweep.mjs.
- Films (live dev/app-demo.html, the ported big comma): qa/roll5/drag-sx-nextstrip-{1280,390}.png (the band turns
  over early, then curls toward the viewer and closes in front like the preset: no spin), drag-sx-glide-1280.png,
  drag-sx-farstrip-1280.png, drag-xx-along-{1280,390}.png (the gap stays at the left and closes front-left),
  drag-o-e2-1280.png, drag-o-across-1280.png.

### Finding 2 (xx spin) — fixed: TUNE.klein.spin 0.75 -> 0.5 (the seam 45 degrees from the front)
- qa/roll5/spin{075,050,033}-xx-p0{,-closing}.png, spin{050,033}-xx-p0-closing-390.png. Face-on share |n.v| of the
  turning end (dev/roll5/ends.mjs, the verifier's measure) at t 0.85 / 0.9 / 0.95 / 0.98 / 1: 0.75: 0.04 0.05 0.14 0.19
  0.22; 0.5: 0.12 0.22 0.32 0.37 0.41; 1/3: 0.22 0.33 0.42 0.47 0.50. 0.5 keeps the closing on the near side with the
  comma's two parts facing the camera; the joined 8 reads as an 8. Header: 'meet facing the camera' rewritten.
  test/klein.test.js: the spin now asserted in [30, 60] degrees (it asserted (45, 90]).

### Finding 3 (switch jumps) — reduced where something could be done; the rest documented
- dev/roll5/switch.mjs (seed walks across the window, steps of 0.004 tile sizes; jumps in tile sizes, new / old):
  *x mirror crossings at t 0.25 / 0.5 / 0.75: 0.32 / 0.046 / 0.001 (old 0.66 / 1.24 / 1.16); xx across the glide axes
  0.002 at every t (old 0.205 at t 0.25: what is left is the ordinary step); o and xx image switches in stage 1:
  0.003 / 0 (old o 0.32); ** mirror crossings beyond the neighbouring strips: 0 from t = 0.5 (old 0.71 at 0.5, 0.35
  at 0.75) — its way back across the mirrors now goes with the page turn ((1 - f) v_across), along with the roll.
- Remaining (inherent with a bounded slide): the slide changes sides at the switch (+-180 degrees): o 0.13 / 0.89 at
  t 0.5 / 0.75; xx along 0.21 / 0.90; *x 1.17 / 1.12 (old 1.77 / 0.53 for its two); ** 0.64 / 0.59 (unchanged).
  Request to the orchestrator: SPEC 7 to say so next to the hinge's exception (see Requests).

### Finding 4 (** colour at t = 0) — the fold side done; needs ui-app (src/app.js)
- New fold.mirroredAt(t) (cylinder only): the share by which front and back are to be swapped at t: 0 until the page
  turn nears edge-on, 1 after it (a smooth cross-fade over phi 0.6 pi -> 0.4 pi, t 0.2 -> 0.3); 0 throughout for a tile
  that does not turn over. fold.mirrored is kept (true for such a tile): the app reads it once per rebuild and swaps
  the whole fold, so a flat mirrored tile is pale until the app changes (qa/roll5/colour-ss-mirrored-now.png).
- The requested change (applied in a preview copy only, then removed): dev/roll5/request-app-mirroredAt.diff —
  surfaceStyle(fold, t) blends SURFACE_FRONT / SURFACE_BACK by fold.mirroredAt(t) (falls back to fold.mirrored), set
  per drawn frame in drawFold like the ghost colour, not per rebuild. Films with it: qa/roll5/colour-ss-mirrored-
  request.png (teal from the default view all through: the swap happens while the page is edge-on to it),
  colour-ss-mirrored-request-az80.png (seen face-on from the side, a gradual change over t 0.2 - 0.3, no sudden flip),
  colour-ss-preset-request.png (an unmirrored tile: unchanged).
- *x and xx swap nothing: their closed shapes are one-sided and F_1 = Phi_a on the tile whatever g is, so their
  colours at t = 1 depend on the tile alone (a cut dragged across a mirror of *x turns the band's colours over at
  t = 1, as before and as in v1: the tile itself jumps to its mirror image there).

### Finding 5 (anchored smoothness unguarded) — test/roll-drag.test.js (new, 11 tests)
- drag 1: the slide <= half a turn for 400 seeds per group (from fold.anchorImage and params; o by lattice coordinates);
  params.flip exactly when tau_v is not in G; *x rolls onto a copy in the seed's strip.
- drag 2 (per group): the verifier's filmed cuts + 10 window seeds, amp 0 and 1, the 1/200 measures of folds.test.js:
  bounds o 0.058 / 0.0036, ** 0.06 / 0.0047, *x 0.053 / 0.002, xx 0.055 / 0.0036 tile sizes (step / second
  difference; measured 0.045 / 0.0026, 0.049 / 0.0032, 0.040 / 0.0014, 0.041 / 0.0030), finite, z >= 0.
- drag 3a-c: xx across a glide axis changes nothing at any t (< 1e-6), along nothing in stage 1; o nothing in stage 1;
  *x and ** across any mirror (neighbouring and farther strips) identical once the turn over is done (1e-9), and
  different before it (the test sees the crossing). It caught that *x's rounded lift lingered after its flip (0.0094
  between the two sides): eps now goes with the turn's speed (16 x^2 (1 - x)^2), nothing left at t = flap.
- drag 4: o's stage-1 seam lies above the tube's axis at the inner stop for every dragged seed (> 1 tube radius).
- drag 5: mirroredAt: monotone in [0, 1], 0 before t = 0.2, 1 after 0.3, the page's normal horizontal where it is 1/2,
  0 throughout for unmirrored tiles; o, *x, xx swap nothing.
- Remote, with roll, klein, roll-anchor, folds: 85 / 85.

### Whole suite (node tools/test-all.mjs, the mini): 697 tests, 694 pass, 2 skipped; 1 fail: test/mesh.test.js
  'a draft mesh ... costs well under the full one' (a CPU-time ratio, the core's file, does not load roll.js); alone it
  passes (worst ratio 0.64 < 0.8): load on the mini while the suite ran.

## Requests (files I do not own)
- ui-app, src/app.js (finding 4): apply dev/roll5/request-app-mirroredAt.diff — surfaceStyle(fold, t) blends the
  surface colours by fold.mirroredAt(t) (fall back to fold.mirrored === true), called from drawFold after mapScene on
  every drawn frame (set only when the colour changes), and no longer from rebuild(). getState().mirrored can stay the
  boolean. A test in test/folds.test.js: ** preset 0 with the seed (0.9, 0.62): surfaceStyle(fold, 0).front ==
  SURFACE_FRONT, surfaceStyle(fold, 1).front == SURFACE_BACK; an unmirrored tile SURFACE_FRONT at both.
- orchestrator, SPEC.md section 7 (anchor contract), next to the hinge exception (finding 3): "For the rolls (o, **, *x,
  xx; src/folds/roll.js THE ANCHOR) F_t is continuous in the seed except where the copy of the anchor the tile is
  rolled onto (fold.anchorImage) changes while a slide is under way: the sheet slides round the shape by at most half a
  turn (o, xx, *x along the ring; o, ** round the tube), and a seed half a turn from the anchor either way switches
  sides. Where nothing slides a drag changes nothing: o and xx in stage 1, xx across a glide axis, *x and ** across any
  mirror once the turn over is done (t >= 0.6 and 0.5)." And section 8 C3: "A fold may also expose fold.mirroredAt(t)
  in [0, 1]; the app then swaps (blends) front and back by it at every drawn t."
- No change to src/groupdata/roll.js data (only a comment): the comma placement table stays fresh.

### Final (fix-up): node tools/test-all.mjs on the mini — 697 tests, 695 pass, 0 fail, 2 skipped (opt-in).
- Not done / left open: the app's colour swap by mirroredAt (ui-app's file; the request above), SPEC 7 / 8 wording (the
  orchestrator). The ** page turn is unchanged (its speed: steps 0.049, second differences 0.0039 tile sizes per 1/200
  for a mirrored tile, bounded by test/roll-drag.test.js; a longer turn would halve the second differences if wanted).
  A cut dragged far outside the window still travels back to the anchor rigidly (the contract), in proportion to the
  distance. Scratch dev/roll5/ (probes, films, the diff for ui-app) may go once round 4 is integrated.
