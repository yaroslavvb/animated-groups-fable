# Two features, two handles (Demo 2a)

Interactive pair-centred Fenchel–Nielsen explorer for the four-cone sphere orbifolds `3333`, `2223` (hyperbolic), and `2222` (Euclidean). Pick any two cone points on the 3D surface ball (or tap their signature digits in the header) to bring that pair smoothly to the centre of the Poincaré disc with its tree and isolating geodesic while holding every cone point and comma stationary in place, then edit Length and Twist along the cut.

- **Spec:** [`spec-orbifold-handles.md`](../2026-11-24-symhub-meeting-notes-week-48/notes/spec-orbifold-handles.md)
- **Live page (anyone with the link):** https://spacesheep.dev/@yaroslavvb/two-features-two-handles
- **Tailnet:** http://intel/reports/2026-11/2026-11-24-two-features-two-handles/site/index.html
- **Hub:** [Chaim · Scott · Vladimir Hub](https://spacesheep.dev/@yaroslavvb/chaim-scott-vladimir-hub)
- **Companions:** [Classification of Surfaces](https://spacesheep.dev/@yaroslavvb/classification-of-surfaces), [Orbifold Showcase](https://spacesheep.dev/@yaroslavvb/orbifold-showcase)

## Files

- `src/handles.js` — exact hyperbolic (`F1–F4`, `F7`, `H1–H5`) and Euclidean (`pillowCentered`, `reduceSuperbase`, `recut2222`) re-cut geometry, walk overlay, smooth view interpolation, and 3D `stadium` + bead helpers.
- `src/pattern-ext.js` — local copy of `pattern.js` with `outline: false`, `center`, `dots`, and `setView` (leaving `2026-11-15-classification-of-surfaces` unmodified).
- `src/rigid-print.js` — rigid comma generator anchored in each cone's local frame (`big`, `small`).
- `src/page.template.html`, `src/page.css`, `src/page.js` — Play & Tutorial tabs, responsive 2D + 3D panes, Length and Twist controls, three moment chips, five MathJax tutorial folds, hash state, and `window.__handles`.
- `test/handles.test.js` — pure geometry & re-cut invariants test suite.
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
  --out      ../2026-11-24-two-features-two-handles/site/index.html
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

- **Checked (`node --test`):**
  - `math-general.md` §9 reference vector `(3,4|2,5), L=1.6, t=0.5` UHP and disc points + `R_A R_B R_D R_C = I` to `1e-10`.
  - Design moment numbers (`3333` & `2223` `BC`, `CA`, `DA`, `F2`, `F7`).
  - All 6 pairwise picks across `3333`, `2223`, and `2222` (plus a 5-step chained recut): cone points and rigid commas stay stationary on screen to `1e-9` (`1e-8` over 5 steps), with exact `(L, tw)` round-trips.
  - Full-turn (`-0.5` vs `+0.5`) periodicity and half-turn far-pair swap.
  - `analyse(D)` signature and Gauss–Bonnet / Euclidean area across `[0.4, 7.0]` (`L`) and `[-0.5, 0.5]` (`tw`).
  - 3D dodecahedron neighbour selection, `stadium` + closed `beadOnLoop`, `followTreeData`, and `interpolateView` endpoints.
- **Checked (Chrome `shot.mjs` & `dark_shot.mjs`):**
  - 11-step interactive verification across `1280×800` and `390×844` (light & dark): `paneRowOk: true`, `conePixelDriftBeforeGlide: 0`, digit pair-selection, sliders, `2222`, `Follow the tree`, `Tutorial` (all 80 formulas, `merror: false`, `overflowX: false`, `44 px` touch targets).
- **Not tried:** a real touchscreen phone, Safari / WebKit, and neither Vladimir Bulatov nor Chaim Goodman-Strauss has seen this build.
