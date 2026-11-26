# Two features, two handles (Demo 2a)

Interactive pair-centred Fenchel–Nielsen explorer across all five Conway–Thurston feature kinds (`cone n`, composite `22`, mirrors `∗`/`∗3`, crosscap `×`, and handle halves `o⁺`/`o⁻`) in seven families: `3333`, `2223`, `333∗`, `333∗3`, `333×`, `o33` (hyperbolic), and `2222` (Euclidean). Tap any two features on the 3D surface (or their symbols in the header) to bring the unique shortest arc between them smoothly to the centre of the Poincaré disc / Euclidean plane with its tree and isolating cut while holding every cone point, geodesic cuff, mirror corner, and rigid comma stationary in place (`1e-9` precision).

Incorporates Vladimir Bulatov's and Chaim Goodman-Strauss's email feedback after seeing the first four-cone version: generalizing pair separation and twist from cone pairs to all five feature kinds (`∗`, `∗3`, `×`, `½ o`) and adding the `o` handle fault-line shift parameter (`tau_o`, shifting `o⁻` against `o⁺` along the blue handle geodesic `gamma_o`), cuff lengths, and exact recursive re-cutting across any pair.

- **Spec:** [`spec-orbifold-handles.md`](../2026-11-24-symhub-meeting-notes-week-48/notes/spec-orbifold-handles.md)
- **Live page (anyone with the link):** https://spacesheep.dev/@yaroslavvb/two-features-two-handles
- **Tailnet:** http://intel/reports/2026-11/2026-11-24-two-features-two-handles/site/index.html
- **Hub:** [Chaim · Scott · Vladimir Hub](https://spacesheep.dev/@yaroslavvb/chaim-scott-vladimir-hub)
- **Companions:** [Classification of Surfaces](https://spacesheep.dev/@yaroslavvb/classification-of-surfaces), [Orbifold Showcase](https://spacesheep.dev/@yaroslavvb/orbifold-showcase)

## Files

- `src/handles.js` — exact hyperbolic (`F1–F4`, `F7`, `F11` cone–cuff & once-holed torus formulas, `H1–H5`, Lorentz `boostX` / exact Lorentz `invH` / `axisOfTrans`, `PSU(1,1)` spinor arithmetic and exact-inverse pairing, `coneFeatCentered`, `o33Centered`, unified `recut`, symmetric `treeSeg` + complementary `farTreeSeg` rendering on both sides of the isolating cut), Euclidean (`pillowCentered`, `reduceSuperbase`, `recut2222`), generalized `followTreeData`, smooth view interpolation, and 3D `stadium` + `handleBeltLoop` + feature-anchor helpers.
- `src/pattern-ext.js` — local copy of `pattern.js` with `outline: false`, `center`, `dots`, `setView`, Klein ray-marching `locateTilePSU` view recentering, focus-seeded `PSU(1,1)` tile walker (`tilesPSU`), exact Poincaré disc circular arcs (`poincareArc` / `hypArc`), shift-invariant hyperbolic tile cache (`hCache.shift`), linear non-`closePath` `Path2D` building, and local mark/comma scale gating (leaving `2026-11-15-classification-of-surfaces` unmodified).
- `src/rigid-print.js` — rigid comma generator anchored in each cone's local frame (`big`, `small`).
- `src/page.template.html`, `src/page.css`, `src/page.js` — Play & Tutorial tabs, responsive 2D + 3D panes, 7 family chips, Length and Twist plus contextual cuff-length (`b`) and shift (`tau_o`, `tau_c`) sliders, four moment chips (`Follow the tree`, `Closer, further`, `Half a turn`, `Handle fault`), five MathJax tutorial folds, hash state (`#`, `#k=...`), and `window.__handles`.
- `test/handles.test.js` — pure geometry & re-cut invariants test suite (16 tests).
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

- **Checked (`node --test`, 16/16 passing):**
  - `math-general.md` §9 reference vector `(3,4|2,5), L=1.6, t=0.5` UHP and disc points + `R_A R_B R_D R_C = I` to `1e-10`, plus design moment numbers (`3333` & `2223` `BC`, `CA`, `DA`, `F2`, `F7`).
  - All 6 pairwise picks (and 5–6-step chained recuts) across all 7 families (`3333`, `2223`, `2222`, `333∗`, `333∗3`, `333×`, and both Mixed `{o⁺, 3}` and Split `{o⁺, o⁻}` cuts on `o33`): cone points, geodesic cuffs, `∗3` corners, `H_glue` gluings, and rigid commas stay stationary in place to `1e-9` (`1e-8` over 6 steps), with exact round-trips.
  - Full-turn (`-0.5` vs `+0.5`) periodicity of Twist, `tau_o`, and `tau_c`, and half-turn far-pair swap.
  - `analyse(D)` signature and Gauss–Bonnet / Euclidean area across extreme parameter sweeps on all 7 families.
  - Extreme `(L ∈ [0.4, 11.5], tw ∈ [-0.5, 0.5])` sweeps across all 6 hyperbolic families plus the `#k=o33&m=2103&l=9.56&tw=0.4295&b=1.3&to=0.4736` twist sweep (`PSU(1,1)` round-trips, 3-cone cycles, `tilesPSU` tiling without origin collisions, and `recut` orbit invariance).
  - Exact Klein ray-marching `locateTilePSU` drag recentering (75-unit drags across 16 angles on `#k=o33&m=0213&l=2.006&tw=-0.0344&b=0.4&to=0.485`, far-focus `tilesPSU`, and 8-direction stress sweeps across all 6 hyperbolic families).
  - Symmetric complementary pair tree branch (`farTreeSeg`) rendering on the opposite side of `cutSeg`, matching swapped `recut` `treeSeg` across all 7 families, plus unbroken halo/amber `followTreeData` cut strokes.
  - 3D dodecahedron neighbour selection for all 6 pairs on all 7 families, `stadium`, closed `handleBeltLoop` on `o33`, `followTreeData`, and `interpolateView` endpoints.
  - Exact Poincaré disc circular arcs (`poincareArc` matching `hypLerp` to `< 1e-9`) and shift-invariant `hCache` across tile crossings up to `H_REBUILD_DRIFT` (`0.65`) with zero rim popping.
- **Checked (Chrome `shot.mjs`, drag/wheel/coast profiler & `dark_shot.mjs`):**
  - On `#k=3333&m=0123&l=5&tw=-0.5`, eliminating the Chromium `Path2D.closePath()` $O(N^2)$ path-closing overhead, switching hyperbolic geodesics to exact `path.arc()` circular arcs, maintaining shift-invariant `hCache` without budget oscillation, and drawing inertia synchronously cut drag/coast JS frame times from `~35 ms` (`~20 fps`) down to `1.9–3.4 ms` (`60 fps` inertia at `17.0 ms` avg frame interval), and `2223` (`L=3`) from `76.5 ms` JS / `48.6 ms` GPU down to `2.7 ms` JS / `2.5 ms` GPU.
  - Interactive flows across `1280×800` and `390×844` (light & dark): `paneRowOk: true`, `conePixelDriftBeforeGlide: 0`, `333∗`, `333∗3`, `333×`, `o33` Mixed/Split + Handle shift + `Follow the tree`, `2222`, `Tutorial` (177 formulas typeset at build, `clippedSvgs: []` at 390 px, `overflowX: false`, `44 px` touch targets, `0` console/page errors, `0` scrub hits).
- **Not tried:** a real touchscreen phone or Safari / WebKit on this updated build; neither Vladimir Bulatov nor Chaim Goodman-Strauss has seen this second version yet.
