# Parameter exploration and evidence

The default filter is **Verified periodic solutions**. It currently contains no
nonuniform 442 time-symmetric solution. A named preset or a moving animation is
not enough to pass this filter. Use the other modes explicitly to explore
candidates.

- **Explore freely** accepts any F in [0, 0.2], k in [0, 0.08]. These are chart
  bounds, not a proven existence region. Uniform steady solutions exist at every
  nonnegative F,k; interesting moving or periodic patterns may not occur.
- **Bulatov presets** snaps to 81 exact named F,k pairs from
  [Vladimir Bulatov's source](https://github.com/vbulatov2011/symhub/blob/37e3520df40ba0ef38e2c916090790b9bbaec3dc/apps/symsim/gray_scott/js/gray_scott_presets.js).
  The source names describe behaviors encountered in his simulator, with suitable
  seeds and numerical settings. They are leads for exploration.
- **Observed moving patterns** selects only discrete preset points with finite,
  nonnegative, nonuniform changing concentrations in the recorded local screen.
  Loading a tested point must also load its complete grid, seed, stencil and
  numerical settings. An interval between tested points has no such evidence.
- **Verified periodic solutions** requires the independent periodic return and
  full time-symmetry checks described in `SOLVER.md`. No preset screen is accepted
  as a substitute. The current evidence file marks every trial
  `verifiedPeriodic: false`.

Bulatov's numerical defaults are Du=0.2097, Dv=0.105, Euler dt=0.8, and the
nine-point stencil 0.8 times the four axial neighbors plus 0.2 times the four
diagonal neighbors minus 4 times the center. Its leading continuum coefficient
is 1.2. The local tests retain these diffusion coefficients and stencil weights,
but use explicit midpoint dt=0.4 to match this laboratory's integrator.

## Reproducing the screen

With Node.js 20+ and a C++17 compiler, from the repository root:

```sh
node docs/scott-gray/tests/sample-presets.mjs docs/scott-gray
```

The script reads `exploration.mjs`, uses the same exported `makeInitial` function
as the browser, and writes `data/preset-evidence.json`. It creates temporary
native code build products outside the repository and removes them on exit.
No Python packages or npm dependencies are required.

The screen tests 13 featured presets for each of the six groups. Every run uses
N=64, L=128, periodic spatial boundaries, float32 concentrations, and a duration
of 2000. Five observations at t=1800, 1850, 1900, 1950 and 2000 determine:

- Spatial RMS: fluctuations about each species' spatial mean, combined across
  the observations; threshold 0.012.
- Temporal RMS: fluctuations about each cell and species' five-sample mean;
  threshold 0.0001.
- Finite values and concentration range [-0.000001, 2].

A passing run is classified `moving-pattern`. A low spatial RMS is
`uniform-or-decayed`; a low temporal RMS with spatial contrast is
`stationary-pattern`. Neither failure proves nonexistence. The tested state can
be a transient or chaotic, and continuing longer can change its classification.

Only each group's zero-time spatial kernel is built into the initial condition.
The autonomous PDE preserves that kernel up to roundoff; the final kernel RMS is
also recorded. The nonzero time shifts are **not imposed or tested** by this
screen. For example, a g96 candidate has no nontrivial instantaneous kernel, and
ordinary free evolution of it need not satisfy its quarter-period rotation.

The local `skate`, `spots` and `broken-wave` seeds are deterministic geometric
initial concentrations. They are not evolved source fields or recreated source
solutions. The separate `data/bulatov-glider.f32` source concentration crop keeps
its existing provenance in `data/README.md`.

## Evidence admission and scope

The observed-preset filter recomputes the classification from finite concentration
and RMS statistics, checks the preset's exact F,k, and requires a complete recorded
context. It rejects malformed records, mismatched labels and a final instantaneous
kernel RMS above 0.001. The assessment function also compares the current F,k,
boundary condition, precision and complete observation window against the record.
Changing any of these settings removes that matching-evidence claim. A matching
record describes the recorded run; it does not certify the current state or all
future times.

A future periodic catalog entry cannot be admitted by setting
`verifiedPeriodic: true`. It must associate a saved concentration asset (URL,
SHA-256 and planar U/V layout) with its configuration and complete diagnostics:
finite nontrivial variation, all group-operation errors, faithful nonzero time
shifts, PDE residual, independent full-trajectory and return checks, and a smaller
integration-step repeat of those checks. The numerical gates match this
laboratory's default tolerances in `SOLVER.md`; supplied looser thresholds are
not used to admit a catalog entry. Quarter/half-period repeat checks also reject
trivial time characters at the tested fractions.

This catalog gate checks an evidence record's completeness and measured results.
It is not itself an orbit verifier or a mathematical existence proof. Diagnostics
must be generated by independent integration of the saved orbit; loading an orbit
must check the saved asset against its recorded hash. Continuum accuracy still
requires a spatial and temporal refinement study. The current catalog has no
such orbit assets, so its strict periodic collection remains empty.
