# Gray–Scott space-time orbit solver

`core.mjs` has no dependencies. It runs in browsers, module workers, and Node.
It searches for a nonconstant solution of the **actual two-species Gray–Scott
equations**, not merely a seamless animation. Search failure is reported as an
unverified candidate. No solved glider orbit is bundled or claimed.

```js
import {createProblem, fitOrbit} from './core.mjs';
const problem = createProblem({
  N: 24, M: 24, ops: catalogGroup.render.ops,
  params: {Du: .16, Dv: .08, F: .026, k: .055, dx: 1},
  minTemporal: .012, minSpatial: .04,
  periodBounds: [8, 20000]
});
const field = problem.project(seed); // seed has 2*N*N*M values
const result = await fitOrbit({problem, field, period: 400, iterations: 200,
  onProgress: ({iteration, field, period, pdeRms, relativePde}) => { /* redraw */ },
  signal: abortController.signal
});
console.log(result.diagnostics.validated, result.diagnostics.reasons);
```

`problem.fitOrbit({field,...})` is also supported. Set `fitPeriod:false` to fix
the period; `validate:false` skips final independent shooting and consequently
never marks the result validated. The optimization yields to the event loop
every `yieldEvery` iterations (default 3). Use a worker for larger grids. An
`onProgress` call includes a safe field copy. The result carries `field`,
`period`, `iterations`, `reason`, `objective`, and `diagnostics`.

## Data and units

Both grid dimensions must be multiples of four. `N` is the spatial side in
nodes; `M` is the number of time frames. For frame `k`, all `N*N` U values
precede all `N*N` V values; the frame offset is `k*2*N*N`. Spatial indexing is
`y*N+x`. The torus nodes are normalized coordinates `(x/N,y/N)`; its physical
side is `N*dx`. **Keep `N*dx` fixed when refining N.** Physical frame spacing is
`period/M`. Parameters `F` and `k` are feed and kill rates.

An operation has catalog shape `{M:[[a,b],[c,d]],v:[vx,vy],s:1,tau}` and means
`q(A*x+v,t+tau*T)=q(x,t)`. Projection uses exact integer-node orbits, including
the generated closure of the supplied operations. All g94–g99 operations map
the grid exactly. Fractional time or spatial sampling incompatible with the
grid is rejected. Negative time direction is rejected; it is not an
equivariance of this dissipative autonomous PDE.

## Chaim notation and generator overlay

The browser uses the same short colour forms as
[`correspondence-p4.html`](../correspondence-p4.html): g94 `442`, g95 `²4²4¹2`,
g96/g97 `⁴4⁴4²2`, g98 `¹4²4²2`, and g99 `⁴4⁴4¹2`. Each superscript is the
order of a generator's colour permutation. It does not record the direction
of a time shift, so the shared g96/g97 short form must be disambiguated using
the record ID and directed phase. The source labels the C4 forms as derived
extensions of its notation rule.

`overlay.mjs` exports `GROUP_DISPLAY` and `renderGeneratorOverlay`. Its exact
SVG path outlines and short-form HTML are copied from the correspondence
page; named centers, affine maps and time shifts are copied from
`../data/clockwork-coloring-correspondence.json` under
`chaim_presentation.generators`. `group-display.json` preserves a portable
snapshot of that metadata. Each named generator's `operationIndex` selects
the same operation in `groups.json`; `translation` also records its integer
lattice shift, which is immaterial on the numerical torus.

The overlay labels α and β as quarter-turns and γ as a half-turn. For
g94–g98 the named quarter-turn matrix is R270, the inverse of the catalog's
R90 generator. In particular, α/β have phase **3/4 in g96 and 1/4 in g97**.
For g99 they use R90 and have phases 1/4 and 3/4 respectively. The generator
comparison must use these named phases, not infer them from the short form.

Canvas rows display increasing numerical y downward; overlay centers use
the same coordinates without a y reflection. This makes R270 appear
counterclockwise and R90 clockwise on the canvas. Applying the
correspondence plate's y-up display transformation only to the overlay would
misplace the g98/g99 centers. The markers denote the requested constraint. The main viewer displays a chemical
field only after that constraint has been verified on both the sampled orbit
and independent unprojected forward trajectories. For bundled fields this
verification occurs offline, when building the published catalog.

## Numerical method

For each periodic time edge, the residual is

```
r[k] = (q[k+1]-q[k])/(T/M) - (F(q[k+1])+F(q[k]))/2,
q[M] = q[0].
```

`F` here denotes the full reaction–diffusion vector field, with the selected
square-grid Laplacian. `params.stencil` accepts `five-point` (the solver API
default) or `bulatov9` (the browser's source-preset default). The objective is half its mean square divided by
`rateScale²` (default `.02²`), plus soft penalties for insufficient temporal
and spatial RMS variation. A tangent phase condition removes the continuous
time-origin ambiguity. L-BFGS uses the analytic Jacobian-transpose gradient,
projects onto the exact invariant subspace, optimizes log period within the
given bounds, and clips concentrations to `[0,1.2]`. The nontriviality
penalties are not hard constraints; diagnostics must still pass their gates.

`evaluate(q,T,{gradient:true})` returns the objective, PDE residual RMS,
relative residual, temporal/spatial variation, field gradient and
`logPeriodGradient`. The field gradient is projected by default; request
`projectGradient:false` for the ambient derivative.

## GPU exploration and diffusion stencils

`webgl.mjs` implements forward evolution using WebGL2. It follows the float
texture and ping-pong framebuffer architecture in
[Bulatov's simulator](https://github.com/vbulatov2011/symhub/blob/37e3520df40ba0ef38e2c916090790b9bbaec3dc/apps/symsim/gray_scott/js/gray_scott_simulation.js):
each fragment updates one lattice node, with U and V in the red/green channels
of RGBA32F textures. A third float framebuffer holds the midpoint stage.
The optional browser initial-guess simulation integrates with explicit midpoint; Bulatov's original shader
uses forward Euler. Parameter edits update shader uniforms without reading
the chemical field back to the CPU. The display also runs on the GPU;
readback is reserved for recording, diagnostics and export.

Integer `texelFetch` addressing wraps both spatial directions explicitly.
Sampling uses the same normalized node coordinates `(i/N,j/N)` as the solver
and generator overlay. The separate kernel pass averages only operations
whose time shift is zero. Forward integration never imposes future phases.

The two supported discrete Laplacians, before multiplication by `1/dx²`, are:

```
five-point: axial_sum - 4 * center
bulatov9:   0.8 * axial_sum + 0.2 * diagonal_sum - 4 * center
```

The nine-point weights reproduce
[Bulatov's shader](https://github.com/vbulatov2011/symhub/blob/37e3520df40ba0ef38e2c916090790b9bbaec3dc/apps/symsim/gray_scott/js/shaders/grayScottShader.glsl.mjs)
without silently renormalizing them. Its continuum limit is **1.2 times the
usual Laplacian**. Holding the same D and dx while changing stencils therefore
changes the effective diffusion. To compare the same continuum diffusion,
divide both diffusivities by 1.2 in the nine-point version, or multiply dx by
sqrt(1.2). CPU evolution, collocation, its analytic adjoint and independent
RK4 shooting all use the selected stencil; numerical records name it.

Midpoint evolution uses dt at most `.4` and a conservative diffusion cap
`.18*dx²/max(Du,Dv)`. A smaller requested dt is respected. Browsers without
WebGL2 or float render targets use the double-precision CPU midpoint engine.
Context loss pauses the simulation and reports that it must be restarted.
The periodic optimizer and its acceptance checks run independently in the
CPU worker, so GPU acceleration alone never establishes orbit validity.

## What validation means

`problem.diagnostics(field,period)` reports:

- `pdeRms`: absolute Crank–Nicolson defect, across U and V.
- `relativePde`: defect divided by the larger RMS of the discrete time
  derivative and averaged vector field, not by concentration magnitude.
- `temporalRms` and `spatialRms`: variation after removing each node's time
  mean or each frame/species spatial mean.
- `symmetry`: RMS and maximum errors for **every** supplied operation.
- `temporalRepeats`, `faithfulTimeShifts`, `primitiveAtTestedShifts`: detect
  quarter/half-period repeats and a collapse of the specified time character.
  Set `requireFaithfulTimeShifts:true` to reject a nominal nonzero shift that
  acts trivially. Ordinary validation requires the supplied symmetries and
  allows extra symmetry; it does not classify the full isotropy group.
- `periodicConstruction:true`: indexing wraps by definition; this is **not**
  evidence that PDE evolution returns.
- `closure`: independent, unprojected RK4 evolution from the first frame,
  including U/V return errors and mismatch against the entire candidate
  trajectory. Relative errors are normalized by temporal variation.

Validation requires variation floors, physical concentrations, small PDE and
symmetry residuals, and both small return and trajectory errors in independent
shooting. Default gates are absolute PDE RMS ≤2e-4, relative PDE ≤.05,
absolute shooting errors ≤.01 and relative shooting errors ≤.1. These are
explicit numerical acceptance tolerances, not an existence theorem. The
status says “numerically validated candidate”; establish continuum accuracy
by refining space and time and repeating forward integration at smaller dt.

Independent shooting defaults to dt≤.5 and a conservative diffusion step
bound; it takes an integer number of steps per frame. The default cap is
30,000 steps. If the requested period/grid requires more, validation is
skipped with a reason, never silently performed at an unsafe larger dt.
`shootingSteps`, `shootingDt`, `maxShootingSteps` and `thresholds` can be
supplied to `diagnostics` or `fitOrbit`.

## Run locally and reproduce

From the repository root, serve the static site with:

```sh
python3 -m http.server 8934 --directory docs
```

The viewer contains only independently admitted periodic fields. Select a group,
then a precomputed physical parameter set, then a verified pattern at those
parameters. The map snaps to an actual record; thumbnails distinguish the
available patterns and their periods. Search settings supply
initial guesses or continue a selected verified orbit; they never replace the
viewer with an unverified transient. Read [EXPLORATION.md](EXPLORATION.md) and
[VERIFIED-ORBITS.md](VERIFIED-ORBITS.md) for the workflow and bundled evidence.

`research/build-catalog.mjs` performs numerical admission offline and writes
`data/precomputed-atlas.json`, including accepted parameter sets, diagnostics,
and thumbnails. Normal page loading reads this stored catalog. Selecting a
pattern fetches its concentration payload and checks SHA-256 integrity; it
does not rerun the PDE or search for valid parameters. Explicit new searches
still run the solver and independent acceptance tests.

After changing bundled orbits or the numerical acceptance code, rebuild the
catalog from `docs/scott-gray` with:

```sh
node research/build-catalog.mjs --verify
```

This reruns independent admission and saves diagnostics and thumbnail URLs
in `data/precomputed-atlas.json`, with generated images in `data/thumbnails/`.
To check the committed catalog's source hashes, evidence, and deterministic
thumbnails without reintegrating the PDE, run:

```sh
node research/build-catalog.mjs --check
```

The freshness check rejects changes to the source manifest, group actions,
or verification code until a full offline rebuild has been performed.

From this directory (`docs/scott-gray`), with Node 20 or newer:

```sh
node --test tests/*.test.mjs
node search.mjs --group=all --iterations=200 --output=results
node search.mjs --group=g96 --grid=64 --frames=64 --length=96 --period=1200 --iterations=1000 --output=results-fine
```

`search.mjs` writes a JSON report and float32 planar field for each group.
The default run reproduces the settings of the six exploratory searches:
N=32, M=32, L=96, initial T=1200, F=.062, k=.0609, temporal floor=.012,
spatial floor=.04. The browser starts with lower variation floors (.008 and
.012) to permit thinner localized structures. `--min-motion` and `--min-space`
control these CLI floors. `--feed`, `--kill`, and `--seed=skate|worms|spiral`
permit further searches. Changing a seed or numerical parameter makes a new
experiment, not a refinement certificate.

The numerical tests check exact projection and PDE equivariance for all six groups,
finite-difference field/period gradients, penalties and phase condition,
optimizer descent, rejection of trivial and kinematic loops, live-integrator
consistency, independent RK4 against an exactly soluble diffusion/feed mode,
and an independent one-frame replay of the bundled actual spiral movie.
Both stencils are checked; the nine-point adjoint is compared with finite
differences, and an exact two-direction Fourier mode checks its normalization.
Open [the browser GPU tests](tests/webgl.html) to run actual float-framebuffer
tests for CPU/GPU numerical agreement, parameter updates, kernel projection,
palette and orientation, CPU/GPU node placement and periodic seams, timestep
limits, and context-loss reporting. These require a real WebGL2 context; they
are separate from Node's CPU tests.
The overlay tests additionally verify exact correspondence-source glyphs,
short forms and directed phases, check that each marked center is fixed by
its affine operation, and test the asymmetric g98/g99 canvas coordinates.

A positive control from high-accuracy ODE shooting passes orbit validation
for g94 with the spatial-contrast floor explicitly disabled. It fails the
shifted group symmetries at its minimal period and the patterned-orbit gate.
`tests/oscillator.json` stores it. To independently recompute this fixture,
with NumPy and SciPy installed:

```sh
python3 tests/reproduce_oscillator.py oscillator-reproduced.json
```

`groups.json` is extracted from `../data/catalog.json`; the tests consume
that same operation data as the browser. Upstream seed/movie licensing,
processing, and verification are documented in `data/README.md`.

## Current scientific result

The initial six 200-iteration U-skate searches reduced the residual and
retained exact time symmetry, but failed independent forward closure and
trajectory agreement. Those attempts remain unverified. Subsequent Newton
shooting found nonuniform periodic standing and rotating concentration
waves, including different standing spatial modes at identical physical
parameters. Their separately checked coordinate variants satisfy all six
requested time characters. See [the delivered-data evidence](VERIFIED-ORBITS.md),
[distinct spatial modes](research/HIGHER-SPATIAL-MODES.md), and the current
[asset manifest](data/verified-orbits.json).

These are numerical solutions of the discretized equation with spatial
refinement evidence, not a continuum existence proof or verified U-skate
gliders. The bundled spiral recording remains a transient; the homogeneous
oscillator remains a solver control rather than a patterned atlas solution.

## Strict cyclic-phase admission

`solution-atlas.mjs` provides numerical admission for the offline catalog
builder and for explicitly requested new searches. It ignores submitted
diagnostics, copies the complete field and parameters,
and uses the exact selected `groups.json` operations. In addition to the gates
above, it integrates through `T + max(tau)*T` so every future-phase comparison
uses an actual independently evolved state. It repeats this at half the actual
timestep, requires strictly positive diffusion, and returns immutable records.
The offline builder stores accepted records in `data/precomputed-atlas.json`.
The parameter map snaps to these precomputed records without repeating
admission. The browser checks the selected binary's SHA-256 integrity; that
inexpensive check establishes that playback uses the verified bytes, not a
new numerical verification.

`phase-audit.mjs` measures shifted, same-time and pure-phase differences over
both species at every grid site. A nonzero phase must exceed 0.002 RMS and four
times the measured numerical uncertainty. Shifted errors must meet the absolute
0.01 and relative 0.1 bounds. For the exact candidate, symmetry tolerance remains
1e-10. The temporal Fourier energy tests every resolved shorter-period divisor,
including odd divisors, and rejects poorly resolved temporal spectra. This
prevents an ordinary spatially symmetric animation or a repeated-period
relabeling from passing as the requested cyclic character.

These remain finite-grid tests. The bundled waves also have N24→N48 spatial
refinement evidence; no continuum existence or exhaustive minimal-symmetry
classification is claimed. Additional spatial symmetries of a particular
solution are explicitly allowed, provided the selected phase character is
satisfied and its nonzero shifts are resolved.

## Independent shooting reproduction

With Python, NumPy, SciPy and a C++17 compiler:

```sh
python3 research/reproduce_orbits.py --family rotating --grid 24 --frames 128 --output /tmp/gs-rotating
python3 research/reproduce_orbits.py --family standing --grid 24 --frames 128 --output /tmp/gs-standing
node research/audit_orbit.mjs /tmp/gs-rotating/g96.json
node research/audit_orbit.mjs /tmp/gs-standing/g95.json
```

The shooting code starts from analytic spatial Hopf modes and solves the
rotation-twisted quarter- or half-period return equation with a phase condition.
It does not impose symmetry during RK4 evolution. The offline audit then uses
an independent JavaScript integrator and every catalog operation for admission.
A root-solver success flag is never sufficient by itself.
