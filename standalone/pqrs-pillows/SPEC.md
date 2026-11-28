# PQRS pillows: the binding spec (v1, Fri 27 Nov 2026, 16:15)

## v2: what replaced what (Fri 27 Nov 2026, 23:00 on; his asks of 22:55)

His words about v1: *"I don't want to switch colors, so the lines between different edges should keep their colors.
I should be able to adjust different sliders, and when I switch between sliders, there shouldn't be any change. The
only change will be when I'm actually moving the slider, so maybe the image can always be painted there
correspondingly. The surface currently looks quite wobbly maybe find a better surface parameterization."*

Where the text below and this section disagree, this section wins. `README.md` describes the page as it is.

| v1, below | v2 |
|---|---|
| § 1.1: the ACTIVE partition's first pair blue and larger, its second pair orange and smaller, everywhere | a partition owns a colour for good: PQ\|RS blue `#0072B2`, PR\|QS vermillion `#D55E00`, PS\|QR purple `#882E72` (its two seals, its loop, its card, its rows). Cone points are marked alike. No card looks active |
| § 1.2: the active partition's seals and loop on the pattern | every partition's two seals (bold) and loop (thin), always |
| § 1.2, § 1.4: on activation the pattern is redrawn where it was and the surface is carried to the new cut's mesh | a flip redraws NOTHING in either pane; the next slider move lays the new cut where the picture is. Gate: not one pixel differs (tools/check.mjs "switch") |
| § 1.3: touching a card that is not active "first makes it active" (visibly) | the same bookkeeping, with nothing to see; a card's head is a name, not a control |
| § 1.4: the closed surface is `orbifoldMesh` relaxed by `solver.js`; pose: the active loop level; the second pillow shaded | the surface is the exact solid of `solid.js` (a tetrahedron of hyperbolic space with the six seals as edges, shown in the Poincaré ball; 2222 in ordinary space), the same for every cut; one paper tone; the pose is carried by the four named cone points |
| § 1.4: the journey parts the active partition's pillows | the journey is hidden until it is rebuilt on the solid with its own choice of loop |
| § 1.5: a table of the active partition's two pillows; the closed surface's stretch | six rows, two for each partition; the line says the solid is exact |
| § 3.2 `solver.js`; § 3.3 `sm.flip`, the frame's pillows and chains | no solver; `sm.set`, `sm.update(state, { hold })`, `sm.frame()`, `sm.relevel()`: curves and marks come as points |


Read `BRIEF.md` first. This file says WHAT is built and where each piece lives. Where it and an older note
disagree, this file wins. Change it only by telling the orchestrator.

## 0. What changed since the brief (his words in two sibling sessions, 14:30–15:40 today)

While this page was being prepared he had two sibling pages built and said what he wants of them:

- *"simultaneously give controls for all partitions … I should be able to adjust the twist between two pairs and
  simultaneously see the sliders adjust for the other choice of pants"* (page `docs/pqrs.html`), and for 2222
  *"three groups of sliders, corresponding to three different ways of partitioning the corners into two groups. For
  each slider, I can adjust the twist and the length, and this automatically affects the remaining sliders"*
  (page `docs/real-2222.html`, "The real 2222").
- *"Use a more subtle view of the parameterization. Instead of highlighting thick lines … use two different colors
  to mark special points on two different sides of the twist"*, *"keep the highlighting on at all times"*, and
  *"Instead of drawing the isolated cut … highlight the pairs of vertices which are being separated. So use
  different colors and different sizes"*.
- *"I want to have some kind of pattern which covers the entire pillow"*; *"one slider affecting the twist, and I
  want to see it in the three-dimensional model"*.

Look at both pages before designing anything: `shots/sibling-pqrs.png`, `shots/sibling-real2222.png`. This page is
their hyperbolic big sister: **the 3D pillows for any PQRS, with three coupled partition cards, the pattern held
still.** So the flip of the brief is no longer a separate diagram: it is what happens when another partition's
card is touched.

## 1. The page

**PQRS pillows** — one self-contained HTML file, tabs **Play** and **Tutorial**.

```
[ PQRS pillows ]  [2222] [3333] [2223] [2345] [4444]  [ or type four orders: 2346 ]            Play | Tutorial
one sentence: The orbifold PQRS is two pillows joined along a loop. Each of the three ways to pair its four
              cone points has its own Length and Twist: move any of them.
+--------------------------- Pattern ---------------------------+ +--------------------------- Surface ---------------------------+
|  Poincaré disc (plane for 2222), drag to slide                | |  3D, turntable; the two pillows                              |
+----------------------------------------------------------------+ +----------------------------------------------------------------+
                                                                    [Join]  surface ----- two pillows ----- open crowns  [Part]
+------- P3 Q3 | R3 S3 (active) -------+ +------- P3 R3 | Q3 S3 -------+ +------- P3 S3 | Q3 R3 -------+
| Length  ----o------------   2.634    | | Length ...         2.634    | | Length ...         3.850    |
| Twist   -------o---------   +0.000   | | Twist  ...        +0.000    | | Twist  ...        +0.250    |
+--------------------------------------+ +-----------------------------+ +-----------------------------+
The two pillows (a small table: corners, loop, seal, heights, area; "exact crown" or "past the rim"; stretch)
```

- Desktop: the two panes side by side, equal, square-ish; cards in one row of three. Phone (≤ 640 px): the two
  panes stay SIDE BY SIDE at half width each (so both are seen while a slider moves), then the three cards stacked,
  then the table. Nothing wider than the screen; tap targets ≥ 44 px; field text 16 px.
- White ground, near-black ink, the look of Two features, two handles (`shots/tfth-3333-desktop.png`): it is built
  with the same `styles.css`. No dark-mode work beyond what the imported parts already do.

### 1.1 Features, names, colours

- The four cone points are **P, Q, R, S**: the digits of the signature in the order typed (feature 0..3). Labels
  are the letter with its order: `P3`. (Letters are needed: in 3333 the digits cannot tell the points apart.)
- A **partition** is one of the three ways to pair them: `PQ|RS`, `PR|QS`, `PS|QR` (keys `01|23`, `02|13`,
  `03|12`). Each has a **loop** (the curve that parts the two pairs), a **Length** and a **Twist**.
- The **active** partition is the one whose loop is the engine's cut. Its first pair is drawn **blue `#0072B2`,
  larger**; its second pair **orange `#D55E00`, smaller**, everywhere: card header, pattern marks, 3D marks, seals.
  Inactive cards show the same two colours pale (as on The real 2222).
- Words on the page: pillow, loop, seal (the geodesic between a pair's two cone points), Length, Twist (in
  turns: one turn = once round the loop), pair, partition, crown, zip, join, part. NOT: crystallographic names,
  "swap", "flip" in visible text is fine but the cards need no verb, letters A–D.

### 1.2 Pattern pane

- Two features, two handles' pane as it is: `createPattern` fed `buildPatternModel(state)`, slid by dragging.
- Marks by pair in the two colours and two sizes, always on. The two seals (the engine's `treeSeg`,
  `farTreeSeg`) thin, in their pair's colour. The loop itself thin (about 1.2 px, ink at 60 %): no heavy cut.
- **Stillness:** when a card is activated the pattern does not move: model points to 1e-9, pixels under half a
  pixel (`view ← view · invQ`, `retiePrint`, exactly as `page.js` `pickPair`; see `maps/render.md`).

### 1.3 Partition cards (the coupled sliders)

- Three cards in FIXED order `PQ|RS`, `PR|QS`, `PS|QR`, keyed by pairing (never by 'lo' / 'hi', which change
  places). Each shows its loop's Length and Twist from `triangle(state).loops` (`flips.js`): the numbers the
  engine would hold if that loop were the cut.
- Touching a slider of a card that is not active first makes it active (a flip: `flip(state, key)`), then moves
  that number. Clicking a card's header only activates it. Then every card is refreshed. So all three stay true
  at every moment, and the reader can alternate between them freely.
- Length: range `[0.4, max(7, 1.08 L)]` (2222: the engine's `L` is the pair's spacing, half the loop: range
  `[0.5, 2]`, and the card says "Length (pair spacing)"); Twist: `[-0.5, 0.5]`, three decimals, signed.
- Under a continuous drag of one card the other two cards' numbers move continuously except where the natural
  triangle changes (Twist of the active card crossing 0 or ±1/2): there a card's loop gives way to its twin,
  its Length continues, its Twist changes sign. That is the mathematics; do not smooth it away. (Keying by
  pairing keeps the cards in place.)
- Carry `state.tri` across flips (flip and flip back returns the same numbers); it lapses by itself when a
  slider moves.

### 1.4 Surface pane

The orbifold in space as two pillows joined at the loop: the "pointy tetrahedron".

- **Closed surface (hyperbolic):** the mesh of `pillow.js` `orbifoldMesh(orders, L, tw)` relaxed toward its exact
  rest lengths by `solver.js`. Honest label under the pane or in the table: "relaxed mesh, mean stretch 0.3 %".
- **Flat 2222:** exact, no solver: the solid of Twist of 2222 through `flat2222.js` (pillow-math NOTES 5.1).
- **A (2,2) pair** in a hyperbolic orbifold: that pillow is its seal alone, lying on the loop; the other pillow's
  rim is folded shut on it (the mesh already has one pillow and a folded ring).
- **Look:** printed paper as on Twist of 2222 and The real 2222: teal front `#9ad5cc` with commas `#4fa397`, sand
  back `#f5e6c6` / `#d8bd85`, opacity 0.96; the second pillow slightly shaded (the renderer's ghost tint: ink at
  0.11); the active pair's seal blue 3 px, the other pair's seal orange 3 px, the loop ink 1.8 px; marks: blue
  larger dots for the first pair, orange smaller for the second, labelled `P3` … The print is the pattern's own
  commas (§ 1.6).
- **Pose:** the loop level (axis = world z, up), the active partition's first pair BELOW, its seal level
  (`pillow.js` conventions). View `az -20, el 14`; the frame radius fixed per state so size is seen; turntable.
- **Length and Twist are seen:** Length changes the girth of the neck and the heights of the pillows; Twist turns
  the upper pillow against the lower (the seals' angle), every frame of a drag (warm solver update).
- **Activation of another partition (flip):** the surface is THE SAME surface. Carry the closed shape onto the
  new partition's mesh (`pillow.js` `toPillow` → `locate` → `pointOn` of the old positions, with the engine's
  frames), let the solver settle from there, recolour pairs and seals, and turn the solid over 0.5 s (no turn
  under reduced motion) to the new pose (new loop level, new first pair below), as Twist of 2222 turns its solid.
  If the carry fails (a far-out state), fall back to a cold start for the new state.
- **The journey** (one scrubber, three stops, like The Folding's surface — tile — pattern):
  `surface` → `two pillows` → `open crowns`.
  - `surface → two pillows`: the two pillows move apart along the axis; each shows its open loop corner.
  - `two pillows → open crowns`: each seal unzips and the pillow opens into its crown on the surface of
    revolution r(s) = (L / 2π) cosh s, which is EXACT up to the rim s = arsinh(2π / L) (positions mixed between the
    closed shape and `mesh.open.positions`). A (2,2) pillow has nothing to open.
  - Button at the left reads `Join` (pillows → surface) or `Zip` (crowns → pillows); at the right `Part`, then
    `Unzip`. The scrubber can be dragged. Sliders keep working at every stop.
- Picking: a tap on a mark activates the partition in which that point is paired with … nothing in v1 (no pick
  action); keep `onPick` unused.

### 1.5 The two pillows, in numbers

A small table, two rows (first pair's pillow, second pair's): corners `2π/p`, `2π/q` and the loop's length;
distances: seal, the two heights; area as a multiple of π; and one line: `crown exact` or `peaks past the rim:
flange`, plus the closed surface's measured mean and worst stretch. From `pillow.js` `pillow(p, q, L)` and the
solver's stats. This is the "six data" of the reply.

### 1.6 The print on the surface

The pattern's own commas, so that both panes show one orbifold:

- Comma outlines come from the engine (`centredFor(state).shapes[i].pts`, hyperboloid points in the pair frame;
  copies in other tiles by the tile motions, `tilesPSU`). Baked into ONE signed-distance texture with The Folding's
  `sdf.js` `bakeSDF` over the chart cell that holds the Poincaré disc in the pair frame (origin `(-1, -1)`,
  `e1 = (2, 0)`, `e2 = (0, 2)`), size 1024 (512 while dragging), handed to the pane (`setPrint`, renderer mode 3).
- Every mesh corner's chart point is the DISC point of that corner in the pair frame (`Pmat · X(s, θ)`). Any
  image of a triangle under the group shows the same print, so a triangle far from the middle may be brought
  nearer by a turn about one of its pillow's cone points before its chart points are taken (better resolution).
- Re-baked whenever the state changes (Length, Twist, flip): commas never break, they ride as the pattern's do.
- 2222: the plane; bake one lattice cell (translations `(2L, 0)`, `(2·2L·tw, 2/L)`), chart point = plane point.
- If baking fails or is too slow on a device, the surface is drawn in its two plain tones; the page still works.

### 1.7 Address

`#k=<sig>&m=<perm>&l=<L, 3 dec>&tw=<4 dec>[&tri=k.lo.hi][&j=<journey 0..2, 2 dec>][&v=<az>,<el>]`, written through
`shareHash` (posts `{type:'ss-hash'}` to the spacesheep viewer), read on load and on `hashchange`. `#` alone is
3333 at the engine's defaults. Only `[A-Za-z0-9_.=%&/-]` (a comma travels as `%2C`).

### 1.8 Tutorial tab (short, peer register, MathJax at build time via `\( … \)`)

1. Two pillows: the pillow {p, q, L}; the half-pillow quadrilateral and its six data with the closed forms.
2. The crown is exact: Fermi coordinates, r(s) = (L/2π) cosh s, the rim arsinh(2π/L), the twist is the turn 2π·tw.
3. Zipping: what is exact and what is relaxed (two smooth faces creased along a common geodesic force a straight
   crease, so a smooth K = −1 surface with geodesic creases does not exist in R³; the closed shape here is a
   mesh relaxed toward the exact lengths, with its measured stretch).
4. Three partitions, one orbifold: loops that meet twice, the triangle of three loops, the cubic relation among
   their lengths, why touching another card moves nothing; the twin.
5. 2222: flat, the loop slides, the exact tetrahedron; the seal's turn is arccos(1 − 4·tw), not 2π·tw.
6. Credits and siblings: built from Chaim Goodman-Strauss's reply as Yaroslav Bulatov understood it; he has not
   seen this build. Links (allowed hosts only: `https://spacesheep.dev/@yaroslavvb/…`,
   `https://yaroslavvb.github.io/animated-groups-fable/…`): Two features, two handles; Twist of 2222; The real
   2222; Classification of Surfaces. No quote from any call or email beyond the reply already public on the
   critique page; never the words "recorder", "recording", "transcript" anywhere in the file (a publish filter
   refuses them, also inside identifiers).

## 2. Where the code lives

Worktree `/Users/solid/git/agf-pqrs-pillows`, folder `standalone/pqrs-pillows/` (new). The worktree's branch is
fast-forwarded now and then by a hook when other sessions push to main: your files are all NEW files in this
folder, so that is harmless; never edit a file outside this folder (shared files belong to other sessions).

```
standalone/pqrs-pillows/
  package.json            "test": "node --test", "build": the build.mjs line of § 2.2
  SPEC.md                 this file (copied by the orchestrator)
  README.md
  src/
    flips.js              from proto/flips/flips.mjs (relative imports)                      pure   OWNER: core
    pillow.js             from proto/pillow-math/pillow.mjs                                  pure   OWNER: core
    state.js              presets, typed orders, cards, activation, numbers, address        pure   OWNER: core
    solver.js             the closed-surface solver (PROTO-SPEC interface)                   pure   OWNER: surface (baseline now; the round's winner replaces it)
    flat2222.js           the exact flat solid (copied from Twist of 2222: twist2222.js)     pure   OWNER: surface
    surface-model.js      mesh + solver + flip carry + pose + journey + curves + marks      pure   OWNER: surface
    surface-pane.js       from proto/infra3d/surface-pane.js (renderer glue, picking)        DOM    OWNER: pane
    print3d.js            comma outlines -> SDF bake + per-corner chart points               pure where possible   OWNER: pane
    cards.js              the three partition cards                                          DOM    OWNER: shell
    pattern-glue.js       the Pattern pane: model tweaks (pair colours), stillness           DOM    OWNER: shell
    page.js, page.template.html, page.css                                                    DOM    OWNER: shell
    tutorial.html         the Tutorial tab's markup, included into the template by the shell OWNER: words
  test/                   node tests, one file per module, named <module>.test.js           OWNER: the module's owner
  tools/check.mjs         the built page in headless Chrome (see § 4)                        OWNER: words
  site/index.html         the build
```

### 2.1 Imports (by relative path; nothing is copied unless listed above)

```js
// engine and pattern pane (Two features, two handles)
import { FAMILIES, normalizeFamilyKey, buildPatternModel, centredFor, defaultCommas, recut, retiePrint, GH, GE, invH, hgt,
         pairDistance, treeToCut, psuMul, psuInv, psuApplyDisc, psuToSO21, so21ToPSU, hypToDisc, discToHyp, axisCoords, … } from '../../two-features-two-handles/src/handles.js';
import { createPattern, locateTilePSU, tilesPSU } from '../../two-features-two-handles/src/pattern-ext.js';
// renderer, print bake, slider, hash, geometry helpers
import { createRenderer } from '../../the-folding/src/render3d.js';
import { bakeSDF } from '../../the-folding/src/sdf.js';
import { createTimeline } from '../../classification-of-surfaces/src/vendor/the-folding/timeline.js';
import { shareHash } from '../../classification-of-surfaces/src/sharehash.js';
import { mul, apply, det, I3 } from '../../classification-of-surfaces/src/sym/geom.js';
```

`maps/render.md` ("Reuse plan"), `maps/engine.md` ("What a new page can call", "Traps") and the working sibling
test page `maps/render-build/glue/` (glue.js, glue.template.html, glue.css: Pattern pane + sliders + flip with the
view put back + address, built with the shared build) are the starting points. A node test
(`test/contract.test.js`, owner: words) pins every imported name and the fields this page reads, so a fast-forward
that breaks them fails loudly.

### 2.2 Build

From `standalone/classification-of-surfaces`:

```
node build.mjs --template ../pqrs-pillows/src/page.template.html --entry ../pqrs-pillows/src/page.js \
     --css src/styles.css,../two-features-two-handles/src/page.css,../pqrs-pillows/src/page.css \
     --out ../pqrs-pillows/site/index.html
```

One `<script>`, one `<style>`, no `<link>`, `<img>`, `<iframe>`, CSS `url()`, no URL off the build's allow-list.
The build rewrites the tracked `classification-of-surfaces/src/gen/math.js` with the same bytes: leave it.
Two builds at once clash on that file: only the SHELL owner builds into `site/`; others build into their own
`standalone/pqrs-pillows/dev/<owner>/` with `--out`.

## 3. Module contracts

### 3.1 `state.js` (pure) — OWNER core

```js
PRESETS = ['2222', '3333', '2223', '2345', '4444'];
stateFor(text) -> state | null           // four cone points, orders 2..9 (normalizeFamilyKey; modes 'cones' / 'pillow' only); the engine's defaults
kindOf(state) -> 'H' | 'E'
featureOrder(state, f) -> order          // f = 0..3 = P, Q, R, S as typed;   featureName(f) -> 'P' | 'Q' | 'R' | 'S'
cardsOf(state) -> [card, card, card]     // FIXED order 01|23, 02|13, 03|12
   card = { key, pairs: [[f, f], [f, f]],  // first pair = the one that will be blue when this card is active
            L, tw, length,               // the numbers of this card's loop; length = the closed curve's length
            active, minimal, lRange: [lo, hi], twRange: [-0.5, 0.5], seals, seg, ends }   // geometry from flips.js for drawing
activate(state, key) -> { state, invQ, before, changed }      // a flip through flips.js; changed false when key is the cut; includes retiePrint
withNumbers(state, { L, tw }) -> state   // moves the cut's numbers (either or both); clamps to the ranges
toHash(state, ui) -> '#k=…'      fromHash(text) -> { state, ui } | null      // ui = { j, az, el }
pillowsOf(state) -> [{ features: [f, f], orders: [p, q], loop, seal, heights: [hP, hQ], area, degenerate, exact }, …]   // § 1.5, from pillow.js
```

### 3.2 `solver.js` (pure) — the PROTO-SPEC interface

`createSurface(opts)`, `surf.set(orders, L, tw)`, `surf.update(L, tw, budgetMs)`, `surf.positions`, `surf.mesh`,
`surf.adoptPositions(positions)`, `surf.stats()` → `{ strainMean, strainMax, … }`. The surface owner writes a
working baseline now (start from `mesh.open`, close the seals gradually, hold rest lengths, a bending term); the
solver round's winner replaces it behind the same interface.

### 3.3 `surface-model.js` (pure, no DOM) — OWNER surface

```js
const sm = createSurfaceModel({ nVertices: 2600 });
sm.set(state);                         // cold start (a new signature, a link); deterministic
sm.update(state, budgetMs = 4);        // the same cut, new L / tw: a slider frame
sm.flip(newState, { invQ, before });   // the same surface on the new cut's mesh -> { turn }  (3x3 rotation: old pose -> new pose; identity if cold start)
sm.frame(j) -> {                       // j in [0, 2]: the journey (0 surface, 1 two pillows, 2 open crowns)
  version,                             // changes when triangles / pillow / chains change (then the pane needs setMesh)
  positions,                           // Float32Array, 3 per vertex of the OPEN vertex set (seal copies apart), already moved for j
  triangles, pillow,                   // open vertex ids; 0 | 1 per triangle
  corners,                             // Float64Array, 9 per triangle: each corner's hyperboloid point in the engine's PAIR FRAME (for the print)
  curves: [{ id: 'loop' | 'seal0' | 'seal1', chain, pillow, closed }],     // vertex ids of the open set; at j > 0 the loop is drawn on both pillows' rims
  marks:  [{ id: 'P' | 'Q' | 'R' | 'S', feature, vertex, pillow, pair: 0 | 1 }],
  frame: { center, radius }, kind, exact, degenerate: [bool, bool], stats: { strainMean, strainMax } }
```

World frame: the loop's axis is z, up; the first pair below, its seal along y with the first point at −y
(`pillow.js`). After every cold start, and when drift grows, fit the closed shape back to that frame (best rigid
motion of the loop ring and the four cone points onto their crown places).

### 3.4 `surface-pane.js`, `print3d.js` — OWNER pane

`createSurfacePane(canvas, { labelLayer, … })` with the prototype's API (`setMesh`, `setPositions`, `setOffsets`,
`setPrint`, `setCurves`, `setMarks`, `setFrame`, `setView`, `getView`, `onPick`, `onView`, `render`, `resize`,
`destroy`). Additions: `showFrame(frame)` taking `sm.frame(j)` whole (calls `setMesh` only when `version`
changed), and `turn(rotation, seconds)` for the 0.5 s turn after a flip (a rotation applied to everything, eased
to identity as the model re-poses, or equivalent). Sides: 'tint' with ghost ink 0.11 for pillow 1. Wheel: 'turn'
(his note of 21 Nov: a trackpad swipe turns), and a wheel that is scrolling the page is left to the page.

`print3d.js`: `createPrint3d()` → `{ bake(state, { size }) -> print | null, chartOf(corners) -> Float32Array (2 per
corner) }` per § 1.6. Must run in node for its tests (no DOM in the bake).

### 3.5 `cards.js`, `pattern-glue.js`, `page.js` — OWNER shell

- `createCards(host, { onActivate(key), onInput(key, { L, tw }, { dragging }) })` → `{ update(cards, state) }`. Sliders:
  the shared `createTimeline` or native ranges styled as the siblings'; thumb ≥ 44 px target; keyboard arrows.
- `createPatternGlue(canvas, { tip })` → `{ show(state, { keepView }), still(invQ), reset() }`: builds the model,
  recolours marks by pair, adds the thin seals and loop, and keeps the view on a flip.
- `page.js`: one `state`, one `ui`; every change goes through one `apply(nextState, { flip })` that updates the
  pattern, the cards, the surface model + pane (+ print bake, throttled while dragging), the table and the
  address. One animation frame per change; no work when nothing changed.

## 4. Checks (gates before the page is shown to him)

1. `node --test` in `standalone/pqrs-pillows`: every module's tests (ported from the prototypes' checks: flips
   exact and reversible; pillow geometry; surface closed, Euler 2, stretch bounds on 3333 / 2345 / 2223; the flip
   carry keeps the four cone points; 2222 exact; state and address round trips; the contract test).
2. `tools/check.mjs` on the built page (Playwright + system Chrome, see BRIEF § 4), desktop 1280×900 and phone
   390×844: no console or page error; both panes draw (non-blank); each preset opens; a Twist drag changes the
   surface and the other two cards; activating each card leaves the Pattern pane's pixels unchanged (sampled
   points, tolerance: under 0.5 % of samples differ) while the cards' active state changes; the journey scrubs
   through its three stops; no horizontal overflow; the address restores the state.
3. Pictures looked at by a person or an agent: every preset at three Twists, the journey's three stops, a flip.

## 5. Out of scope for v1 (do not build)

Mirrors, crosscaps, handles, more than four cone points, cusps; dragging on the pattern to change Length or
Twist; a paper net; sound; saving pictures; the twin move as a control (the triangle follows the sliders).
