# `live/newton/` — the Newton search, unchanged

Live demonstration 1 of the tutorial: the whole twisted-shooting search for the g227
Brusselator spiral lattice, run in the browser. Symbol panel, reciprocal-shell table,
three-wave seed, live residual plot and a magic-theorem verification table re-checked centre
by centre on the orbit the page has just computed.

These files are **copied unmodified** from the `js-live` experiment folder
(`index.html`, `app.mjs`, `core.mjs`, `render.mjs`, `worker.mjs`, `newton.mjs`). Nothing here
has been edited; `live/glue/` imports `core.mjs`, `render.mjs` and `newton.mjs` from this folder
rather than keeping a second copy, so the two demonstrations share one set of numerics.

`index.html` is standalone: serve this folder (or the `live/` tree) over http and open it.
ES modules and a module Worker need a real origin, so `file://` will not do.

## Verified here after the copy

`check-newton.mjs` (the experiment folder's own Playwright check, copied alongside) driving
headless system Chrome at 1280 × 900 and 390 × 844, recorded in `check.json`:

| quantity | 1280 × 900 | 390 × 844 |
|---|---|---|
| period found | **6.390159918584618** | **6.390159918584618** |
| published record **6.390159918584649**, relative difference | **4.86e−15** | **4.86e−15** |
| matching digits | **14** | **14** |
| Newton iterations | **6** | **6** |
| trajectories integrated | **96** | **96** |
| final shooting residual | **8.18e−16** | **8.18e−16** |
| symmetry error of the exported movie (atlas limit 2e−7) | **1.33e−15** | **1.33e−15** |
| windings at all nine threefold centres | agree with `−k mod 3` | agree |
| search wall clock | **1.39 s** | **1.45 s** |
| total, including the movie | **1.58 s** | **1.64 s** |
| `scrollWidth` vs `clientWidth` | 1280 = 1280 | 390 = 390 |
| page errors | **0** | **0** |

The only console output is Chrome's `willReadFrequently` hint from the verification script's own
`getImageData` calls, not from the page.

Screenshots: `shot-desktop-full.png`, `shot-mobile390-full.png`, `shot-desktop-searching.png`.

The residual falls **0.168 → 5.85e−2 → 6.49e−3 → 4.96e−4 → 1.80e−06 → 1.97e−10 → 8.18e−16**
across the six Newton steps — the last two are the quadratic phase.
