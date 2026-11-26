# Two features, two handles (Demo 2a)

Interactive pair-centred Fenchel–Nielsen explorer across all five Conway–Thurston feature kinds (`cone n`, composite `22`, mirrors `∗`/`∗3`, crosscap `×`, and handle halves `o⁺`/`o⁻`) in seven families: `3333`, `2223`, `333∗`, `333∗3`, `333×`, `o33` (hyperbolic), and `2222` (Euclidean). Tap any two features on the 3D surface (or their symbols in the header) to bring the unique shortest arc between them smoothly to the centre of the Poincaré disc / Euclidean plane with its tree and isolating cut while holding every cone point, geodesic cuff, mirror corner, and rigid comma stationary in place (`1e-9` precision).

Incorporates Vladimir Bulatov's and Chaim Goodman-Strauss's email feedback after seeing the first four-cone version: generalizing pair separation and twist from cone pairs to all five feature kinds (`∗`, `∗3`, `×`, `½ o`) and adding the `o` handle fault-line shift parameter (`tau_o`, shifting `o⁻` against `o⁺` along the blue handle geodesic `gamma_o`), cuff lengths, and exact recursive re-cutting across any pair.

- **Spec:** [`spec-orbifold-handles.md`](../2026-11-24-symhub-meeting-notes-week-48/notes/spec-orbifold-handles.md)
- **Live page (anyone with the link):** https://spacesheep.dev/@yaroslavvb/two-features-two-handles
- **Tailnet:** http://intel/reports/2026-11/2026-11-24-two-features-two-handles/site/index.html
- **Hub:** [Chaim · Scott · Vladimir Hub](https://spacesheep.dev/@yaroslavvb/chaim-scott-vladimir-hub)
- **Companions:** [Classification of Surfaces](https://spacesheep.dev/@yaroslavvb/classification-of-surfaces), [Orbifold Showcase](https://spacesheep.dev/@yaroslavvb/orbifold-showcase)

## Any orbifold, typed: the text field after the chips (Thu 26 Nov 2026, week 48)

Two asks that morning, from a Claude session in `animated-groups-fable` (`40b381a4`):

1. *"add an extra button called "Custom" to the two-features/two handles page … which allows me to specify a custom orbifold, maybe reusing orbifold selection UI from …/classification-of-surfaces"*. Built as a `Custom` chip that opened the Classification page's signature bar (cells, caret, `−` / `+`, an add row); live as version `f2b588efa326`, commit `3f431b90`.
2. On seeing it, about 11:24: *"replace custom with a minimal text-field where I can enter arbitrary notation, maybe in gray, give a hint that I can enter orbifold stuff in there."* That is what the page has now; the chip and the bar are gone.

- **The field.** One quiet text field after `2222`, a chip's size, its hint in gray in its placeholder (`or type an orbifold: 2345, 234∗5, o27`; the check types each of its examples, since the first wording offered `23∗5`, which has three features). What is typed is read loosely (`custom.js` `readSignature`: spaces and commas anywhere, `∗` or `*`, `×` or `x`, `o` or `O`, rings and crosses wherever they were put) and shown as soon as it is a signature the page builds; the field then looks like a pressed chip, and goes gray again when a chip of the page takes over (a tap on it brings its orbifold back). It keeps the text as typed.
- **What it shows.** A signature with exactly four features (a handle counts as two, a mirror with its corners as one) of one of the engine's shapes, with any orders 2–9: four cone points (`2345`), three cone points with a mirror (`234∗`), a mirror with one corner (`234∗5`) or a crosscap (`234×`), a handle with two cone points (`o23`). `2222` typed is the page's own flat family, and one of the seven typed lights its chip. The address carries it (`#k=234*5&m=…`), and a link to one opens with the field holding it.
- **What it does not show, and says so.** Fewer or more than four features, two or more of mirror / crosscap / handle together (`22∗∗`, `22∗×`, `oo`), a mirror with several corners (`234∗56`), text that is no signature. While the field is being typed in, a small note under it gives the reason in the signature's own numbers and offers the nearest signatures that work; the panes keep the last orbifold shown meanwhile (which may be one the text passed on its way: `2345` while `23456` is typed). The note lies over the page, so nothing moves.
- **How.** `handles.js` no longer has a `3` written into its cone-and-cuff and handle builders or re-cuts: each cone point brings its own order (`roleOrders`, `buildO33Mixed(…, pLow, pUp)`, `buildO33Split(…, pAM, pAR)`), a corner of order `n` its own half-angle `π/2n`. A typed signature becomes a family the first time it is asked for (`normalizeFamilyKey` → `custom.js` `customSpec`), on the numbers of the built-in family of its shape. One real change beyond orders: with two half-turn points on the new cut (`o22`, picking the handle's two sides) the cone points lie ON the cut, so the handle now says which side is which (`recutO33`, mixed to split).
- **Not built:** two cuffs at once (it needs a pants with two cuffs and its re-cuts), a mirror with several corners (one shape parameter a corner more, no slider for it), more than four features (a cut a feature more), orders above 9.

## Files

- `src/handles.js` — exact hyperbolic (`F1–F4`, `F7`, `F11` cone–cuff & once-holed torus formulas, `H1–H5`, Lorentz `boostX` / exact Lorentz `invH` / `axisOfTrans`, `PSU(1,1)` spinor arithmetic and exact-inverse pairing, `coneFeatCentered`, `o33Centered`, unified `recut`, continuous pair-centred `fourConeCentered` `cutSeg`, symmetric `treeSeg` + complementary `farTreeSeg` rendering on both sides of the isolating cut, `tileEdges: false`), Euclidean (`pillowCentered`, `reduceSuperbase`, `recut2222`), generalized `followTreeData`, smooth view interpolation, and 3D `stadium` + `handleBeltLoop` + feature-anchor helpers.
- `src/pattern-ext.js` — local copy of `pattern.js` with `outline: false`, `tileEdges: false`, `center`, `dots`, `setView`, Klein ray-marching `locateTilePSU` view recentering (`keepView` recentering into the updated lattice on slider updates), focus-seeded `PSU(1,1)` tile walker (`tilesPSU`), exact Poincaré disc circular arcs (`poincareArc` / `hypArc`), shift-invariant hyperbolic tile cache (`hCache.shift`), linear non-`closePath` `Path2D` building, and local mark/comma scale gating (leaving `2026-11-15-classification-of-surfaces` unmodified).
- `src/rigid-print.js` — rigid comma generator anchored in each cone's local frame (`big`, `small`).
- `src/custom.js` — a signature as people type it (`readSignature`, `canonText`), as one of the engine's shapes (`customSpec`, `specOf`), its features (`featuresOf`), and why one cannot be shown with the nearest that can (`whyNot`). Pure.
- `src/custom-ui.js` — the text field after the chips and the note under it (`createCustomField`, `noteFor`).
- `src/page.template.html`, `src/page.css`, `src/page.js` — Play & Tutorial tabs, responsive 2D + 3D panes, **Center** checkbox in the Surface pane header (default on; uncheck to keep the Pattern view fixed in place when selecting new pairs), 7 family chips, Length and Twist plus contextual cuff-length (`b`) and shift (`tau_o`, `tau_c`) sliders, four moment chips (`Follow the tree`, `Closer, further`, `Half a turn`, `Handle fault`), five MathJax tutorial folds, hash state (`#`, `#k=...`), and `window.__handles`.
- `test/handles.test.js` — pure geometry & re-cut invariants test suite (21 tests).
- `test/custom.test.js` — typed orbifolds (8 tests): loose spellings read, 36 signatures read back off their tiles with Gauss–Bonnet areas, all 6 picks and 6-step chains on 25 custom states, period 1 of twist and shifts, the 3D ball, the walk, tiling from far foci.
- `tools/custom-check.mjs` — the text field in a real Chrome (92 checks): keys, taps, drags, slider ends, links, four window widths, a phone in the dark; `--live <the spacesheep address>` runs them in the viewer's frame. It holds no default of a family: the page's own state says what a fresh orbifold's numbers are.
- `tools/custom-webkit.mjs` — the text field on the live page in Safari's engine (14 checks); it runs on the M5, where WebKit is.
- `steps.json` — headless Chrome / screenshot verification plan (`1280×800` and `390×844`).

## Build & Check Commands

Pure math & invariance suite (`node --test`):

```sh
cd /Users/solid/git0/gyroscope/reports/2026-11/2026-11-24-two-features-two-handles
node --test
```

Bundle single-file site (from `2026-11-15-classification-of-surfaces`, never leaving any edits in `E`):

```sh
cd /Users/solid/git0/gyroscope/reports/2026-11/2026-11-15-classification-of-surfaces
node build.mjs \
  --template ../2026-11-24-two-features-two-handles/src/page.template.html \
  --entry    ../2026-11-24-two-features-two-handles/src/page.js \
  --css      src/styles.css,../2026-11-24-two-features-two-handles/src/page.css \
  --out      ../2026-11-24-two-features-two-handles/site/index.html \
  --math
```

Browser verification (`shot.mjs`):

```sh
cd /Users/solid/git0/gyroscope/reports/2026-11/2026-11-24-two-features-two-handles
node ~/git/animated-groups-fable/standalone/the-folding/tools/shot.mjs \
  --root "$PWD" \
  --page site/index.html \
  --steps steps.json
```

## Checked / Not Tried Yet

- **Checked (`node --test`, 21/21 passing):**
  - `math-general.md` §9 reference vector `(3,4|2,5), L=1.6, t=0.5` UHP and disc points + `R_A R_B R_D R_C = I` to `1e-10`, plus design moment numbers (`3333` & `2223` `BC`, `CA`, `DA`, `F2`, `F7`).
  - All 6 pairwise picks (and 5–6-step chained recuts) across all 7 families (`3333`, `2223`, `2222`, `333∗`, `333∗3`, `333×`, and both Mixed `{o⁺, 3}` and Split `{o⁺, o⁻}` cuts on `o33`): cone points, geodesic cuffs, `∗3` corners, `H_glue` gluings, and rigid commas stay stationary in place to `1e-9` (`1e-8` over 6 steps), with exact round-trips.
  - Full-turn (`-0.5` vs `+0.5`) periodicity of Twist, `tau_o`, and `tau_c`, and half-turn far-pair swap.
  - `analyse(D)` signature and Gauss–Bonnet / Euclidean area across extreme parameter sweeps on all 7 families.
  - Extreme `(L ∈ [0.4, 11.5], tw ∈ [-0.5, 0.5])` sweeps across all 6 hyperbolic families plus the `#k=o33&m=2103&l=9.56&tw=0.4295&b=1.3&to=0.4736` twist sweep (`PSU(1,1)` round-trips, 3-cone cycles, `tilesPSU` tiling without origin collisions, and `recut` orbit invariance).
  - Exact Klein ray-marching `locateTilePSU` drag recentering (75-unit drags across 16 angles on `#k=o33&m=0213&l=2.006&tw=-0.0344&b=0.4&to=0.485`, far-focus `tilesPSU`, and 8-direction stress sweeps across all 6 hyperbolic families).
  - Symmetric complementary pair tree branch (`farTreeSeg`) rendering on the opposite side of `cutSeg`, matching swapped `recut` `treeSeg` across all 7 families, plus unbroken halo/amber `followTreeData` cut strokes.
  - 3D dodecahedron selection across all 6 pairs on all 7 families (and custom signatures): `sitesForBall` always encircles the selected pair directly, using a `C¹`-smooth pinched `stadium` waist for the diagonal `(1, 3)` pair (`closed handleBeltLoop` on `o33`, `followTreeData`, and `interpolateView` endpoints).
  - Exact Poincaré disc circular arcs (`poincareArc` matching `hypLerp` to `< 1e-9`) and shift-invariant `hCache` across tile crossings up to `H_REBUILD_DRIFT` (`0.65`) with zero rim popping.
  - Intrinsic-geodesic-only rendering (`tileEdges: false` hiding arbitrary bookkeeping domain seams across all 7 families), continuous `fourConeCentered` `cutSeg` across `tw = 0`, and `keepView` recentering into the updated lattice when moving sliders after dragging (`< 1e-9` `Follow the tree` overlay alignment).
  - Hardened `keepView` fallback clearing stale `bPsu`/`base` even when `|vWorld| >= 150` (always recentering into the updated lattice and syncing any in-flight `drag`), plus full-rim `followTreeData` `cutPts` (`±9` matching `ends`) across all 7 families.
  - Intrinsic rigid cone-mark orientation (`markRefs` in each cone's partner/comma frame so triangles/lenses stay steady across `tw = 0`, `tw = ±0.5`, and `recut`), topological `hScale` + per-segment width buckets (`segBucket`), and `333x` lower-cone mark highlight fix.
  - Smooth `tauC`-independent centering frame (`framePos`) and symmetric 3-lift orbifold `tree to cut` distance (`coneFeatTreeToCut`) on `333*3`, eliminating the disc teleport and metric jump across the `tc = 0` `60°`-corner cut-locus while keeping the shortest-arc wall handoff exact.
  - Default parameters across all 7 built-in families (`3333`, `2223`, `333∗`, `333∗3`, `333×`, `o33`, `2222`) matched to the canonical orbifold metrics of `classification-of-surfaces` (`domainOf(parse(k))`) and verified isometric (and orientation-preserving on `333∗3` and `o33`).
- **Checked (Chrome `shot.mjs`, drag/wheel/coast profiler & `dark_shot.mjs`):**
  - On `#k=3333&m=0123&l=5&tw=-0.5`, eliminating the Chromium `Path2D.closePath()` $O(N^2)$ path-closing overhead, switching hyperbolic geodesics to exact `path.arc()` circular arcs, maintaining shift-invariant `hCache` without budget oscillation, and drawing inertia synchronously cut drag/coast JS frame times from `~35 ms` (`~20 fps`) down to `1.9–3.4 ms` (`60 fps` inertia at `17.0 ms` avg frame interval), and `2223` (`L=3`) from `76.5 ms` JS / `48.6 ms` GPU down to `2.7 ms` JS / `2.5 ms` GPU.
  - Interactive flows across `1280×800` and `390×844` (light & dark): `paneRowOk: true`, `conePixelDriftBeforeGlide: 0`, `333∗`, `333∗3`, `333×`, `o33` Mixed/Split + Handle shift + `Follow the tree`, `2222`, `Tutorial` (177 formulas typeset at build, `clippedSvgs: []` at 390 px, `overflowX: false`, `44 px` touch targets, `0` console/page errors, `0` scrub hits).
- **Checked for typed orbifolds (`node --test test/custom.test.js`, 8/8; `node tools/custom-check.mjs`, 92 checks ok, 0 page errors, and 93 with `--live` on spacesheep):**
  - Loose spellings are read (`2 3 4 5`, `234∗5`, `x234`, `27O`, `2,3,4,×`), and what is no signature is refused (`2y45`, `1`, `23-45`).
  - Every one of 36 typed signatures (`2345` … `9999`, `234∗` … `999∗`, `234∗5` … `999∗9`, `234×` … `999×`, `o23` … `o99`) folds up to the signature typed (`analyse`), with the area Gauss–Bonnet gives it, over 4–6 pairings, 5 lengths, 5 twists and the ends of the cuff sliders.
  - All 6 picks keep every cone point and every comma in place to `1e-9` (6-step chains `1e-7`) on 25 custom states, unequal orders in every shape (`2345`, `2229`, `957∗`, `259∗4`, `957×`, `o29`, `o22` …); a random sweep of 1,200 custom states with 3-step chains held to `1e-6` but for one at `L' = 9.3`. The round trip of a pick is NOT promised to return the same length (a re-cut takes the shortest tree it finds: `3333` itself comes back shorter from `L = 4.1`), so the suite does not ask for it.
  - In Chrome at `1280×900`, four narrower windows and `390×844` (dark, touch): typed key by key, nothing changes until there are four features; a digit changed keeps the pair and the sliders; the note says why for seven kinds of text, stays inside the page and moves nothing; an offer tapped; a chip takes over and a tap on the field brings its orbifold back; one of the seven typed lights its chip; keys pressed elsewhere do not reach the field; six drags and every slider at both ends on 7 typed orbifolds leave the pattern drawn; links to a typed orbifold, to a signature it cannot show (`#k=237`) and to `o33` open as they should; the field's text is 16 px, so a phone does not zoom in on it; `steps.json` unchanged (`paneRowOk: true`, `conePixelDriftBeforeGlide: 0`, `clippedSvgs: []`).
  - In WebKit on the M5 (`tools/custom-webkit.mjs`, the live page, `1280×900` and a phone in the dark): the field is a chip tall with 16 px text, its note sits under it inside the window, `2379`, `234∗5`, `o27` and `957×` typed are shown and drawn, 14 checks ok. Real Safari and a real phone: not tried.
- **Not tried:** a real touchscreen phone or Safari / WebKit on this updated build; neither Vladimir Bulatov nor Chaim Goodman-Strauss has seen this second version yet.
