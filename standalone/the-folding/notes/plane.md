# Plane notes (plane agent, SPEC 5.9) — 2026-11-09

Files: `src/plane.js`, `src/motif.js`, `dev/plane-demo.html`, plus `test/plane.test.js`, `test/motif.test.js`,
`dev/plane-shot.mjs` (= `tools/shot.mjs` after waiting for other browser runs), `dev/plane-final.mjs` (several step
files in ONE Chrome, each at its own devicePixelRatio), `dev/plane-touch.mjs` (real touch, pen and mouse input over
CDP), `dev/plane-probe2.mjs`, `dev/plane-probe3.mjs`, `dev/plane-describe.mjs` (diagnostics), the step files
`dev/plane-steps-*.json` and the pictures in `qa/plane/`. No change is requested in anybody's file; what follows is
what to code against.

## 1. API

```js
import { createPlaneView, assignEdgeColors, edgeMarks } from './plane.js';
import { motifFor, motifInTile } from './motif.js';

const P = createPlaneView(canvas, { onSeed(x, y, phase), hint });
P.setScene({ group, domain, motif, star });   // motif optional (= motifFor(group)); star optional (list of polygons)
P.render();  P.resize();  P.toWorld(cssX, cssY);  P.toCss(x, y);  P.destroy();
P.isDragging();  P.hideHint();  P.stats  /* { ms, copies, glyphs } of the last draw */;  P.getView();  P.debug();

motifFor(group)                    // -> { polylines: [Float32Array(2k)], at: [x, y], radius, angle, closed: [true], info }
motifInTile(group, domain, motif)  // -> [Float32Array(2k), ...] in actual (warped) coordinates
```

- **`onSeed(x, y, phase)`** — `(x, y)` is the new seed in STRAIGHT coordinates (already through `domain.warp.inv`),
  i.e. exactly what `buildDomain(group, { seed: [x, y] })` takes. `phase`: `'start'` (press or key down, the seed is
  unchanged), `'move'`, `'end'`. The view never moves the handle by itself: answer `'move'` with
  `P.setScene({ group, domain: <rebuilt>, … })` and the handle follows. Moves are coalesced to one per animation frame.
- **The seed is reported unclamped.** `buildDomain` pushes it off mirrors and rotation centres; the view keeps
  following the pointer underneath, so the handle waits at a mirror and then jumps across with the tile (the tile cannot
  cross a mirror continuously). Do not feed `domain.seed` back as the next drag origin — you do not need to: just
  rebuild from the `(x, y)` you were given.
- **`setScene` draws on the next animation frame; `render()` draws now.** Either is enough. `resize()` is also called by
  an internal `ResizeObserver` and when `devicePixelRatio` changes, so the integrator need not call it.
- **`star`**: `fold.star` of `src/folds/snowflake.js` fits as it is (`[[x, y], …]` per cell; flat arrays work too). It is
  drawn as a soft accent patch with its outer boundary outlined.
- **`hint`**: default `true` = the view draws "drag to move the cut" (for the four kaleidoscopes: "no cut here: every
  edge is a mirror") in a pill at the bottom until the first drag or arrow key. The shell has the same pill in HTML
  (`#hint`): use ONE — either `#hint.hidden = true` and keep mine, or `createPlaneView(canvas, { hint: false })` and
  hide `#hint` in `onSeed(…, 'move')`. Mine knows about the kaleidoscopes; the HTML one is a real text node.
- **Keyboard**: the canvas gets `tabindex="0"`, `role="application"` and an `aria-label`; arrow keys move the seed by
  7 px (Shift: 28 px) and report start / move / end. Space is not touched (the shell's play shortcut keeps working).
- **Input**: pointer events with capture, `touch-action: none` (set by the view on the canvas), one pointer at a time
  (a second finger is ignored). The drag is relative: press anywhere. No `preventDefault` on the press, so a mouse press
  focuses the canvas natively (no focus ring) and the arrow keys then work.
- **Window**: `P.toCss(group.center) = canvas centre`; scale `min(W, H) / (2 viewHalf)`; a canvas that is not square
  shows more of the pattern on two sides. The handle is kept inside the square window (less its own radius).
- **Sizing**: the backing store follows the canvas's CSS box × devicePixelRatio (capped at 3). While the canvas has
  no CSS box (`display: none`) `resize()` does nothing; it catches up when the canvas shows again.

## 2. Seam colours while dragging — please use `edge.color`, not `edge.cls`

`domain.js` numbers the glue classes in boundary order (first appearance counter-clockwise from the lower left), so
**the same seam gets another `cls` while the seed is dragged**: on a slow circle around the default seed, 9 of the 17
groups relabel at least once (333: 189 of 2000 steps, 22×: 309, 442: 181). Colouring by `classColor(cls)` makes seams
swap colours under the finger, in the plane and in 3D.

`P.setScene` therefore calls `assignEdgeColors(domain, previousDomain)`, which writes on every edge of the domain

- `edge.color` — index into `CLASS_COLORS` (`classColor(edge.color)`); `-1` on mirror edges. A seam (keyed by its gluing
  element or its inverse, `edge.seam`) keeps its colour for as long as it exists; a new seam takes the lowest colour no
  current seam uses. With no previous domain (first scene of a group) `color === cls`, so stills and presets look
  exactly as before.
- `edge.ticks` — the number of chevrons (1–3) on a seam between two different edges, kept the same way; `0` on
  half-turn and mirror edges.

**Integrator:** colour the 3D boundary lines with `classColor(domain.edges[b.edge].color)` (`b` = an entry of
`mesh.boundary`), after `P.setScene(...)` — or call `assignEdgeColors(domain, prevDomain)` yourself right after
`buildDomain` (idempotent; pass `null` on a group change). `test/plane.test.js` checks that colours persist.
**Core agent (optional):** if `buildDomain` took a `prev` domain and kept `cls` stable itself, `edge.color` could go.

`edgeMarks(domain)` gives the chevrons as data (`{ edge, kind: 'chevron' | 'fold', x, y, dx, dy, count, color }`, actual
coordinates), should the 3D view want the same marks: the marks of two sewn edges are exact images of each other under
the gluing, so they meet when the seam closes (tested). Directions are canonical — away from the rotation centre,
counter-clockwise on both edges of a glide seam, along a fixed direction for a translation — so they do not flip.

## 3. The motif

- One closed outline: a comma (half of a yin-yang), 93 points, tilted 19° so it is parallel to no mirror. Chiral and
  with a direction, so translations, rotations, mirrors and glides all show. The plane view fills it (soft ink).
- **It depends on the group only**, not on the seed, the preset or the wave: the pattern is what gets cut. `motifFor`
  is cached per group object (first call 5–25 ms: a search over the default tile).
- Placement (automatic, follows any change of lattice or presets): inside the default preset's tile, clear of its cut
  edges and of the seed handle (so the default picture shows one whole comma in the tile, beside the handle), at
  least `radius / 0.68` from every mirror, 2-fold centre and half the distance to its nearest copy, not crossing any
  glide axis; as large as that allows, capped at `0.19 sqrt(domainArea)` and `0.105 viewHalf`. Where it costs under
  15 % of size it also stays clear of the handle positions of the other presets (not possible for 632 and 4∗2).
- `motifInTile` returns the parts of all copies inside the warped tile: whole copies as closed polylines (last point =
  first), cut copies as open arcs ending on the boundary (bisection, 1e-6 of the step). Their lengths add up to one
  comma for every tile (tested on 17 groups × presets × 14 seeds × amp 0, 1): folded up, the pieces join across the
  seams into one comma. 0.3–1 ms per call.

## 4. What the picture is made of (and two deliberate deviations from the letter of SPEC 5.9)

Bottom to top: white · a 5 % ink tint on every second kind of tile · the snowflake patch · thin grey outlines of all
tile copies · the commas · glide axes (dashed) · mirrors (ink, 2 px) · the current tile (accent fill; cut edges 4.4 px
in their seam colour with chevrons, mirror edges in ink) · rotation centres · the seed handle · the hint.

1. **Rotation glyphs are drawn above the tile's bold edges**, not below: the cone points sit on the tile's boundary and
   a 4 px edge would cover them. The cone points of the current tile are drawn 22 % larger. A half-turn edge's
   midpoint gets its dot as a white disc ringed in the seam's colour, with the 2-fold lens inside.
2. **The tint is fixed in the plane**, not relative to the current tile: a tile is tinted when an odd number of mirror
   lines separates its seed from the motif's base point, times the orientation of the element. For a seed that stays
   in one mirror chamber this IS "the orientation-reversing copies"; when the seed crosses a mirror the tile jumps to
   its mirror image and the tint stays where it was instead of the whole plane flickering.

Also: the glyphs are oriented so that the whole field of glyphs is invariant under the group (a glyph on mirrors has
its vertices on them; `glyphOrientation`, tested), sizes follow the canvas (edges 2.9–4.9 px, glyphs 3.3–4.9 px
"radius"), dense patterns on small canvases get thinner mirrors (down to 1.3 px) and fainter glide axes, and the
handle is the SPEC's 14 px dot except on a tile whose inscribed circle has a radius under 17 px (the small tiles on
a phone: 632, 3∗3, 4∗2, ∗442, ∗632, ∗×: 12–13 px).
A stroke of exactly one device pixel is rendered as a beaded hairline by Chrome when the path has many short
segments (wavy outlines at dpr 1), so the outlines are 1.1 px.

## 5. For other owners (nothing blocking)

- **Integrator**: §1 and §2. `P.stats.ms` is the cost of a frame: 0.1–0.7 ms while dragging at 624 × 552 (the motif,
  mirrors and glide axes are cached in an offscreen canvas per group and size), 3–20 ms for the first frame of a
  group. Measured in headless Chrome on this Mac: `buildDomain` + `setScene` + `render` 0.55 ms per move for 333,
  2 ms for ∗632 including the snowflake fold's `createFold` for the star.
- **Shell agent**: the hint, §1. On a phone the plane is 226 px square and everything was checked at that size.
- **Snowflake agent**: thank you for `viewHalf: 0.85` on ∗632 — the phone picture went from 28 px tiles to 36 px.
  The demo page outlines `fold.star` of the real `src/folds/snowflake.js` (with a stand-in if it fails to load).
- **Roll agent** (FYI): ∗× is a 1.6 × 0.32 strip, 145 × 29 px on a phone; the 14 px handle fills two thirds of its
  height and the commas are 11 px. It reads, but it is the tightest of the cut groups.

## 6. Checked, and how

- `node --test test/plane.test.js test/motif.test.js` — window mapping, relative drag (mouse / touch / pen events,
  capture, cancel, a second pointer), clamp to the window, no sticking at a mirror with a live rebuild, keyboard,
  hint, seam colours (fresh = cls, persistent under 500-step walks in all 17 groups), chevrons = images under the
  gluing (position and direction, amp 0 and 1), glyph field invariance, tint invariance under a mirror crossing,
  every group / preset / amp draws with finite numbers and covers the canvas with tiles, the comma is chiral, the motif
  is generic, `motifInTile` adds up to one comma.
- `dev/plane-demo.html` (`?g=&preset=&amp=`, `?sheet=1`, `&pane=226x226`, `&pieces=1`, `&bare=1`; `window.__demo`) with
  `tools/shot.mjs`: contact sheets, single views, phone sizes, real mouse drags. Step files: `dev/plane-steps-*.json`.
- `node dev/plane-touch.mjs --marker tools/shot.mjs` — Chrome's touch emulation on a 390 × 780 mobile viewport, the
  plane 224 px square on a page made scrollable: a finger from a corner of the canvas (seed moves by exactly the
  finger's displacement, tile changes), no scroll and no zoom, tracking outside the canvas, the wall of the window
  and the immediate return, a second finger ignored, a pen, a mouse, an arrow key, no `pointercancel`. 17 of 17.
- `node dev/plane-final.mjs --marker tools/shot.mjs "dev/plane-demo.html?bare=1@1:dev/plane-steps-final.json"
  "dev/plane-demo.html@2:dev/plane-steps-final-phone.json"` — all the pictures in `qa/plane/` in one Chrome
  (log: `qa/plane/final-run.log`).

## 7. Not verified / known limits

- **No real phone and no Safari / Firefox**: Chrome only (desktop, and its touch + mobile emulation). The code uses
  pointer events, `setPointerCapture`, `touch-action: none`, `ResizeObserver`, `ctx.setLineDash`,
  `quadraticCurveTo` — nothing exotic, but it has not been seen in WebKit.
- **Not run inside the app**: `src/app.js` did not exist yet. `dev/plane-demo.html` plays the app's part (it
  rebuilds the domain on every `onSeed`).
- On a phone (226 px) the densest pictures are tight: ∗632 has 36 px tiles and 10 px commas, ∗× is a 145 × 29 px
  strip, and the 12–14 px handle covers a third of the small triangular tiles (632, 3∗3, 4∗2). They read, but the
  handedness of the commas is easier to see on a laptop.
- The comma avoids the seed handle of the default preset in all 17 groups, and of the other presets except in 632
  and 4∗2, where the handle of the second and third preset sits partly on a comma.
- When the seed sits at the window's edge, part of the tile is outside the canvas (only the seed is kept inside).
- This Mac pauses headless browsers for up to 30 minutes when it runs hot (the owner's load guard). Every picture in
  `qa/plane/` is from the final code (one run of `dev/plane-final.mjs`, one of `dev/plane-touch.mjs`, one of
  `tools/shot.mjs` for the two `url-*.png`).

## 8. What the default picture of each group shows (2026-11-09, `node dev/plane-describe.mjs` regenerates the facts)

Every default tile holds one whole comma beside the seed handle. › = number of chevrons on a seam.

| group | default cut | the tile |
|---|---|---|
| ○ p1 | Parallelogram | slanted quadrilateral; blue › and orange ›› translation seams; the pattern is commas only |
| 2222 p2 | Envelope | hexagon; four half-turn edges (blue, orange, sky, brown), each folded at a ringed lens at its midpoint; a short purple › translation pair |
| ∗∗ pm | Strip | rectangle between two mirrors (ink, top and bottom); blue › translation ends; mirrored commas face each other |
| ×× pg | Rectangle | blue › translation sides; orange ›› glide ends whose chevrons run the same way round (Klein bottle); dashed glide axes |
| ∗× cm | Strip | thin strip between two mirrors (ink); blue › glide ends running the same way round (Möbius band); a dashed glide axis down the middle |
| 333 p3 | Rhombus | blue › and orange ›› seams, each a 3-fold rotation about the corner where its two edges meet; ▲ at all four corners |
| 22× pgg | Rectangle | lenses at the four corners; blue › and orange ›› glide seams (both pairs run the same way round) |
| 22∗ pmg | Pillowcase | ink mirror base; blue half-turn top edge with its ringed lens; orange › translation sides |
| ∗2222 pmm | The only tile | rectangle, four ink mirror edges, lenses at the corners; the star of four tiles outlined in accent |
| 2∗22 cmm | Pocket | three ink mirror edges; one blue half-turn edge with its ringed lens |
| 442 p4 | Square | blue › and orange ›› seams about the two 4-fold corners (■); lenses at the other two corners |
| 632 p6 | Triangle | flat triangle between two 6-fold centres (hexagons) and a 3-fold apex (▲): blue › seam about the apex, orange half-turn base with its ringed lens |
| 3∗3 p31m | Triangle | ink mirror base; blue › seam about the 3-fold apex |
| ∗333 p3m1 | The only tile | equilateral triangle, all ink; the star of six outlined |
| 4∗2 p4g | Triangle | ink mirror hypotenuse; blue › seam about the 4-fold corner (■) |
| ∗442 p4m | The only tile | right triangle, all ink; the star of eight outlined |
| ∗632 p6m | The only tile | 30-60-90 triangle, all ink; the star of twelve outlined |

## 9. State of `node --test` when this was written (2026-11-09 16:52)

500 tests, 488 pass, 1 skipped, 11 fail. `test/plane.test.js` (17) and `test/motif.test.js` (7) pass. The 11 failures
are in `test/verify-topology.test.js` (9: `Domain.conePoints` lists a rotation centre 1e-8 outside the tile for seeds
within 1e-7 of a degenerate position) and `test/verify-robust.test.js` (2: parity areas of the 22× mesh, a non-finite
seed): the verifier's tests of `src/domain.js` / `src/mesh.js`. Nothing in them touches `plane.js` or `motif.js`.
