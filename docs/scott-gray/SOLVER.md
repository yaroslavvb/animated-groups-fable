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

## Numerical method

For each periodic time edge, the residual is

```
r[k] = (q[k+1]-q[k])/(T/M) - (F(q[k+1])+F(q[k]))/2,
q[M] = q[0].
```

`F` here denotes the full reaction–diffusion vector field, with the five-point
square-grid Laplacian. The objective is half its mean square divided by
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

Open http://localhost:8934/scott-gray/. The initial view is a genuine,
nonperiodic 442 spiral trajectory. Each group button opens a separately
labelled geometric preview. The source-seed button loads actual U-skate
concentrations; forward evolution applies only the instantaneous spatial
kernel. Trial-period playback stops at the last recorded frame.

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

The 12 tests check exact projection and PDE equivariance for all six groups,
finite-difference field/period gradients, penalties and phase condition,
optimizer descent, rejection of trivial and kinematic loops, live-integrator
consistency, independent RK4 against an exactly soluble diffusion/feed mode,
and an independent one-frame replay of the bundled actual spiral movie.

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

All six 200-iteration patterned searches reduced the residual and retained
exact time symmetry, but failed independent forward closure and trajectory
agreement. These are unverified candidates. The bundled real spiral movie
is a transient, not a periodic orbit. The homogeneous oscillator is a
successful solver verification case, not a glider. No nonuniform periodic
442 Gray–Scott orbit is claimed by this implementation.
