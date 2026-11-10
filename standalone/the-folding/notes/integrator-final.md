# Final integration — Tue 10 Nov 2026 (the final integrator)

Read: SPEC.md (§§ 1–9), notes/integrator.md, every notes/*-round3.md, notes/fill.md, notes/roll-round4.md, notes/klein.md.
Baseline before any change (remote, the mini): 697 tests, 695 pass, 0 fail, 2 skipped; the comma table up to date.

## 1. What was applied (every file touched)

| change | files |
|---|---|
| **mirroredAt** (dev/roll5/request-app-mirroredAt.diff; SPEC 9 C3 addition). New `surfaceMix(fold, t)`: `fold.mirroredAt(t)` when the fold has it, else 1 for `fold.mirrored === true`, else 0 (non-numbers count as 0). `surfaceStyle(fold, t = 1)` blends front and back by it, exact at 0 and 1 (`a·(1−m) + b·m`, not the diff's `a + (b−a)·m`, so `deepEqual` with the palette arrays holds). Set per drawn frame in `drawFold` (only when the colour changes), no longer in `rebuild()`. `getState()` adds `surfaceMix`. | `src/app.js` |
| its test: ** preset 0, seed (0.9, 0.62): front at t = 0, swapped at t = 1, unmirrored tile front at 0 / 0.5 / 1; the blend monotone, at most a quarter of the swap per 1/200, spread over ≥ 6 steps; 22* across its mirror (no mirroredAt) swapped at every t; malformed folds swap nothing | `test/folds.test.js` |
| **draft mesh during drags** (notes/core-round3.md #12). `buildScene(…, { draft })`: `buildMesh(…, { ...foldMeshOptions(group), draft })`, and `foldOptions({ anchor, density: false })` so a roll fold keeps the draft; ignored for the kaleidoscopes; `scene.draft`. `rebuild({ draft })`; `onSeed`: 'move' → draft, 'end' → the full mesh for the same cut (only if the scene is a draft), then the hash; Wavy: `input` → draft, `change` → full (also when the value did not change since the last draft frame; a pending input frame is cancelled). `__folding.setSeed / setAmp` still build the full mesh. `getState().draft`. | `src/app.js` |
| its test: every non-kaleidoscope group × preset 0 + 3 random seeds × amp 0/1: draft < 75 % of the triangles (measured 47–57 %), the same boundary samples, comma filled, seams closed at t = 1, and the outline at t = 0.25/0.5/0.75/1 within 1e-3 tile sizes of the full mesh's (measured: 0 for the rolls and most hinge groups, 1.6e-7 hinge, 9.3e-5 for 22x) | `test/folds.test.js` |
| **cross-cap crease fade, fold-relative** (notes/crosscap-round3.md). `creaseFade(type, fold)`: for the cross-cap `[0.5·fold.times.hingeEnd, fold.times.halfEnd]` (Pocket / Hexagon [0.21, 0.49], Bowl [0.085, 0.22]); other folds and a cross-cap without usable times keep CREASE_FADE. `creaseAlpha(type, t, fold)`; `sceneLines` passes the fold. | `src/app.js` |
| its test: every 22x preset × 7 seeds (drags keep the anchor) × amp 0/1: the window is exactly that, the same for every seed of an anchor, alpha 1 → 0, monotone, < 0.06 per 1/200, no crease line at the middle stop; Bowl fades early; other folds unchanged | `test/folds.test.js` |
| **the pinned ** slit seed re-pinned** (notes/roll-round4.md). The quarter turn of ** (mirrors y = k w → x = k w) is carried by (x, y) → (y, x); the seed is mapped by it: (1.6181752597913146, 0.9288813577964901) → (0.9288813577964901, 1.6181752597913146). See "not done" below for why it could not be RE-FOUND. | `test/mesh.test.js` (BROKEN), `test/verify-topology.test.js` (SLIT_SEEDS) |
| **442 plump 0.62 → 0.75** (the reviewer's value; hinge-round3's request). The whole suite stays green under the amended label rule: 4 of 240 labels touch the comma's thin outline (442 az 40 el 30 laptop + phone, 2222 az 120 el 20 laptop + phone; the rule allows 6), every other line clear. Closed 442 pillow thicker (the hinge test's 0.25–0.45 band holds). Comment of TUNING rewritten. | `src/folds/hinge.js` |
| **comma table regenerated** (`node tools/motif-place.mjs`, then `--check`: up to date). Only 442 changed (its closed shape changed): view key 866d3fc7 → 9d0b7fbf, centre (0.1777, 0.2124) → (0.1790, 0.2125), angle 0.098 → 0.118, seen at t = 1 48.9 → 49.9 %. | `src/groupdata/motif.js` |
| build | `dist/index.html` |
| QA scripts (new): `dev/final/qa-final.mjs` (sheets, films, pop profile, fine films, `--plant` control), `dev/final/draft-check.mjs` (real drags), `dev/final/steps-looks.json`, `dev/final/steps-plantdebug.json`; `dev/check3-idle.mjs` takes `IDLE_PAGE=dist/index.html` (one line) | `dev/` |

Checked and found already done (no change): crosscap-round3's `specialTimes` + `fold.times` and the line-20 comment of
test/folds.test.js; ui-layout's touch-session check in tools/qa-matrix.mjs; snowflake's x-ray request
(KALEIDO_EDGE_XRAY); klein R1/R2; the hinge C3 anchor; ui-picker's idle-frame observation (the built page now draws
0 frames after a play ends: `IDLE_PAGE=dist/index.html node dev/check3-idle.mjs`).

## 2. Verification

- `node tools/test-all.mjs` (the mini, 5 workers), final: **700 tests, 698 pass, 0 fail, 2 skipped** (opt-in:
  SHELL_LAYOUT, VERIFY_TOPOLOGY_DUMP). `SHELL_LAYOUT=1 SHELL_LAYOUT_PAGE=dist/index.html node --test
  test/shell-layout.test.js`: pass (23 window sizes × 17 groups on the built page).
- `node build.mjs`: **dist/index.html = 269,951 bytes** (263.6 kB; JS 246.7 kB, CSS 12.8 kB, shell 4.2 kB; 104.1 kB
  gzipped); self-contained, one inline script, no URL but the companion link. Rebuilt after the last (comment) edit:
  byte-identical (sha256 8fd463d0…).
- `node tools/qa-matrix.mjs --interact --out qa/final/matrix` (built page): 113 pictures, **70 / 70 interaction checks,
  0 console errors, 0 page errors, 0 problems**; seams at t = 1 ≤ 1.8e-8 tile sizes; markers at t = 1 = the orbifold's
  name for all 17. Covers: picker by mouse and touch, the view kept while playing / scrubbing / across presets, groups,
  waves; the play smooth (largest step 0.005 of t per frame); the scrubber continuous with a slight magnet (slowest step
  0.44 mouse steps, never sticks); the frame session; touch.
- `node dev/ui3-url-loop.mjs --page dist --out qa/final/url` (the built page inside dev/app-frame.html, real clicks and
  drags → the host's address → a fresh page): **all checks pass** — every parameter in the address
  (`#g=4%2A2&cut=1&seed=0.3272/0.4745&wavy=0.65&t=0.566&view=-46.1/12.3/1.33/-28.4`), the fresh page has the same group,
  cut, anchor, seed, wavy, t, view, every vertex within 1.2e-4 and the orientation within 0.023°; pasted links, legacy
  `#333 #4*2 #*632 #s632 #%2A2222`, `#nonsense`, a malformed value, the write throttle, no history growth.
- `node dev/final/draft-check.mjs`: 19 / 19 — real mouse drags of xx, 2222, 22x, o: a draft while dragging (42–54 % of
  the preset's triangles), the full mesh for the same seed on release, the fold pane changes by 0.4–1.0 of 255 on average;
  the Wavy slider likewise.
- Contact sheets (`node dev/final/qa-final.mjs --only sheets`), filmstrips (`--only films`), pop profile (`--only pops`)
  — all through dist/index.html, 0 console errors. LOOKED AT: all six sheets and all 17 films.
- Pop profile: every group's default cut stepped in 1/120: no step of the fold pane changes more than 2.2× its
  neighbours. The colour series (2nd difference of the mean colour) flags only edge-on moments of a flap (333 t 0.342;
  ∗333 0.542, 0.842; ∗442 0.225; ∗632 0.175, 0.458); the fine films `qa/final/fine-*.png` show a sheet thinning to a line
  and back — continuous, no colour pop. Control (`--plant`): a front/back swap planted at t = 0.5 is caught for 333 and
  o, missed for xx and ∗632 (it changes the pane by only ~1.7 grey levels): the films are the real check.

## 3. qa/final

`sheet-{laptop,phone}-{fold1,fold0,plane0}.png` (17 groups each; single panes in `panes/`), `film-<id>.png` (17, 's'
for '*'), `matrix/` (the qa-matrix run + report.json), `url/` (loop-original / loop-restored / legacy), `look-*.png`
(442 az 40 el 30, 2222 and 632 az 120 el 20, ** across a mirror at t 0 / 0.25 / 1 vs the preset, 22* across its mirror
at t 0 / 0.5, 22x Bowl t 0.12), `fine-*.png` (edge-on moments), `draft-xx-released.png`, `qa-final.json` (states, pop
profiles), `control/` (the planted-pop run).

## 4. Not done, and why

- **The ** slit could not be re-found** in the turned frame. The pre-fix mesh no longer exists in the workspace, so it
  was rebuilt from notes/core.md (one clipping pass by the edges the three corners are outside of; also with the
  halving of long crossed edges taken out): 2550 random tiles of all groups and 4000 tiles of the turned ** at amp 1
  (y0 over two periods) gave **no T-junction at all** — with round 3's gentler wave and the later mesh fixes the slit
  does not occur even without its fix. So the seed was mapped by the quarter turn (the same place of the strip) and
  the comments say plainly that it now checks a place, not the old configuration (as the other amp-1 seeds of that
  list do since round 3 chose new waves). Nothing was removed; no check weakened.
- Nothing requested was skipped. No test was weakened; the only edited assertions are the pinned seed (above).

## 5. Defects I still see (built page)

1. **22*, 2*22, 3*3, 4*2 — a cut dragged across a mirror of the group shows the flat tile pale** (all sizes, t = 0, and
   swapped at every t): the hinge fold has no `mirroredAt`, so SPEC 9's fallback swaps the colours at every t. At
   t = 0 the 3D tile is SURFACE_BACK while the plane shows it teal, and dragging across that mirror at t = 0 turns it from
   teal to pale at once (`qa/final/look-22s-across-t0.png`). Fix (hinge owner): `fold.mirroredAt(t)` in hinge.js as in
   roll.js — 0 → 1 while the root piece is edge-on (θ ≈ π/2 for a walk of one crease).
2. **442 at az 40 el 30 and 2222 at az 120 el 20 (laptop and phone, t = 1): the "2" label lies on the comma's thin
   outline** (no clean spot; legible through the white halo: `look-442-az40-el30.png`, `look-2222-az120-el20.png`).
   Within the amended rule (4 of 240).
3. **Kaleidoscopes at t = 1 (all sizes):** the stack of 2n sheets shows as a thin teal sliver along one side of the tile
   (∗632, ∗442: the lower edge in `sheet-laptop-fold1.png`), the layer spacing. Known since v1.
4. **∗x (all sizes, t = 1):** the emptiest shape — its comma covers 21 % of the tile (FILL_RCAP binds on the 0.3-wide
   strip; notes/fill.md), 27–29 % of the band's pixels at t = 1.
5. **Rolls, a cut dragged far from the anchor at 0 < t < 1:** where the copy of the anchor the tile is rolled onto
   changes, the sheet switches sides (at t 0.5 / 0.75: o 0.13 / 0.89, xx 0.21 / 0.90, ∗x 1.17 / 1.12, ** 0.64 / 0.59 tile
   sizes; notes/roll-round4.md) — SPEC 9 allows it;
   hinge folds hop likewise when the walk sweeps a rotation centre (SPEC 7). At t = 0 and t = 1 nothing jumps.
6. **Edge-on flaps** (333 t ≈ 0.34, ∗632 t ≈ 0.175, ∗442 t ≈ 0.225 from the default view): a flap and its comma thin to
   a line for a frame. Physical, continuous; listed because a viewer may read it as a flicker at 60 fps.
7. Not verified here: Safari, Firefox, a real phone, a real GPU (Chrome headless on the mini, SwiftShader); the live
   spacesheep address bar (no deploy allowed; the stand-in `dev/app-frame.html` passed). Only the default cut of each
   group was filmed (other cuts are covered by the tests and qa-matrix's folded shots only).

## 6. Final fix (the final fixer, Tue 10 Nov 2026) — the three verifiers' findings

Baseline (remote, the mini): 700 tests, 698 pass, 0 fail, 2 skipped. Final: **705 tests, 703 pass, 0 fail, 2 skipped**
(`qa/final-fix/tests-3.log`). Findings numbered as in the fixer's brief (1 = the *x colour flip, …, 16 = stale comments).

| # | what was wrong (cause) | fix | files | test |
|---|---|---|---|---|
| 1 | *x: crossing a mirror flipped the band's colour (no mirrored / mirroredAt). Probe (`dev/final-fix/sx-colour-probe.mjs`): across a mirror the band lands on the same places with every normal reversed; a slide switch along the strip changes nothing at t = 1, so the swap must follow the STRIP parity, not `params.flip` | `fold.mirrored` = odd number of mirrors from the anchor's strip; `mirroredAt(t)`: a tile whose segment turns over swaps where that segment is edge-on from the default camera (0.08 of t); one that only slides across fades with its slide over the flap; 1 from t = flap on | `src/folds/roll.js` | roll-drag 'drag 5b' (displayed side equal at matching points across a mirror, t = 0.6 / 0.8 / 1; edge-on at the half swap), roll-anchor 5 (now: ** and *x), folds 'surface colours' (*x, ** added) |
| 2–4 | hinge 22*, 2*22, 3*3, 4*2: no mirroredAt, so the app swapped at every t (the flat tile pale after a drag across a mirror); and the mirror turned with the creases until FOLD_END, so the half-folded shape jumped at the crossing | **page turn**: in the anchor frame each mirror of the walk turns by φ = `pageTurn(t)` (θ's ramp in PAGE_END = 0.5); the drag across a mirror then changes nothing from t = 0.5 on (it was 0.8). `mirroredAt` via `swapWindow`: centred where the fixed piece turns away from the default camera (VIEW0), always inside (0, PAGE_END]. The mirrored tile dips less below the plane than before (4*2 0.72 vs 0.86 tile sizes) but turns faster (largest step 0.074 vs 0.059 per 1/200) | `src/folds/hinge.js` | hinge 'anchor (SPEC 7) 2b' (188 drag pairs: shapes agree to 2e-14 from PAGE_END; every swap at an edge-on moment); anchor 1's structure check now `frame(θ, φ)`, PAGE_END among the inner times; folds 'surface colours' — the 22* assertion that pinned the pop replaced by front at 0 / swapped at 1 / blended for 22*, 2*22, 3*3, 4*2 |
| 5 | phones: the plane always showed 2 viewHalf, so a 148 px pane gave 19 px thin tiles | small panes zoom in: a tile takes at least `zoomShare(m)` of the short side (0.3 up to 240 px, fading out by 400 px; continuous); never for the kaleidoscopes; the leash is half the window (identical without zoom). Thinnest tile at 375 x 548: 632, 3*3 19 → 34 px, 2*22 19 → 27, 4*2 24 → 44, 333 34 → 41; at 390 x 780: 37–67 px (was 28–29); laptop unchanged; *x stays 19 px (its strip would overflow) | `src/plane.js` | plane 'a small pane zooms in …' (continuity, laptop unchanged, every preset tile inside a 148 px window); 'window' asserts planeScale |
| 8 | rim farther than 1 % from the boundary (drafts to 1.56 %, a full 632 mesh 1.06 %): a chord across a large triangle; at a tile corner the corner of two long chords stuck out | in the clipping, a chord on a cut edge farther than RIM_SAG = 0.25 % from the boundary's own point gets that point (warp of the straight midpoint on the line; 4 levels), then ear clipping; a corner of two chords is replaced by the true corner when it lies in the fine triangle; polygons without such a chord keep their fan (bit for bit). 3,900 wavy tiles (salts 0–9): drafts ≤ 0.34 %, full ≤ 0.35 % | `src/mesh.js` | mesh 'the rim follows a wavy boundary within 0.6 %' (the verifier's 6 cuts pinned + salt 11); CORE_SALT 11 and 7 green (mesh + verify-*, VERIFY_SEEDS 40); the draft-cost timing now interleaves full and draft builds, 9 each (it flaked once at 1.29 for a 0.6 ms kaleidoscope; bound unchanged) |
| 9 | motifTintMesh left a triangle whole (mixed tint): an outline vertex exactly on a mesh edge coincides with the crossing there, the part has a side of no length and every ear is blocked | coincident neighbours in a part are merged (keeping the crossing or a corner) | `src/motif.js` | motif 'an outline point lying exactly on a mesh edge …' (the 3 cuts, which fail with the old code); 600-step walk: 0 problems in 10,200 scenes |
| 10 | test-all dropped ANCHOR_SEEDS / VR_*; an early exit of run_remote crashed it with EPIPE | knobs = every process.env.NAME in test/*.js (+ the old prefixes, minus the machinery); errors on the pipe ignored so the exit code leads to the fallback; FOLDING_RUN_REMOTE for a stand-in | `tools/test-all.mjs` | `dev/final-fix/fake-run-remote.sh`: without the handlers 'write EPIPE', exit 1; with them the fallback runs |
| 14, 16 | stale comments | the MAX_BEND table re-measured (FOLDS_SEEDS 60; crosscap and klein sit 5 % and 8 % under their bounds, bounds kept); the drift diagnostic and the 2 → 4 labels comment | `test/folds.test.js`, `test/render3d.test.js` | — |

SPEC § 9 has the four contract changes (page turn, mirroredAt, plane zoom, rim chords).

**Verification (built page)**: `node build.mjs` → dist/index.html **274,320 bytes** (105.8 kB gzipped; sha256 bd72486f…),
one inline script, no URL but the companion link. `node tools/qa-matrix.mjs --interact --out qa/final-fix/matrix`: 113
pictures, **70 / 70** checks, 0 console / page errors, 0 problems. URL loop (`dev/ui3-url-loop.mjs --page dist`):
all pass (`qa/final-fix/url.log`). `SHELL_LAYOUT=1 … dist`: pass. The owner-asks verifier's mirror drag on the built
page (`dev/final-fix/verify-mirror.mjs`, same method): **18 / 18**; largest one-step colour change at the crossing
22* 1.4, 2*22 3.1, 3*3 1.4, 4*2 4.6 at t = 0 (was 27–29: what is left is the tile itself flipping over the mirror, as
in the plane), 0.02–0.04 at t = 0.5 (was up to 13), ≤ 0.33 at t = 1; *x 4.9 at t = 0.5 (was 19.1), 0.05 at t = 1
(was 22.9). The 1 px crossing sheet: 22* t = 0.5 pane change 0.0 (was 12.0). Wide runs: FOLDS_WALK=600 FOLDS_SEEDS=60
ANCHOR_SEEDS=40 over folds / hinge / roll-anchor / roll-drag / crosscap: 120 / 120.
LOOKED AT: `qa/final-fix/qa/sheet-{laptop,phone}-fold1.png` (17 shapes, as before), `sheet-phone-plane0.png` (the
zoomed phone planes), films of the default cuts `qa/final-fix/qa/film-{22s,2s22,3s3,4s2,sx}.png` (unchanged), the
mirrored cuts `qa/final-fix/verify/mirror-film-{22s,4s2,sx}.png`, `qa/final-fix/film-{2s22,3s3}-mirrored.png` (teal when
flat, the page passes edge-on near t = 0.1 while the colours swap, from t ≈ 0.45 the regular fold), the wavy 632 cut
`qa/final-fix/film-632-wavy.png`, the phone planes `qa/final-fix/phone/*.png`.

**Not done**: #6 and #11 (rolls: the sheet switches sides when the anchor image changes mid-drag; SPEC 9 allows it,
kept as documented); #7 (*x 21 %, xx 19.5 % of the tile: the judge's FILL_RCAP on a 0.3-wide strip and the two-lobe
seam comma; a looser cap would re-key the whole placement table — for the owner to decide; by pixels the *x band is
26 % comma, like 3*3 and the kaleidoscopes); #12 scrubber magnets, #13 xx's default view at t = 1, #15 the ** slit
seed (polish: not cheap or not safe).

**Still visible in the shipped build** (built page, Chrome headless on the mini or this Mac):
1. Kaleidoscopes at t = 1: the stack of 2n sheets shows as a thin teal sliver along one side of the tile (layer spacing; since v1).
2. *x and xx: the comma covers 21 % and 19.5 % of the tile (13 groups 30 %); the band 26 % of its pixels at t = 1.
3. Rolls, a cut dragged far at 0 < t < 1: the sheet switches sides where the anchor image changes (xx's tube at
   t = 0.75 swings in one frame; o, **, *x, xx; SPEC 9 allows it). Hinge folds hop when the walk sweeps a rotation
   centre (SPEC 7), and across a mirror before t = 0.5 the shape still jumps (inherent: at t = 0 the tile itself flips
   over the mirror); from t = 0.5 on nothing moves.
4. A mirrored tile's colour swap is a cross-fade of about 0.08 of t, hidden at the moment its fixed piece is edge-on to
   the DEFAULT camera; turned to another view, or on long walks (several mirrors and creases turning the fixed piece
   more than once), it shows as a gentle fade; a 2*22 tile whose fixed piece never turns away (4 of 40 random mirrored
   tiles) fades at t = 0.2; an *x tile that slides across without turning over fades over the whole flap.
5. Mirrored hinge tiles still dip below the plane during their page turn (4*2 Triangle up to 0.72 tile sizes).
6. Edge-on flaps for one frame (333 t ≈ 0.34, *632 t ≈ 0.175, *442 t ≈ 0.225): continuous, reads as a flicker.
7. 442 at az 40 el 30 and 2222 at az 120 el 20: the "2" label lies on the comma's thin outline (4 of 240 labels).
8. Smallest phone (375 x 548): the *x strip is 19 px thin and 22* 25 px (others 27–44 px).
9. Polish left: the scrubber's magnets are hard to feel (9 groups have no stop between the ends); xx at t = 1 in the
   default view shows the joined comma as a dark patch; the ** slit seed checks a place, not the old configuration.
10. Not verified: Safari, Firefox, a real phone, a real GPU; the live spacesheep address bar (no deploy allowed).
