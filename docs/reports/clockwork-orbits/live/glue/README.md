# `live/glue/` — a fundamental domain that remembers

Live demonstration 2 of the tutorial: **forward simulation on the `333` fundamental domain of
the g227 clockwork group, with glued edges that read the domain's own past.** From white noise
the published Brusselator spiral lattice self-assembles, and the period comes out of the delay.

This is a browser port of the experiment scripts `dde.py`, `reduced.py` and `assemble.py`
(stage D, the white-noise route). The arithmetic is the repository's own: the six-neighbour
triangular Laplacian with the factor `2/(3h²)`, the Brusselator right-hand side and classical
RK4, already ported in `../newton/core.mjs`, plus its ember palette in `../newton/render.mjs`.

---

## The idea

The catalog's clockwork convention is `q(Mx + v, t + τ_g T) = q(x, t)`. Read node-wise, with
`y = gx`:

```
q(y, t) = q(g⁻¹y, t − τ_g T)
```

The neighbour across a glued edge is the representative's own **past**. For g227 the offsets are
`τ = 0, 1/3, 2/3`, so the two non-trivial classes of edge read the domain as it was **T/3** and
**2T/3** ago. Gluing with a lag turns the PDE on the fundamental domain into a
delay-differential equation whose only extra parameter is the period **T** — the delay. Nothing
else changes. A simulator that already glues edges needs one new thing: a history buffer.

That matters because of what happens without it. On the full torus, with only the same-time part
of the symmetry imposed, this orbit is a saddle — a perturbation grows **1.150** per period, and
the leading unstable direction is itself same-time-symmetric, so restricting to a fundamental
domain does not help. Inside the *delayed* glue the same perturbation decays **0.692** per
period. The delay does not merely shrink the domain; it deletes every direction that breaks the
clockwork symmetry.

---

## What is in this folder

| file | what it is |
|---|---|
| `glue.mjs` | `buildGlue`, `History`, `makeReducedRhs`, `makeExpander`, `seededNoise`, `createRun`, `selfTest` — the whole delayed-glue integrator, no DOM |
| `domain.mjs` | the picture of the fundamental domain and its three kinds of glued edge |
| `worker.mjs` | the run on a Web Worker, with flow control so one frame is painted per animation frame |
| `demo.mjs` | `mountGlueDemo(element)` — the embeddable panel; styles itself from the page's CSS custom properties, light and dark |
| `test.html` | standalone test page |
| `node_run.mjs` | the same modules under node, for the cross-check |
| `check.mjs` | headless Chrome verification at 1280 and 390 px |
| `verify_glue.py` | checks an exported state against the Python lab |
| `check.json`, `node-seed*.json`, `verify-*.json`, `relaxation.json` | the recorded results quoted below |
| `browser-*-glue.f64`, `browser-*-polished.f64` | states exported from Chrome (float64, `u` then `v`, node = `y·36 + x`) |

To embed the panel in a page:

```html
<div id="glue"></div>
<script type="module">
  import { mountGlueDemo } from './live/glue/demo.mjs';
  mountGlueDemo(document.getElementById('glue'));
</script>
```

The page needs the tutorial's colour tokens (`--c1`, `--c2`, `--c4`, `--ink`, `--ink-2`,
`--muted`, `--grid`, `--axis`, `--surface`, `--page`). No CDN, no external fonts, no build step;
ES modules and a module Worker, so it has to be served over http rather than opened as a file.

---

## The glue, in numbers (g227, N = 36)

| quantity | value |
|---|---|
| mesh nodes per channel | **1296** |
| integrated representatives | **146** (292 unknowns for both channels) |
| reduction | **8.877×** |
| nodes copied instantaneously (the `τ = 0` rotations) | **290** |
| nodes read from `t − T/3` | **430** |
| nodes read from `t − 2T/3` | **430** |
| stencil bonds leaving the domain, by delay | **46** at the same instant, **26** at `T/3`, **26** at `2T/3` |

**146 = (1296 + 6·3)/9** by Burnside. The drawn cell is the `√3 × √3 R30` supercell of the true
p3 cell and the `333` orbifold is one third of that, so the delayed glue reduces exactly to
SymSim's domain — and the three cone points of `333` are the three rotation-centre classes,
carrying `τ = 0, 1/3, 2/3`. They are the three labelled corners of the rhombus in the panel, and
their labels **3**, **3₁**, **3₂** are the clockwork symbol **r33₁3₂** itself.

**Representative choice.** The experiment script labels each orbit by its smallest flat index,
which is correct but draws as a disconnected scatter — the one figure in that folder that had to
show a fundamental domain and did not. Here the representative is the orbit member closest, in
the L∞ sense on wrapped lattice coordinates, to the centre of the rhombus `[0,⅓) × [0,⅓)` — the
classical p3 fundamental domain, whose four corners are the cone points 3, 3₂, 3₁, 3₂. The set is
connected and has exactly the same **146** members: 144 interior nodes plus the two cone points
that the half-open rhombus would exclude.

**Self-test.** The reduced right-hand side (146 nodes, six neighbours gathered through the glue)
against `../newton/core.mjs`'s full-torus right-hand side (1296 nodes) applied to the expanded
field: **max difference 0**, bitwise, at both widths. The test page runs this on load; if the
glue tables were wrong it would not be zero.

---

## What the run does

* White noise of rms **0.10** about the uniform equilibrium **(1, 2.3)** on the 146
  representatives, from a seeded generator (mulberry32 + Box–Muller) — the same run every time.
* History prefilled with the frozen initial state for `t ≤ 0`.
* RK4 on the delayed system with `dt = T/336`, so `T/3` is always an exact number of steps, and
  **4-point Lagrange** interpolation of the history for the two RK4 midpoint stages (which ask
  for the delayed field at half steps, and those never land on the step grid).
* The delay starts at the Hopf period **6.355087900738468** = `2π/Im λ` at `k = 0` — the only
  number available before anything has been computed — and is updated once per period by the
  phase-shift feedback `T′ = T + ⟨q(t−T) − q(t), dq/dt⟩ / |dq/dt|²`, with `T ← T + relax·(T′ − T)`
  and `relax = 1.0` (the default of the experiment script).
* It stops when the delay moves by less than **1e−5** on two consecutive updates, after at least
  10 periods.
* Then, and only then, two Newton steps on the twisted shooting equation, reusing
  `../newton/newton.mjs` unchanged.

---

## Results

### The delay settles on the published period

Seed 1, stop tolerance 1e−5:

| quantity | value |
|---|---|
| periods of forward simulation | **31** |
| RK4 steps | **10 415** |
| reduced right-hand sides | **41 691** |
| grid-point evaluations | **6 086 886** |
| history samples | **83 415** under node (**84 903** in the browser, which samples twice more per drawn frame to rebuild the torus) |
| delay reached | **6.390172673334256** |
| published period | **6.390159918584649** |
| difference | **1.275e−5**, relative **1.996e−6** |
| last delay change before stopping | **5.07e−6** |
| rms `|q(t) − q(t−T)|` at the end | **5.87e−6** |

The drift falls by **0.656** per period (fitted over the last 15 periods) and `|T − T_published|`
by **0.705** per period (fitted from period 12). The experiment folder's own noise run measures
0.762–0.828 per period for the same quantities; it used the over-relaxed outer loop and a
different noise realisation, so the rates are not expected to agree exactly.

### Four seeds

| seed | periods | delay reached | relative error | right-hand sides |
|---|---|---|---|---|
| 1 | 31 | 6.390172673334256 | **+2.00e−6** | 41 691 |
| 2 | 32 | 6.390174531103199 | **+2.29e−6** | 43 048 |
| 3 | 31 | 6.390178214243590 | **+2.86e−6** | 41 703 |
| 4 | 25 | 6.390174277794506 | **+2.25e−6** | 33 621 |

All four land on the published orbit. There is no amplitude to choose, no reciprocal shell to
choose, and no sign to choose — the three knobs the direct construction has.

### The structure the symbol forces, measured not imposed

Windings of the first temporal harmonic, read off an **unprojected** RK4 replay of the state the
glue ended on (seed 1): all nine threefold centres agree with `−k mod 3`, **6** charged cores in
the simulation box — two per primitive p3 cell, the box being three of them — and total charge
**0**.  (An earlier draft printed **18** here.  The glue's forced zeros sit at a relative
amplitude of about 1.5e−6, just above `findVortices`' default 1e−6 cut-off, so the rings passing
through a core were no longer skipped and each neighbour of a core registered a spurious ±1.
`worker.mjs` now passes 1e−3.) The symmetry error of that raw replay is
**5.80e−05**, consistent with a period that is still 2e−6 out.

After the two Newton steps, the Python lab's `charges_at_centres` reports the relative amplitude
of `Â` at the six `3₁`/`3₂` screw centres as **2.26e−11** against **1.0** at the three `τ = 0`
centres — the theorem's "the first harmonic vanishes at a screw centre", measured.

### The Newton polish, in the browser

| quantity | value |
|---|---|
| Newton iterations | **2** |
| shooting residual | **3.68e−14** |
| period | **6.390159918584547** |
| relative difference from the published period | **−1.60e−14** |
| symmetry error of the unprojected 48-frame replay | **2.48e−09** (atlas limit 2e−7) |
| cost | **18 832** full-torus right-hand sides, **44** trajectory integrations, **0.69 s** |

### The Python cross-check

`verify_glue.py` on the state Chrome exported (`browser-desktop-glue.f64`, seed 1):

| quantity | value |
|---|---|
| the repository's **unprojected** `twisted_residual` on the raw glue state | rms **3.728e−06**, max **1.984e−05** |
| `compare_orbits` against the published record, before any Newton step | **same orbit**, relative rms **6.55e−06** |
| `lab.newton_krylov_rpo` from there | **2** iterations, residual **5.83e−16** |
| polished period | **6.390159918584618** (published **6.390159918584649**, relative **−4.86e−15**) |
| `compare_orbits` after the polish | **same orbit**, rms **5.394e−08**, relative **2.119e−08** |
| alignment found | frame shift **12**, translation **(24, 12)**, point part the 120° rotation, fractional frame shift **−0.2967** |
| the repository's acceptance audit | **passed** |
| windings at the nine centres | all **agree** with `−k mod 3` |
| the same on the browser's Newton-polished state, unprojected | twisted residual **3.68e−14** |

The **5.394e−08** is the float32 round-off floor of the stored record (**4.64e−08**), not an
error of the method. The four seeds give **5.12e−08**, **5.57e−08**, **5.36e−08** and
**5.39e−08**, and all four pass the audit after two Newton iterations.

**No symmetry is smuggled in.** Only the same-time (`τ = 0`) part is ever imposed on a single
state; the `τ ≠ 0` relations are imposed *across time*, through the history buffer, and the
redundant ones — the statement that the field at a screw centre repeats after `T/3` — are never
imposed at all and come out at 1e−11. The residual quoted above is the repository's own
`twisted_residual` with no projection applied.

### Headless Chrome, 1280 and 390 px

| quantity | 1280 × 900 | 390 × 844 |
|---|---|---|
| page errors / console errors | **0** / **0** | **0** / **0** |
| self-test (reduced vs full right-hand side) | **0** | **0** |
| `scrollWidth ≤ clientWidth` | **true** | **true** |
| delay reached | **6.390172673334256** | **6.390172673334256** |
| Newton-polished period | **6.390159918584547** | **6.390159918584547** |
| pure compute time for the 31 periods | **0.46 s** | **0.46 s** |
| click to "period found" at normal speed | **12.6 s** | **12.6 s** |
| click to the polished period | **13.3 s** | **13.3 s** |

The exported states are **byte-identical** across the two widths and node: sha256
`a379e53b…` for the settled glue state and `5f52dd40…` for the Newton-polished one.

**The 12.6 s is deliberate.** The integrator finishes in under half a second; the worker waits
for the page to paint each frame before taking the next few steps, so the assembly is watchable
rather than instantaneous. The speed control sets how many RK4 steps go into one drawn frame:
**25.0 s** slow (7 steps), **12.6 s** normal (14), **3.3 s** fast (56), and "as fast as it will
go" (336) removes the pacing. Screenshots: `shot-desktop-assembling.png` (period 4, mid-assembly)
and `shot-desktop-done.png`, and the same pair at 390 px.

---

## Honest limitations

* **Over-relaxation does not work here.** The experiment's stage D used `relax = 2.5`, the value
  `1/(1 − 0.60)` suggested by the gain of the outer map measured near the fixed point. Started
  from white noise, this port with `relax = 2.5` never settles: over the last 40 of 90 periods
  the delay swings between **5.534** and **7.158**, ending at **7.054** — a relative error of
  **0.104** (`relaxation.json`). The 0.60 gain is a property of the linearised outer
  map close to the solution, and the transient from noise is far outside that regime. The default
  here is `relax = 1.0`, the experiment script's own default, which converges monotonically; 2.5
  is left reachable in code but is not offered in the interface.
* **The stop rule is a convenience of this page**, not of the experiment, which ran a fixed 300
  time units. Stopping at a delay change of 1e−5 lands at a relative period error of about
  **2e−6**; running longer keeps improving it at 0.7 per period until the method's own
  discretisation floor — the experiment measures the delayed integrator's realised period sitting
  **−7.0e−09** from the Newton-polished one, a floor this page never reaches.
* **The noise is not the experiment's noise.** It comes from a JavaScript generator, so the runs
  are reproducible in the browser but are a different realisation from the Python ones. The
  periods agree to about 3e−6, not bitwise.
* **The representative set is not the experiment's.** It is a different spanning choice of the
  same relations, made so the domain draws as a connected rhombus. The counts are identical and
  the reduced right-hand side agrees with the full-torus one bitwise, but the settled state sits
  at a different point of the orbit (`compare_orbits` finds the alignment).
* **One entry, one parameter set.** g227, `a = 1, b = 2.3, Du = Dv = 1, L = 40, N = 36`. Mirrors
  and glides force `τ ∈ {0, 1/2}` and change the structure of the glue; nothing here tests them,
  and the entries that neither published method finds are mostly mirror groups.
* **The 8.877× is arithmetic, not wall clock.** It is exact in grid-point evaluations. At this
  mesh size the saving is real in JavaScript because the loops are over typed arrays, but the
  claim to quote is the ratio.

---

## Reproducing

```
# the same modules under node: convergence, charges, and an exported state
node node_run.mjs --seed 1 --out state.f64

# the state against the Python lab: unprojected residual, Newton polish, compare_orbits, audit
LAB_PATH=<dir holding lab.py> python verify_glue.py state.f64 state.json verify.json

# headless Chrome at 1280 and 390 px, screenshots, exported states, timings
PLAYWRIGHT_MODULE=<...>/playwright/index.mjs CHROME=<...>/Google\ Chrome node check.mjs --port 8961
```

`check.mjs` serves the `live/` tree, so `../newton/` resolves; it writes `check.json`,
`browser-*-{glue,polished}.f64` and the screenshots next to itself. Playwright and Chrome are not
vendored: set `PLAYWRIGHT_MODULE` and `CHROME`, or install playwright next to the script.
`verify_glue.py` needs the shared `lab.py` from the experiment scripts, located by `LAB_PATH`.
