# Shell notes (shell agent, SPEC 5.11)

Files: `src/index.template.html`, `src/styles.css`, `src/timeline.js`, `build.mjs`, `dev/shell-demo.html`,
`dev/shell-stub.js` (stand-in for `src/app.js`), `dev/shell-frame.html`, `dev/shell-render-check.html`,
`dev/shell-shot.mjs`, `dev/shell-verify.mjs`, `dev/shell-touch.mjs`, `test/timeline.test.js`, `test/shell.test.js`.

## 1. DOM contract (for `src/app.js`)

Stable ids. The app fills or wires the ones marked APP; the timeline owns the ones marked TIMELINE; everything else in
the markup may change. The same table is in the comment at the top of `src/index.template.html`.

| id | element | who | what |
|---|---|---|---|
| `app` | div, the root grid | – | optional `data-cut="under"` (see §3) |
| `chip` | button | APP | `click` → `picker.open(groupId)` |
| `chip-symbol` | span in the chip | APP | `textContent = group.label` |
| `chip-meta` | span in the chip | APP | `textContent = group.hm + ' · ' + group.shape` (ellipsis when it cannot fit) |
| `caption` | p | APP | `textContent = group.topology`; one line, two lines reserved below 540 px |
| `stage` | main | – | panes + controls; carries `data-ss-thumb` |
| `pane-plane` | section | – | positioned box of the 2D view; `data-ss-comments="off"` |
| `plane-canvas` | canvas | APP | `createPlaneView(canvas, …)` |
| `hint` | p in the plane pane | APP | "drag to move the cut"; set `hint.hidden = true` at the first drag |
| `plane-controls` | div | – | the cut controls |
| `presets` | div | APP | one `<button type="button" class="chip" aria-pressed="true\|false">name</button>` per preset |
| `wavy` | input range 0..1, step 0.01 | APP | `input` event → `amp = Number(wavy.value)`; call `enhanceRange(wavy)` once |
| `pane-fold` | section | – | positioned box of the 3D view; `data-ss-comments="off"` |
| `fold-canvas` | canvas | APP | `createRenderer(canvas, { labelLayer: fold-labels })` |
| `fold-labels` | div | APP | the renderer's label layer: covers the canvas exactly, `pointer-events: none` |
| `fold-controls` | div | – | |
| `fold-btn` | button | TIMELINE | `createTimeline({ button })`; its `[data-label]` child reads Fold / Pause / Unfold |
| `scrubber` | input range | TIMELINE | `createTimeline({ slider })`; never set its value yourself, use `timeline.set(t)` |
| `reset-view` | button | APP | `click` → `renderer.resetView()` |
| `legend` | footer | – | static legend line + companion link |
| `picker-mount` | div, last in body | APP | `createHassePicker({ mount })` |

Details that matter:

- **Canvases.** CSS makes each canvas fill its pane (`position: absolute; inset: 0`), so the backing-store size can
  never push the layout. Size the backing store from `clientWidth / clientHeight` (`render3d.js` observes its canvas
  itself; call `plane.resize()` from a `ResizeObserver` on `#stage` or on `resize`). Canvas CSS size = pane − 2 px
  (hairline border).
- **The panes only change size when the window does.** Caption, control rows and legend have fixed heights per
  layout, so switching groups never resizes a canvas.
- **Preset chips**: any `button.chip`; `aria-pressed="true"` (or `aria-checked="true"`, or class `is-on`) draws the
  selected state; leave all `false` while the seed is a custom drag. `disabled` greys a chip. Chips that do not fit
  their row shrink with an ellipsis down to 44 px, then the row scrolls sideways; in the phone column a fourth and
  fifth chip scroll vertically.
- **Wavy**: plain range input, value 0..1 in steps of 0.01. `enhanceRange(document.getElementById('wavy'))` (exported
  by `src/timeline.js`) makes the whole 44 px box draggable — without it iOS Safari only drags from the thumb. It
  still fires ordinary `input` / `change` events. To set it from code, assign `wavy.value`. `wavy.disabled = true`
  greys it (kaleidoscopes, where the wave cannot do anything).
- **Hint**: if `plane.js` draws its own hint, set `#hint.hidden = true` at start so there are not two. Any extra hint
  can reuse the class: `<p class="hint">…</p>` inside a pane.
- **Label layer**: `.labels > *` are `position: absolute; left: 0; top: 0` — compatible with `render3d.js`
  (`span.r3d-label`, placed by `transform`). The renderer's "WebGL2 unavailable" message also lands here.
- **Picker mount**: an empty, unstyled, zero-height div after `.app`. `<body>` is the positioned box covering exactly
  the viewport, so the dialog may be `position: fixed` (as `hasse.js` is) or `position: absolute; inset: 0`. `.app` is
  its own stacking context (`isolation: isolate`), so nothing in the app can paint above the dialog. All element-level
  CSS of the shell is scoped to `.app` with `:where()`: it does not reach into the dialog.
- **`[hidden]`** always hides (`display: none !important`).
- Colours are CSS variables on `:root` mirroring `src/palette.js` (`--ink`, `--muted`, `--faint`, `--hairline`,
  `--card`, `--ground`, `--accent`, `--accent-soft`, `--class-0…7`, `--mirror`, `--crease`, `--glide`, `--motif`).
  **Kept in sync by hand**; `test/shell.test.js` fails when they drift.

Sketch:

```js
import { createTimeline, enhanceRange } from './timeline.js';
const $ = (id) => document.getElementById(id);
const timeline = createTimeline({ slider: $('scrubber'), button: $('fold-btn'), onChange: (t) => { state.t = t; draw(); } });
enhanceRange($('wavy'));
$('wavy').addEventListener('input', () => setAmp(Number($('wavy').value)));
$('chip').addEventListener('click', () => picker.open(state.groupId));
$('reset-view').addEventListener('click', () => renderer.resetView());
// group / preset / seed / amp change:  timeline.setStops(fold.stops); timeline.setDuration(fold.duration);
// group change also:                   timeline.set(0);
// __folding.setT(t):                   timeline.set(t); state.t = timeline.get(); draw();
```

## 2. `src/timeline.js`

```js
createTimeline({ slider, button, onChange, onState? }) -> { setStops, setDuration, set, get, play, stop, isPlaying, toggle, getStops, destroy }
enhanceRange(input) -> undo()        positionToTime(p, ts)   timeToPosition(t, ts)   stopTimes(stops)   normalizeStops(stops)   easePlay(x)
```

- **`onChange(t)` is called only for what the person or the playback does**: scrubbing, keys, every animation frame,
  and a last exact frame (`t === target`, so `t === 1` or `0` exactly at the ends). **`set()`, `setStops()` and
  `setDuration()` are silent** — the caller redraws itself. `get()` is always the current t.
- `set(t)` stops playback. `setStops` keeps t (the thumb moves to where that t now lives) and does not interrupt
  playback, so it is safe to call on every rebuild while the seed is dragged. Stops are cleaned (sorted, clamped,
  0 and 1 added).
- **Soft detent** exactly as SPEC 5.11: thumb position p ≠ t. Outside ±3.5 % of the track around a stop, t = p.
  Inside, `t − s = sign(d) · w · (|d|/w)^1.6` with `w = 0.035`: the stop is a fixed point with slope 0, t is
  continuous and strictly monotonic everywhere, the thumb is never moved for the person. Zones of stops closer than
  7 % are cut at the midpoint. The slope steps from 1.6 to 1 at a zone's edge (continuous, not C1) — that is the
  formula; it is not perceptible while dragging.
- **Button**: idle it reads `Fold` (or `Unfold` once t = 1); while animating it reads `Pause`; pausing keeps the
  direction (paused while unfolding → `Unfold` continues), a manual scrub sets it back to `Fold` unless at the end.
  `button.dataset.state` = `fold | pause | unfold`. Custom words: `createTimeline({ labels: { fold, unfold, pause } })`.
  Optional `onState(state)` is called whenever that state changes (`pause` = it is playing), e.g. to know that
  playback was paused, which `onChange` does not tell.
- **Playback**: from the current t to the target in `duration × |target − t|` seconds (at least 0.35 s), constant
  speed with an eased first and last 18 %. A stalled frame advances at most 0.1 s of motion, so returning to a hidden
  tab never jumps. Touching the slider (pointerdown, before any movement) stops playback.
- **Keys**: on the slider — arrows ±1 % of the track (Shift: ±10 %), Home / End, PageUp / PageDown to the next /
  previous stop, Space = play / pause. Anywhere else Space also toggles (on the canvases, on the Wavy slider, with
  nothing focused), **except** when the focus is in a button, link, text field, a `role=dialog` / `dialog`, or while
  a visible `[aria-modal="true"]` / `dialog[open]` exists (so Space in the picker belongs to the picker). The 3D
  canvas's own keys (arrows, + −, Home) are untouched.
- **Pointer**: when the slider sits in a `[data-scrub]` wrapper (it does in the template), the wrapper takes the
  pointer: press anywhere in the 44 px box → the thumb goes there and drags; press on the thumb → it drags without a
  jump; pointer capture + `touch-action: none`. The input keeps focus, keyboard and accessibility, and still gets
  `input` / `change` events. The wrapper gets `--p` (0..1, drives the accent fill); ticks are `<i>` children of its
  `[data-ticks]` element.

## 3. Layout

One page, `100dvh` (fallback `100vh`), nothing scrolls. Page grid: header 48 px / caption / stage / legend.

| window | panes | cut controls | notes |
|---|---|---|---|
| wider than tall | side by side, equal | one row under the plane | below 480 px of height the caption moves up beside the header |
| taller than wide, ≥ 600 px wide | stacked, 4 : 5 | one row under the plane | |
| taller than wide, < 600 px wide (phones) | stacked | **beside** a square plane | chips in a column, Wavy under them |
| the same, but narrower than 9 : 20, or `data-cut="under"` | stacked, 4 : 5 | under the plane, two rows below 420 px | |

**Deviation from the letter of SPEC 5.11, on purpose.** The SPEC puts the presets and the Wavy slider *under* the
plane. On a phone they do not fit one row (three chips are up to 290 px, the slider needs ~100), so "under" costs two
44 px rows. The plane's window is square anyway, so on phones the plane pane is a square and its controls stand in
the column to its right. Measured on the same stub:

| viewport | beside (default): plane, fold | under (`data-cut="under"`): plane, fold |
|---|---|---|
| 390 × 780 | 226 × 226, 366 × 358 | 366 × 216, 366 × 270 |
| 360 × 640 | 178 × 178, 336 × 266 | 336 × 154, 336 × 192 |

The fold gets a third more height and the plane's square is no smaller. To go back to the letter of the SPEC set
`<div class="app" id="app" data-cut="under">` — nothing else changes.

Measured pane sizes (CSS px, canvas = pane − 2): 1280×720 → 624 × 552 each; 1440×900 → 704 × 732 each;
390×780 → plane 226², fold 366 × 358; 360×640 → plane 178², fold 336 × 266; 390×690 (a phone under the host bar and
the browser's bars) → 198², 366 × 296; 320×568 → 176², 296 × 196; 768×1024 → 744 × 349 and 744 × 436;
844×390 → 406 × 237 each; inside an iframe under a 50 px bar at 1280×720 → 624 × 502 each.

Other decisions:
- Tap targets: every button's own box is 44 px high (the visible pill is 36 or 40 px inside a transparent border), the
  sliders' boxes are 44 px, the companion link is a 44 px high box. Inputs are 16 px.
- The legend is one line from 880 px up; below, a three-row key (swatch + meaning) with the companion link at its
  right. Wording is the SPEC's.
- "Reset view" shows icon + words when the fold controls are ≥ 460 px wide, otherwise the arrow over the word "view"
  (an arrow alone, next to a play button, reads as "replay").
- "Wavy" is written beside its slider when the cut controls are ≥ 480 px wide, otherwise small above the slider's
  left end (the slider's box stays 44 px). In a row the slider takes what the chips leave (150 – 250 px, or from
  96 px in the compact form); the chips are only squeezed when it is at its minimum.
- Hover styles are feedback only and are disabled on touch screens (`@media (hover: hover)`).

## 4. `build.mjs`

```
node build.mjs [--entry src/app.js] [--out dist/index.html] [--template …] [--css …] [--target es2020] [--no-minify] [--allow-url <prefix>]
```
`npx --yes esbuild <entry> --bundle --format=iife --minify` and `npx --yes esbuild <css> --minify`, both inlined into the
template (HTML comments stripped; `</script`, `</style`, `<!--` escaped; replacement by function, so `$&` in minified
code is safe). It then refuses to write the file unless: one `<script>` and one `<style>`, no `<link>`/`src=`/`@import`/
`url()`, and **no URL at all except the companion link**. XML namespace names (`http://www.w3.org/2000/svg`, …) are
let through; anything else needs `--allow-url`. Paths are relative to the workspace root, wherever it is run from.

Stub build (`node build.mjs --entry dev/shell-stub.js --out qa/shell/index.html`): 40 345 bytes
(HTML shell 3.5 kB, CSS 11.8 kB from 20.9 kB of source, JS 24.2 kB — the stub bundles `groups.js` and its data),
13.7 kB gzipped. The shell's own share of any build: markup 3.5 kB + CSS 11.8 kB + `timeline.js` 7.7 kB minified.

## 5. Checking it

- `node --test` — `test/timeline.test.js` (mapping: continuous, strictly monotonic, identity far from stops,
  flattened near stops with the 1.6 law, exact at 0, 1 and every stop, inverse; controller with fake elements and a
  fake clock) and `test/shell.test.js` (DOM contract, placeholders, platform rules, palette mirror, no stray colour /
  gradient / shadow / `position: fixed`).
- `dev/shell-demo.html` — the shell unbundled; it takes its markup from the template at load time. `#<id>` picks the
  group, the chip steps to the next one. `window.__shell.measure()` reports scroll, pane sizes, tap targets under
  44 px, overlaps, anything outside the window, clipped text; `__shell.sweep()` does that for all 17 groups.
- `node dev/shell-verify.mjs` — the layout acceptance check on the built stub: every size of
  `qa/shell-steps-1.json` (1280×720, 1440×900, 390×780, 360×640 and four more), all 17 groups; fails on a scroll, a
  pane in the wrong place or under 120 px, a tap target under 44 px, an overlap, anything outside the window, cut text.
- `node dev/shell-shot.mjs …` = `tools/shot.mjs` after waiting for other agents' browser runs.
- `dev/shell-frame.html` — the built stub in a (sandboxed) iframe under a 50 px bar, as spacesheep hosts it.
- `dev/shell-render-check.html` — the real `src/render3d.js` mounted in `#fold-canvas` / `#fold-labels` and driven by
  the real timeline (a stand-in surface: a strip rolling into a tube). Checked at 1280×720 and 390×780: WebGL2 up,
  backing store = CSS box × dpr (622 × 550, 364 × 356), no GL error, labels inside the pane and on their markers,
  drag-rotate, reset view, Fold to t = 1 (the two seam labels coincide). `qa/shell-render-*.png`.
- `node dev/shell-touch.mjs --marker tools/shot.mjs` — the built stub under Chrome's touch emulation (390×780,
  mobile): finger drags on both sliders, taps, the detent, pointer capture, no scroll / zoom / cancelled gesture.
- Step files and screenshots: `qa/shell-steps-*.json`, `qa/shell-*.png`.

## 6. For other owners (nothing blocking)

- **Integrator**: §1 sketch. Please keep `data-ss-*` attributes and the companion link as they are.
- **Plane agent**: the shell already shows the "drag to move the cut" hint as `#hint` (HTML, above the canvas,
  `pointer-events: none`). If the plane view draws one too, one of the two should go (integrator: `#hint.hidden = true`).
  On phones the plane canvas is an exact square (176 – 250 px); elsewhere it is wider or taller than square.
- **Hasse agent**: nothing needed. The global Space shortcut stands down while your dialog is open.
- **Renderer agent**: nothing needed; your label defaults win over the layer's inherited ones.

## 7. Not verified / known limits

- **No real iPhone or Safari run.** Only Chrome (desktop metrics and its touch + mobile emulation). WebKit is not
  installed for Playwright on this Mac. The CSS uses `dvh`, container queries (with an `@supports` fallback),
  `:where()`, `:has()` (cosmetic only), flex `gap`, `inset`; range thumbs are styled through
  `::-webkit-slider-thumb` / `::-moz-range-thumb`.
- **Not run with the real app**: `src/app.js`, `src/plane.js` and the fold modules did not exist yet. What has been
  mounted in the shell: the stub's placeholder canvases, the real renderer (smoke test, §5) and — by the hasse agent,
  `dev/hasse-in-shell.html` — the real picker.
- `data-ss-thumb` sits on `#stage` (both panes and their controls), my reading of "the main stage". If the thumbnail
  should be the 3D picture alone, move the attribute to `#pane-fold`.
- The button reads `Pause` while it animates. SPEC 5.11 names only Fold / Unfold; pausing is how "Space toggles
  play" was read. `labels: { pause: … }` changes the word.
- If the app does not call `enhanceRange(wavy)`, the Wavy slider still works natively, but in its compact form
  (label above the slider, phones) the native input's own box is only 34 px high and iOS drags it from the thumb only.
- 320 px wide: the chip's `hm · shape` ends in an ellipsis for the three longest (2∗22, ∗333, ∗632). From 360 px
  everything fits with the system font here; a wider system font may clip ∗333 / ∗632 at 360.
- Landscape windows narrower than ~760 px (small phones on their side): three long preset chips do not fit beside the
  Wavy slider; the chips then shrink together and their names end in an ellipsis ("Parallel…", "Sla…", "Hex…" at
  667 × 375). All stay visible and tappable; a `title` on each chip would be a cheap addition by the app.
- Below 540 px the caption always reserves two lines; at 390 px only 3∗3 and 4∗2 use the second one, so for the
  other groups there is an empty 17 px line under the caption. A caption longer than two lines there (about 110
  characters) would be cut with an ellipsis.
- The `<a>` of the companion link is a 44 px high box whose text sits in a 16 px content box; its keyboard focus is
  shown as a tint and a thicker underline on the text rather than a ring around the whole box.
