# ui-app fixer, round 3 — 2026-11-09

Files (SPEC 8): `src/app.js`, `src/folds/index.js`, `test/folds.test.js`, `dev/app-demo.html`, `dev/app-frame.html`,
`tools/qa-matrix.mjs`; new tests `test/app-url.test.js`; scripts `dev/ui3-*.mjs`; pictures `qa/round3-ui-app/`.
Each entry is written when the fix is finished: what, files, how verified.

## URL state (the owner's request, SPEC 7) — done ~23:05

What (`src/app.js`):
- Pure, exported, tested in node: `encodeHash(u)` / `decodeHash(hash)` for
  `#g=<id>&cut=<i>&seed=<x>/<y>&wavy=<a>&t=<t>&view=<az>/<el>/<zoom>[/<roll>]`. `g` always (so a link never depends on
  the default group); every other key only when its rounded value is not the default (cut 0, no seed, wavy 0, t 0,
  view 0/55/1/0). `*` is written `%2A`; numbers are plain decimals (seed 4 decimals, t 3, wavy 2, angles 1, zoom 2),
  never `-0`, never an exponent, so every hash matches the viewer's filter `WRAPPER_HASH` = `/^#[A-Za-z0-9_.=%&\/-]*$/`.
  `seed` only when the cut was dragged (presetIndex −1); `cut` still names the preset whose metric and anchor apply.
  Kaleidoscopes write no seed, no wavy.
- **One addition to the SPEC format: an optional 4th view number, `roll`** (written only when not 0). The 3D view is a
  free trackball: any diagonal drag turns the picture about the line of sight, which az / el cannot hold; without it a
  copied link opened with the picture rotated in the screen plane (seen in the loop test: roll −28.4° after one drag).
  `viewToUrl(q, zoom)` = { az, el, zoom, roll } with q = Rz(roll) ∘ viewFromAzEl(az, el) (az = 0 when looking straight
  down or up); `viewFromUrl` is its exact inverse. `getState().view` now reports az / el from the eye's direction (it
  used the camera's x axis before: the same for every view without roll) and `roll`.
- Decoding: legacy `#<id>` (`#333`, `#4*2`, `#*632`, `#%2A632`, `#s632`, `#∗632`, `#22X`, `#ss` …) → group only. New
  form: missing key = default (no `g` = 333); a malformed value (not a plain decimal: `1e3`, `+1`, `0x1`, `Infinity`; a
  cut the group lacks; a seed / view with the wrong number of parts) is dropped and listed in `dropped`, the rest
  applies; t / wavy clamped to [0, 1], el to [−90, 90], zoom to [0.5, 3.2], az / roll wrapped. A hash with nothing of
  ours (`#nonsense`, `#foo=bar`, `#g=nonsense`, empty) → null.
- In the page: every state change schedules a write (throttle `HASH_THROTTLE_MS` = 250 ms, leading and trailing edge);
  a write = `history.replaceState(history.state, '', hash)` (fallback `location.replace`) only when the hash differs,
  plus `parent.postMessage({ type: 'ss-hash', hash }, '*')` inside a frame. Immediate writes when a drag ends (plane
  `onSeed` 'end'), a scrub ends (`change` on the scrubber), Wavy is released, a play ends or pauses (timeline
  `onState`, after the frame's last t), a 3D turn ends (pointerup / pointercancel on the fold canvas; the momentum after
  it is caught by the trailing write), a preset chip or a picker node is clicked. Writes inside a change are held
  (`quiet`) so a half-applied state is never written. Safari allows 100 history calls per 30 s: the page keeps to 80
  (`HASH_BUDGET`) and defers beyond that.
- On load: the hash is decoded and applied in one rebuild (group, cut = preset + its anchor + metric, seed, wavy, t,
  view), then the canonical hash written and posted. On `hashchange` (the viewer forwards a pasted link): the same;
  legacy `#<id>` acts like a pick (orientation kept, as before); a hash that names nothing leaves the picture and is
  rewritten to what is shown (finding 52). Only what differs is rebuilt (t / view alone: no rebuild).
- `getState()` gains `cut`, `url` (the hash this state writes, at once) and `mirrored`; `hash` is the address now
  (follows within 250 ms). `__folding.flushHash()` writes at once; `counters.hashWrites / hashPosts`.

`dev/app-frame.html` is now a faithful stand-in of the spacesheep viewer, written from its source
(`~/git/spacesheep/spacesheep/packages/app/src/pages/viewer.ts`, `early-frame.ts`, `assets/document/frame-links.ts`):
cross-origin content frame (the same server as `localhost` vs `127.0.0.1`) with the viewer's sandbox flags; the frame
gets the address's hash at load (`ssFrameGo`); `ss-hash` messages are taken only from that frame's origin and source,
filtered by the same regex, and written with `history.replaceState` (`#` alone clears); the address's own hashchange
is forwarded with `contentWindow.location.replace` (`fwdHash`, comparing with the URL it last sent). The bar shows the
address's hash and counts the messages. `dev/app-demo.html?bridge` plays the content worker's injected bridge (posts
ss-hash on the frame's own hashchange). Default page: the unbundled app; `?page=dist` the built one; `?opaque` the
strictest sandbox (self-contained page only); `?open` a plain iframe.

Verified:
- `node --test test/app-url.test.js`: format (defaults left out, order, %2A, rounding, no −0, clamping), round trip of
  every parameter for 17 × 150 random states (decode(encode(u)) = u, encode again = the same text, the viewer's
  filter takes it), every group id in five legacy spellings + the reviewers' alias list, 40 malformed hashes (null or
  exactly the bad key dropped, the rest kept), the view decomposition (grid of az / el: exact; 3000 random
  orientations: exact inverse, through the hash within 0.2°).
- `node dev/ui3-url-loop.mjs` (Chrome on the mini, `dev/app-frame.html`): 31 checks, all pass. Real clicks and drags:
  chip → picker → 4∗2, chip "Quad", plane drag, Wavy, scrubber, a diagonal 3D drag and the wheel → the HOST's
  address `…/dev/app-frame.html#g=4%2A2&cut=1&seed=0.3272/0.4745&wavy=0.65&t=0.566&view=-46.1/12.3/1.33/-28.4` =
  the frame's hash = `getState().url`; host history did not grow; no message dropped. That address in a fresh page:
  same group, cut, anchor, metric, seed (4 decimals), wavy, t, view (0.1°, zoom 0.01), every vertex of the surface
  within 1.4e-4, orientation within 0.02°, the same address. Pasted link `#g=xx&t=0.4&view=30/20/1.2` into the host's
  address: applied (group, t, view). `#nonsense`: picture kept, address rewritten (52). `#g=2222&cut=2&t=abc&wavy=0.5`:
  t dropped, rest applied. A 6 s drag: 25 writes / 25 posts (at most one per 250 ms + the last). Legacy `#333`,
  `#4*2`, `#*632`, `#s632`, `#%2A2222` open the right group, the address becomes `#g=…`. No console error.
- Looked at `qa/round3-ui-app/loop-original.png` vs `loop-restored.png`: the same tile, seam colours, 3D view, Wavy and
  scrubber; the host bar shows the same hash. Two differences, both expected: the plane window sits a little
  differently (the plane now pans its window by itself; not a URL parameter), and the fresh page shows "drag to move the
  cut" (that visitor has not dragged yet).

Known limits:
- Seam colours are numbered afresh when a link is opened. During a drag a seam keeps its colour under the finger, so
  after a long drag the original page may colour two seams the other way round. The tile and the gluing are the same.
- The viewer's `fwdHash` compares the address with the URL it last SENT the frame, not with what the frame reported
  since (`__ssHref` is not updated by ss-hash). So pasting into the address exactly the hash the page was opened with,
  after the state has changed, forwards nothing: the address shows the old state, the page the new one. Viewer-side;
  the page cannot see it. (Seen in the source; the stand-in reproduces it.)

## #29 one label per orbifold point (and the 22x Bowl four-label case) — done ~23:15

What (`src/app.js`): `coneClasses(group, cones)` puts the cone points of the tile into the points of the orbifold
(two are one point exactly when r(a) − b is a lattice vector for a coset rep r of the group); `buildScene` stores
`cone.cls`. `sceneMarkers`: the first copy of each point is always labelled; a later copy keeps its dot, its label
fades with its 3D distance d to the nearest earlier copy, `labelFade(d / size)` = smoothstep from 1 at
`LABEL_FADE[1]` = 0.4 tile sizes to 0 at `LABEL_FADE[0]` = 0.12 (continuous in t, no pop), and is left out below 0.02;
a copy within 2e-3 tile sizes (seams closed) merges into the earlier one (as before, so at t = 1 the markers are exactly
the orbifold's name). The renderer has no label opacity: a copy's label text carries an invisible tag (U+200B, one more
per cone index) and `start()` sets the matching span's `style.opacity` after each draw and from a MutationObserver
whenever the renderer rewrites a label (labels are HTML spans that the renderer docs invite restyling). First copies come
first in the marker list, so the renderer's own label slots for them never move.
Verified: `test/app-url.test.js` — classes = the orbifold's points for every preset + 8 random seeds × amp 0/1 of all 17
groups; over 201 steps of t for every preset + 2 random seeds × amp 0/1: one plain label per point, a copy has no label
within 0.12 and a full one beyond 0.4 of an earlier copy, opacity steps < 0.35 per 1/200 (smoothstep of a continuous
distance), one labelled marker per point at t = 1; the reviewer's eight cases (632 / 3*3 / 4*2 / 442 Triangle,
22* Pillowcase, 333 Rhombus, 442 Square, 22x Bowl): one visible label per point from t = 0.72 (hinge; the overprint
was at 0.72-0.79) and 0.92 (22x Bowl). `test/folds.test.js` 'scene' check: a faded copy may have an empty label.
Probe `node dev/ui3-probe-labels.mjs`: hinge copies fade over t ≈ 0.6-0.68, 22x Bowl over 0.85-0.9.
Looked at: `qa/round3-ui-app/labels-632-triangle.png` (t 0.56-0.76: two "6", the copy pale at 0.64, gone at 0.68,
the dots meet at 0.76), `labels-22s-p0-t*.png`, `labels-333-p0-t*.png`, `labels-22x-p1-t*.png` (four "2" at 0.87,
two pale at 0.9, one per cone point at 0.95). No overprint anywhere.

## C3: preset.anchor and fold.mirrored — done ~23:10

- `presetState(group, i)`: seed, metric, anchor = `preset.anchor ?? preset.seed` (a malformed anchor: the seed);
  `usePreset` uses it. The hinge fixer's explicit anchors (632 Kite, 3*3 Kite, 4*2 Diamond) now reach the fold; the
  hinge fixer re-checked #15 with real chip clicks in the app (notes/hinge-round3.md entry 5: frame centre fixed over
  every preset of every hinge group at t = 1).
- `surfaceStyle(fold)`: front / back swapped when `fold.mirrored === true`; `rebuild()` calls `R.setStyle` when it
  changes. `getState().mirrored`.
Verified: `test/app-url.test.js` (presetState on every preset and a fake group with good / malformed anchors;
surfaceStyle; 22* across its mirror y = 0.4 with the default anchor → `fold.mirrored`); `node dev/ui3-look.mjs --only
mirror` in the browser: 22*, 2*22, 4*2, 3*3 at t = 1, seed on either side of a mirror of the group: `mirrored` false →
true, frame centre unchanged, the average colour of a 41 × 41 patch at the frame centre identical (difference 0);
control: the same mirrored tile with the colours not swapped differs by 14-25 levels. Pictures `mirror-*-a/b.png`
(22*: identical pillowcases).

## #30 / #36 kaleidoscopes: nothing to cut; C1 attributes — done ~23:10

- `#app[data-fold]` = group.fold and `#app[data-features]` = `groupFeatures(group)` (seams mirrors cones corners double,
  read off the orbifold symbol) are set in `fillShell` on every group change.
- Kaleidoscopes: `P.setScene({ …, interactive: false })` (C2), `onSeed` ignores them, `__folding.setSeed` is ignored
  for them, the URL writes no seed / wavy for them; `hintState` hides the plane hint for them (C1: the static
  `#cut-note` replaces it). The fading kaleidoscope-hint machinery of round 2 (`HINT_FADE_SECONDS`, `data-faded`) is gone.
Verified: `test/app-url.test.js` (the features of all 17 groups as a table, and checked against every preset's tile:
cut edges, mirror edges, cone points off / on mirrors, the fold's double line; hint per group); browser `node
dev/ui3-look.mjs --only snow`: *632 and *442 at t = 0.45 — a real 80 px mouse drag and arrow keys on the plane change
nothing (seed, preset, URL), attributes `snowflake` / `mirrors corners`, hint hidden; `snow-s632-after-drag.png`: no
handle in the plane. (The chip row and Wavy are hidden by ui-layout's CSS for `data-fold="snowflake"`, not yet in
`src/styles.css` at 23:10.)

## #53 without WebGL 2 — done ~23:10

`R.ok === false`: `#fold-btn`, `#scrubber`, `#reset-view` disabled, the timeline destroyed (Space and the scrubber do
nothing), `#turn-hint` hidden; the plane, presets, Wavy, picker and URL work as ever. Verified (browser, WebGL 2 taken
away by an init script): the three disabled, the renderer's message shown, a real plane drag moves the cut and the URL
follows, Space plays nothing; `nowebgl-22x.png`.

## The URL's write policy: no stall in a long session — done ~23:35

Found by `tools/qa-matrix.mjs --interact`: a first budget (at most 80 writes per 30 s, then nothing until the oldest
left the window) made a legacy hash typed into the address wait seconds for its rewrite after a busy scripted session;
a person dragging for 20 s would have seen the address stop following the same way. Now (`src/app.js`, pure and
tested): `hashWriteDelay(now, writes, urgent)` — a cap of 90 writes per 30 s (Safari allows 100, and the viewer calls
replaceState once per message), urgent writes (a gesture ended, a click, a hash applied) at once below the cap, and the
throttle's interval `hashInterval(n)` = 250 ms × (1 + max(0, n − 30) / 15) for the n writes of the last 30 s, so a
long drag or a chain of plays slows the writes down (about 0.6 s apart at equilibrium) instead of running into the cap.
Verified: `test/app-url.test.js` "the write policy": a simulated 3-minute session with a change every frame and an
urgent write every 1.7 s (and every 0.3 s): never more than 90 writes in any 30 s, the address never waits more than
1.3 s, every 250 ms at first. Browser: `dev/ui3-url-loop.mjs` all passed again (a 6 s drag: 24 writes).

## tools/qa-matrix.mjs follows the new contracts — done ~23:40

- Every shot: the state's hash (`getState().url`) names the group and t, and the address follows within 1.5 s.
- Pickers (mouse, touch): the address starts `#g=<id>` at once; after the zoom glide it has the whole state.
- Interaction section 9: a legacy `#*632` typed in is applied and rewritten; a kaleidoscope shows no hint, the
  static note instead of presets / Wavy (checks `#app` attributes and what is displayed), and a drag or arrow key on
  its plane changes nothing; every parameter set (4∗2, cut 1, seed, wavy, t, view) is in the address and a reload brings
  the group, cut, anchor, seed, wavy, t and view back; `#nonsense` keeps the picture and the address.
- The frame session runs for the unbundled page too: `dev/app-frame.html?page=…%3Fbridge` (a frame of its own origin,
  the viewer's sandbox) or, for dist, `?page=dist&opaque` (the strictest sandbox, as before); the host's address takes
  the new form of the legacy link, follows a group change, and opened afresh shows the same state.
- Touch: the old "kaleidoscope hint fades on a phone" check is replaced by: no hint, the static note, a finger on the
  plane changes nothing. The drag-step timing list has 632 instead of ∗632 (a kaleidoscope takes no seed).
- "the seams slide over the shape" measured only the first ten samples of edge 0, which for 333 sit at a rotation
  centre that does not move (0.008 < 0.01: a false alarm); it now takes the largest distance from the new outline to
  the old one over all edges (0.204 for a 0.19 seed move; the shape's centre 0.0000).
- MEASURE reports labels without the copies' invisible tag (and not the faded ones), and `foldAttr`, `features`,
  `cutNote`, `presetsShown`, `wavyShown`, `turnHint`.
Verified: `node tools/qa-matrix.mjs --only-interact --page dev/app-demo.html --out qa/round3-ui-app/matrix-interact`:
70 of 70 checks, 0 problems, 0 console / page errors (Chrome on the mini).

## #5 complement (the snowflake fixer's request, notes/snowflake-round3.md) — done ~23:45

What (`src/app.js` `sceneLines`): a kaleidoscope's MIRROR edges are drawn with x-ray `KALEIDO_EDGE_XRAY` = 0.85
instead of `EDGE_XRAY` = 0.42 (every other bold edge unchanged). For the kaleidoscopes the outline is the orbifold; a
flap passing in front of a side no longer turns it grey for a moment (the owner's "becomes gray suddenly").
Verified: `test/app-url.test.js` 'outline' (every edge of every group: 0.85 exactly for kaleidoscope mirrors, 0.42
else); the snowflake fixer's comparison `qa/round3-snowflake/v1-xray.png`; in the app `qa/round3-ui-app/
outline-s2222-lastfold.png` (∗2222 t 0.86-0.96: all four sides bold throughout; at 0.88-0.90 v1 drew two of them grey).

## The Klein work's requests R1 and R2 (notes/klein.md) — applied ~23:55

R1 (`src/app.js`): `motifTintMesh` / `MOTIF_FILL_3D` imported; `ROLL_FOLDS`; `buildScene` replaces fold.mesh by the
tinted mesh when `motifFor(group).seam` and the fold is a roll (xx only today); `ghostColor` returns MOTIF_FILL_3D for a
tinted mesh. R2 (`test/folds.test.js`): the ghost-colour test expects MOTIF_FILL_3D for the tinted mesh and asserts
only xx has one. Applied by hand to the current files (their patch was against 22:52), exactly their four hunks.
Verified: `node tools/test-all.mjs test/klein.test.js test/folds.test.js test/app-url.test.js`: 51 / 51, the Klein
work's 'xx scene (app.js)' test no longer skipped and passing. `qa/round3-ui-app/klein-r1-closing-left.png` (xx, az −70
el 25, t 0.76-1) matches their `qa/klein/preview-xx-closing-left.png` frame for frame: the grey comma pieces on the two
open ends, one grey comma meeting at the upright orange 8 at t = 1.

## Whole runs (~00:05)

- `node tools/test-all.mjs` (aifoundry1): 660 tests, 656 pass, 2 skipped, 2 fail — both in `test/crosscap.test.js`
  ('anchor (SPEC 7) 3', 'stage 2 (acts)'), the cross-cap fixer's in-flight work (src/folds/crosscap.js changed at
  23:00); notes/klein.md attributes the same two. Every test of my files passes (folds, app-url, and klein's xx scene).
- `node tools/qa-matrix.mjs --interact --page dev/app-demo.html --out qa/round3-ui-app/matrix`: 113 pictures, 78 cuts
  folded shut (worst seam 1.8e-8), drag step 1-2.5 ms, interaction 70 of 70, 0 problems, 0 console / page errors.
  Looked at `632-1280-0.5.png` (four corner labels while apart), `22x-390-1.png` (one "2" per cone point, the
  self-intersection item in the legend).

## For other owners (suggestions; nothing blocks)

- renderer (`src/render3d.js`): a `marker.labelAlpha` (label opacity; ≤ 0.01 = no label, no say in placement) would
  let the app drop its workaround (an invisible U+200B tag in the label text + `style.opacity` on the span from
  `start()`). The workaround relies only on "a label's text is the marker's label" and on labels being spans in the
  label layer (documented in render3d.js).
- renderer: the no-WebGL message could add that the cut can still be explored in the plane (finding 53's optional part).
- orchestrator / spacesheep (not a file of this project): the viewer's `fwdHash` compares the address with the URL it
  last SENT the frame (`__ssHref`), not with what the frame reported since; pasting into the address exactly the hash the
  page was opened with, after the state changed, forwards nothing. Fix on the viewer side: update `cf.__ssHref`'s hash
  when an accepted ss-hash arrives. (Read in ~/git/spacesheep/spacesheep/packages/app/src/pages/viewer.ts; the stand-in
  reproduces it faithfully.)
- plane / later: a copied link numbers the seams' colours afresh (assignEdgeColors keeps a colour along a drag's
  history, a link has none), so after a long drag a seam pair may show the other colour than in the session it was
  copied from (the Klein work saw the same: 0.38 % of the pane). Same tile and gluing.

## Contracts as implemented (for the other fixers)

- URL: `#g=<id>&cut=<i>&seed=<x>/<y>&wavy=<a>&t=<t>&view=<az>/<el>/<zoom>[/<roll>]`; `*` = `%2A`; g always, the rest
  only when not default; the optional 4th view number (roll, degrees about the line of sight) is the one addition to
  SPEC 7. `getState().url` (the hash of the state, at once) and `.hash` (the address, within the throttle);
  `__folding.flushHash()`.
- C1: `#app[data-fold]` = group.fold; `#app[data-features]` ⊆ "seams mirrors cones corners double" (in that order),
  set on every group change; `#turn-hint.hidden = true` after the person's first turn of more than 2° (pointer or keys
  on the fold canvas; a script, the wheel, a click do not count), never shown again; no-WebGL hides it too.
  The plane hint is hidden for kaleidoscopes (`hintState`).
- C2: `P.setScene({ group, domain, motif, star, interactive: group.fold !== 'snowflake' })`; the app also ignores
  onSeed and `__folding.setSeed` for the kaleidoscopes.
- C3: anchor = `preset.anchor ?? preset.seed` (`presetState`); `fold.mirrored === true` → front / back swapped
  (`surfaceStyle`), `getState().mirrored`.

## Test correction (~00:15): the reviewer-case label test no longer assumes another module's timing

The cross-cap fixer's 23:14 timing moved 22x Bowl's corners to meet later (0.28 tile sizes apart at t = 0.90 instead of
0.11), and my test had hard-coded "one label per point from t = 0.92" for that case. The labels themselves were right
(opacity 0.61 at 0.90, gone at 0.95: they follow the geometry). The test now reads each case's closing time off the
fold's own motion (the first t of a 1/200 grid from which every copy stays within LABEL_FADE[0] of an earlier copy) and
asserts one visible label per point from then on, and that the copies close before t = 0.99 (not "two labels until
the end"). Closing times now: 333 Rhombus 0.675, 632 Triangle 0.695 (the reviewer's overprint was 0.72-0.79), 22x Bowl
0.94. Not weaker: the same property, at the time the motion actually closes the corners.
