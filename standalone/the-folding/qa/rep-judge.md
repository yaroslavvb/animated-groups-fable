# Replication step: the judge's decision

Tue 10 Nov 2026. The owner's ask (today): "Also, add another step where it actually shows how the tiling and
replication is done."

## Decision: A, "replication in the plane", ported as it is

The patch is `qa/rep-a/rep-a.diff` (+935 / −32). It adds a Tile button in the plane pane, a scrubber of its own, the
words for what acts, and one URL key, `tile=<u>`. Nothing is taken from B.

How the step works:
- The copies of the tile grow out of the tile across its own edges, breadth first by word length in the side
  pairings `domain.edges[i].g`. By Poincaré's theorem these generate G.
- Each copy reaches h·g_i(D) by the continuous motion h∘m_i(s) of its side pairing:
  - a turn about the centre;
  - a slide;
  - a flip over the mirror line, seen from above;
  - a half screw along the glide axis.

## Why

| | A — in the plane | B — paper tiles in 3D, before the fold |
|---|---|---|
| **Does it show how** | The first layer takes one side pairing at a time and names it ("half-turn about a 2-fold centre", "rotations by ±2π/3 about a 3-fold centre", "reflection in a mirror", "glide reflections", "translations"). A ring marks the centre and a dashed line the glide axis. The moving copy carries its seam colours, so edge j visibly lands on the same-coloured edge i: the element that glues two edges in the Fold is the element that makes the neighbour. | The first wave shows the same elements one after another, as paper turning over or spinning in 3D. Nothing names them; only a glide's axis is drawn. |
| **Every group** | All 17, from the tile itself. The kaleidoscopes grow by reflections in the tile's own mirrors. | The kaleidoscopes grow from the star, so their tile's own reflections are never shown. 632 and 3\*3 get no zoom-out, and their first copies leave the pane. A turned camera shows the edge of the finite patch. |
| **Where** | The tiling lives in the plane. The step ends exactly on the plane as always. | A second tiling is built in the 3D pane, then faded again before the fold. At the hold, both panes show a tiling. |
| **Calm** | Opaque cards. Layer 1 is calm; later layers bloom, about a second each, 4.2 s at most in all. | Translucent sheets overlap in perspective. Every wave starts with a stack, and the \*632 star flips are 4 tiles wide. |
| **Smooth** (timed by the judge on real plays, 1280x720, DPR 2) | 60 fps; 0–2 frames over 34 ms per play; progress never goes backwards. My pop profile of 6 more groups found no pop. | 60 fps; 0 frames over 34 ms. The swaps change 0.05–0.75 levels (B's own numbers). |
| **Exact** | Tested: every copy is in G, equals parent∘g and lands on exactly that element; each window tile is planned once. | Tested: every copy is in G; 284 cuts × 2100 points each lie in exactly one copy. |
| **Fit** | Additive: one quiet pill, a scrubber only while the step is under way, one key. The Fold, its scrubber, `t` and every test but one pin are unchanged. **The patch applies cleanly to today's src: 711 tests, 707 pass, and the one real failure is the pin.** | Every group's first Fold gets 3.5–5.5 s longer (8–12 s to the closed shape). The thumb becomes τ. Contracts change in five owners' files: renderer alpha, timeline setRest, plane setLit, app τ, and 6 qa-matrix checks. |

The owner asked to see how the tiling is *done*, and A makes the elements visible as elements: named, placed and
seen to glue edge to edge. B makes the paper vivid but leaves the reader to infer the element, and it charges the
Fold, his main action, with the cost. He wants "just the most important parts".

**Weak spots accepted**

- **The later layers bloom.** In 2222 at u = 0.8, 8 cards are in flight with full seam colours, and up to about 20 in
  the larger groups. It is continuous and short; the explanation is layer 1.
- **On a phone the step plays in the small pane.** The plane is about 225 px and its bar and words cover about a
  third; the big 3D pane is idle.
- **The plane as always is drawn from two cached layers.** It differs from shipped by at most 36 levels in at most
  70 px per group, and costs +5.5 MB on a laptop.
- **The first press of Tile fades the full tiling down to the tile** (0.35 s) before the copies are made again.

## Port plan (owners as in SPEC 8)

| Owner | Files | What |
|---|---|---|
| plane | `src/plane.js`, new `src/replicate.js`, new `test/replicate.test.js` | The plane.js hunk of the diff and replicate.js as they are. The test is `dev/rep-a/replicate.test.mjs` with every `./src/` import re-pathed to `../src/`, the dynamic `import('./src/app.js')` too. Document `setTiling(u, fade)`, `getTiling()`, `tilingPlan()`, `tilingCaption(u)`, `setTilingTiming(t)` and the option `onTilingPlan` at the top of plane.js (a C2 addition). |
| ui-layout | `src/index.template.html`, `src/styles.css` | The template hunk (#tile-caption, #tile-bar, #tile-btn, #tile-scrub / #tile-slider, the DOM-contract comment) and the one CSS block at the end. |
| ui-app | `src/app.js`, `test/app-url.test.js`, `tools/qa-matrix.mjs` | The app.js hunk. The HASH_KEYS pin becomes `['g','cut','seed','wavy','tile','t','view']`, with round-trip cases for tile. dev/rep-a/check-ui.mjs's 23 checks go into qa-matrix `--interact`, through tools/browser.mjs. |
| orchestrator | `SPEC.md` | SPEC 7's URL format gains `tile=<0..1>` between wavy and t: 3 decimals, absent at 1 (tiled), removed on completion and on a group change, throttled like t. SPEC 9 records the step and the plane API. |
| integrator | `dist/` | Build, then run the checks below on the built page, and look at the films. |

Keep src/folds/crosscap.js and src/groupdata/motif.js as they are now: the diff does not touch them.
`dev/rep-judge/port-check.mjs <dir>` builds a throwaway copy with the patch applied for a dry run.

## Acceptance

1. **The patch.** It applies to the current src with no fuzz. Afterwards app.js, plane.js, index.template.html,
   styles.css and replicate.js equal dev/rep-a/src's.
2. **The tests.** `node tools/test-all.mjs` is green with exactly one edited assertion (the HASH_KEYS pin) and the
   new test/replicate.test.js.
3. **The URL.**
   - `#g=2222&tile=0.178` and `#g=%2A632&tile=0.25` open paused at that u, with the bar open and the right words.
   - Pause writes `tile=` at once; completion and a group change remove it.
   - Links without tile, and the legacy `#333`, `#4*2`, `#*632`, are unchanged. A malformed tile is dropped, and
     WRAPPER_HASH matches.
   - dev/ui3-url-loop.mjs passes on dist.
4. **The controls,** on the built page at 1280x720 and at 390x780 with touch.
   - The 23 checks pass with 0 console or page errors.
   - Space plays the Fold, not the tiling.
   - qa-matrix `--interact` is 70/70, plus the new Tile checks.
5. **The look.** In films of the built page (333, 2222, \*632, 4\*2, xx, 22x; laptop and phone):
   - layer 1 shows one side pairing at a time, with its words and its ring or dashed axis;
   - the moving copy's edge lands on the same-coloured edge;
   - the last frame is the plane as always.
6. **The pixels.** Use a fresh page per group and at most 2 readbacks per comparison (see the false alarm below).
   - At u = 1 the plane differs from the current src's plane without the port by at most 36 levels in at most 70 px
     per group, at both sizes. Do not compare with today's dist: it predates the 08:08 comma table.
   - The last frame (u = 1 − 1e-6) against u = 1: at most 16 levels, with at most 15 px over 8, for 14 groups. For
     3\*3, \*333 and \*632, at most 60 levels in at most 110 isolated px.
7. **The smoothness.** On real Tile plays:
   - u is monotone, the median frame is 16.7 ms, and a play has at most 2 frames over 34 ms;
   - a 400-step pop profile (333, 2222, \*632, 4\*2, xx, 22x, 632, \*\*; both sizes) flags only the motion of copies,
     never an isolated step at the replay start, at a phase boundary or at u → 1.
8. **The build.** dist/index.html stays one self-contained file, and its size is reported.

## Rejected

- **B, paper tiles in 3D before the fold** (reasons above).
- **The replication as the first segment of the Fold scrubber.** The default state would sit mid-track, t would
  change its meaning in every link and test, and the eye would jump between panes.
- **Both at once, A's plane with B's 3D paper.** Two panes would animate the same growth: "too much stuff".
- **B's sweep inside a wave, to calm A's later layers.** It orders the starts, but with a stagger of 0.5 or less every
  copy of a layer is still in flight at mid-layer, so the bloom stays.
- **Lighter cards or shorter later layers now.** That is untested polish. The knobs (REP_TIMING, drawCard) are there
  if the owner finds the bloom busy.

---

## Log (as I went)

### 08:25 — read

SPEC.md (all of it, §§ 1–9), notes/integrator-final.md, qa/fill-judge.md, qa/rep-a/NOTES.md, qa/rep-b/NOTES.md, both
`replicate.js`, A's diff (plane.js, app.js, template, styles) and B's (app.js, render3d.js, timeline.js, plane.js,
styles). Both copies of src predate the cross-cap fixer's 08:08–08:11 edits (src/folds/crosscap.js,
src/groupdata/motif.js); neither prototype touches those files, so both port onto the current src without a conflict
there.

Looked at, before making any picture of my own:
- A: film-{333,2222,s632,4s2,xx,22x}-laptop.png, film-333-phone.png, ui/laptop-{1-default,3-playing,4-paused,
  8-link-s632-025}.png, ui/phone-4-paused.png, base-laptop-s632.png.
- B: final-{333,s632,4s2}-laptop-fold.png, final-333-phone-page.png, film-22x-wave1-laptop.png,
  still-{333-laptop-rep042,4s2-laptop-rep016}.png, controls-{laptop,phone}-playing-step.png.

First reading:
- A's first layer is the explanation: one side pairing at a time, named in the pill ("half-turn about a 2-fold centre",
  "rotations by ±2π/3 about a 3-fold centre", "reflection in a mirror", "glide reflections", "translations"), a ring on
  the centre it turns about, the copy carrying its seam colours onto the same-coloured edge. Later layers are a bloom
  (2222 u = 0.8, 4*2 u = 0.47–0.53, 22x u = 0.53–0.67: up to ~20 opaque cards in flight).
- A's *632 at u = 0.933 has no star wash and at u = 1 has it: checked in the code, the star fades in over the last
  settle (endK = smoothstep over 0.55 s), not a pop.
- B shows the same growth in the 3D pane, in perspective, on translucent paper: the physical turn-over reads, but the
  overlapping translucent sheets of a wave are busy (333 rep 0.31, 22x 0.33, 4*2 0.16), nothing names the element, and
  the kaleidoscopes grow from the star, not from the tile.

### 08:30 — my own films of the groups neither designer filmed (tools/browser.mjs, the project pool on the mini)

Scripts in `dev/rep-judge/` (film-a.mjs and job files; B's own dev/rep-b/film.mjs with my jobs). Pictures in
`qa/rep-judge/`. LOOKED AT all of them.
- A, laptop: `a-632-laptop.png` (layer 1: "rotations by ±2π/3 about a 3-fold centre", then "half-turn about a 2-fold
  centre"; the 6-fold centre is not a side pairing of this tile, it appears as a vertex cycle in later layers —
  correct, and the words do not claim otherwise), `a-3s3-laptop.png`, `a-o-laptop.png` (translations only, the
  calmest), `a-sx-laptop.png`, `a-2s22-laptop.png`. Every first layer reads, one side pairing at a time.
- A, phone (390x780, DPR 2): `a-632-phone.png`, `a-s442-phone.png`, `a-442-phone.png`, stills `a-333-u010-phone.png`,
  `a-4s2-u050-phone.png`. The plane is about 225 css px; the zoom for small panes (SPEC 9) shows few copies, the bar
  and the words take about a third of it; layer 1 still reads. The big 3D pane below is idle.
- A, full-size stills of the bloom: `a-2222-u080-plane.png` (8 cards in flight with full seam colours),
  `a-22x-u055-plane.png`, `a-4s2-u050-page.png`, `a-632-u045-plane.png`; fine films `a-s632-fine-040-052.png`,
  `a-2222-fine-074-092.png`. Busy for about a second per layer, continuous, opaque cards (nothing seen through).
- B: `b-632-laptop-fold.png` (K = 1.0: the first copies leave the pane at rep 0.08–0.15), `b-3s3-laptop-fold.png`,
  `b-o-laptop-fold.png`, `b-sx-laptop-fold.png`, `b-2s22-laptop-fold.png`, `b-632-phone-page.png`,
  `b-s442-phone-page.png`. On the phone B has the bigger pane; at the "tiling" stop both panes show a tiling.

### 08:32 — real plays, timed (dev/rep-judge/play-timing.mjs: the real button pressed, every animation frame recorded)

1280x720, DPR 2, the mini's Chrome:

| page | 333 | 4\*2 | \*632 | 22x |
|---|---|---|---|---|
| A, Tile play: length / frames over 34 ms / steps backwards | 4.45 s / 0 / 0 | 6.47 s / 2 (max 67 ms) / 0 | 7.35 s / 0 / 0 | 5.77 s / 0 / 0 |
| B, the step inside Fold | 4.60 s / 0 / 0 | 5.50 s / 0 / 0 | 3.83 s / 0 / 0 | 4.72 s / 0 / 0 |
| shipped fold (dist) | 5.98 s / 0 / 0 | 5.98 s / 0 / 0 | 6.97 s / 0 / 0 | 7.00 s / 0 / 0 |

Median frame 16.7 ms everywhere; per-frame progress even (A: 0.0025–0.004 of u per frame). A's plane draw forced to
raster (render + a 1-pixel readback, 41 values of u): median 2.8–4.8 ms, p95 5.3–9.2 ms, max 16–20 ms, against
3.0–3.3 ms for the plane as always (1244x1100 canvas).

### 08:45 — A's pixels, checked again (dev/rep-judge/pops-a.mjs, end-diff-a.mjs, same-page-a.mjs, real-end-a.mjs)

- Pop profile, 300 steps, groups A did not profile (632, o, \*x, 2\*22, 3\*3, \*\*): every flagged step (more than 3x
  its neighbours) is motion of the last copies at the window's edge (`pair-632-0.85667-0.86.png`: corner cards
  moving), or a run of 5 steps (\*\* at u 0.82): no isolated pop, none at a phase boundary, none at the start of the
  replay fade.
- The end (u = 1 - 1e-6 against u = 1), a fresh page per group: 2\*22 13 levels in 4 px, 3\*3 58 levels in 108
  isolated px, \*\* 1, 632 0, 333 0 — A's own numbers. The same after changing groups in one page.
- A false alarm, recorded so that nobody repeats it: after many full-canvas readbacks (getImageData every step or every
  frame) Chrome moves the plane canvas to software raster; from then on the cached offscreen layers and the direct
  strokes are rasterised differently. Symptoms: one frame where the faint copy outlines change by up to 38–40 levels in
  ~300 px (333, 3\*3, during a real play, at whichever frame the switch happens: u 0.914 in one run, 0.973 in another),
  and end differences of 58 levels along whole mirror lines (2\*22 after a 300-step sweep, 6080 px; after 61 steps,
  4 px). Pixel checks of the plane must read back at most a couple of times per comparison (fresh page or context).
  Not a defect of the design; it could only bite a real browser that mixes raster backends between canvases.

### 08:48 — the port, tried (dev/rep-judge/port-check.mjs)

- `patch -p1 < qa/rep-a/rep-a.diff` applies to the CURRENT src with no fuzz or reject; the result equals
  dev/rep-a/src file for file except src/folds/crosscap.js and src/groupdata/motif.js, which the port keeps from the
  current src (the cross-cap fixer's and the comma table's newer versions; A does not touch them).
- That copy plus A's exactness test as test/replicate.test.js, through `tools/test-all.mjs` on the mini: **711
  tests, 707 pass, 2 fail, 2 skipped**. The failures: the pinned HASH_KEYS in test/app-url.test.js (the intended
  contract change), and my own slip (one dynamic `import('./src/app.js')` in the copied test not re-pathed). Fixed and
  rerun on the five files the port touches (replicate, app-url, plane, shell, timeline): 90 tests, 89 pass, the one
  failure the pin.
