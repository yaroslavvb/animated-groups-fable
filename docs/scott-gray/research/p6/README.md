# Offline 632 periodic-orbit search

This search computes nonconstant Gray–Scott periodic orbits on the triangular
torus. The orbit is integrated directly with RK4. Spatial generators act with
their prescribed time offsets; no animated spatial warp or projected evolution
is used to produce the movie. Every exported Float32 movie must subsequently
pass the independent JavaScript catalog audit.

The physical lattice basis is `(1,0), (-1/2,sqrt(3)/2)`. Equal-length neighbors
are `±(1,0), ±(0,1), ±(1,1)`, with Laplacian coefficient `2/(3h²)`.
All initial samples hold `Du=0.16`, `Dv=0.08`, `k=0.02`, and lattice side `L=256`
fixed. Feed `F`, the spatial Fourier seed, and the cyclic rotation character
select the branch. These first examples are concentration waves, rather than
Bulatov's localized gliders.

## Search method

At the nonzero homogeneous equilibrium, the first triangular Fourier shell
undergoes a Hopf bifurcation. A cyclic character projection supplies a seed for
each rotation phase `q/6`, with `q=0,1,2,3`. Characters `q=4,5` are obtained by
reflecting the solved `q=2,1` fields through `(x,y) -> (y,x)`. This reflection
preserves the triangular PDE and reverses the rotation character. Each reflected
field is independently audited against its own full canonical operation list.

The first solve fixes a nonzero seed projection and solves simultaneously for
the field, period, and feed. Continuation then fixes the feed. The shooting
equation is

```
Phi_(tau*T)(u0) = u0(R60^-1 x),   R60 = [[1,-1],[1,0]]
```

with a time phase condition. Instantaneous kernel symmetries reduce the state
unknowns, but the flow itself is never projected. For the trivial character,
the equation uses a full period and an identity spatial operation.

Dense Newton shooting is effective for small grids. Fine grids use a
Fourier-block preconditioned Newton–Krylov solve. Rotation permutes Fourier
modes with the same triangular Laplacian eigenvalue. Diagonalizing each finite
rotation cycle reduces the approximate linear flow inverse to 2×2 concentration
matrices. The period variable is handled with a scalar Schur complement. This
is a preconditioner for the full nonlinear shooting residual; it does not change
the Gray–Scott equation or remove Fourier modes from the computed field.

In the recorded sixth-period refinement at `F=0.00408`, `N=48`, dense Newton
took about 222 seconds and the preconditioned solve about 2.3 seconds. They
converged to the same orbit to roundoff. These timings cover the nonlinear solve
on this machine, not compilation, movie export, or independent auditing.
The initial 22-entry 632 atlas was computed locally, with no Modal jobs or cloud spend. Subsequent diversity searches use bounded Modal CPU and GPU batches; this historical statement does not describe their cost. See the current diversity and compute reports for that later work.

## Reproduce a branch

Requires Python 3, NumPy, SciPy, and a C++17 compiler. Run from this directory:

```sh
python3 search.py --charge 1 --grid 12 --amplitude .018 --output /tmp/p6-seed
python3 search.py --charge 1 --grid 24 --initial /tmp/p6-seed/candidate.json \
  --feed .00408 --output /tmp/p6-coarse
python3 search.py --charge 1 --grid 48 --initial /tmp/p6-coarse/candidate.json \
  --feed .00408 --method krylov --output /tmp/p6-fine
python3 export.py --case /tmp/p6-coarse/candidate.json /tmp/p6-fine/candidate.json
```

`export.py` writes an **unaudited candidate index**, binary metadata, and
Float32 fields under `../../p6/data/`. It records a full-movie comparison
between coarse and fine grids at fixed physical parameters. Passing shooting
alone never admits a field into the browser atlas; the catalog builder performs
the independent gate before it can be shown.

Use `--charge 2` for a third-period shift, `--charge 3` for a half-period shift,
and `--charge 0` for instantaneous sixfold spatial symmetry. The zero character
starts reliably at a smaller amplitude, such as `.006`, and can then be
continued upward. `--predictor` scales the previous seed amplitude using the
distance from the linear Hopf point before correcting at a new feed.

`--mode 2` seeds twice as many repetitions along both lattice directions.
`--shell 3` instead seeds reciprocal wavevector `(1,1)`, with squared physical
wave number three times that of `(1,0)`. The latter supplies a distinct pattern
at the same feed as a first-shell solution. Both options require a new shooting
correction and new independent verification.

### Searching for distinct morphologies

`--wavevector A B` generalizes the initial Fourier star to any nonzero integer
reciprocal vector. Its squared physical wave number is proportional to
`A*A + A*B + B*B`. Unlike the older mode/shell shortcuts, this option does not
impose extra translation symmetries. At generic vectors such as `(2,1)`,
`(3,1)`, and `(3,2)`, the reflected vector `(B,A)` belongs to a separate
six-mode star with the same linear eigenvalue. `--reflected-mix` adds this
second star, and `--mix-phase` chooses its relative temporal phase in turns.
The resulting initial conditions can find mixed structures that a single-star
search misses. An initial mixture is only a search seed: the converged full
field must retain distinct structure and pass the same independent audit.

`--seed-translations` optionally keeps exact translations shared by both seed
stars: repetitions given by `gcd(A,B)` and, where compatible with the grid,
a one-third diagonal shift. This reduces dense coarse searches substantially.
The default generic-star search uses the full torus so symmetry-breaking
branches remain accessible. A full-movie comparison of the `(4,1)` seed
with and without this option agreed within `4.3e-11`; the independent PDE
and nontriviality gates are unchanged.

For charges zero and three, `--mirror-axis J` optionally restricts the state to
the instantaneous mirror `R60^J S`, where `S(x,y)=(y,x)`. This is an additional
symmetry, never a replacement for the requested cyclic time offsets. It can
reduce the size and ill-conditioning of mixed-star searches. A mirror is not
compatible with an instantaneous kernel for charges one and two, and the
command rejects those combinations.

For example, the following starts a mixed-star seed without assuming its feed:

```sh
python3 search.py --charge 3 --grid 24 --length 512 --wavevector 2 1 \
  --reflected-mix 1 --mirror-axis 0 --amplitude .018 \
  --output /tmp/p6-mixed-seed
```

Continue a seed by prescribing a common `--feed` and passing its
`candidate.json` as `--initial`. Dense shooting is often more reliable for
coarse mixed structures. Fourier preconditioning can also be used with
amplitude-constrained seeds; a small feed offset regularizes its homogeneous
blocks at the exact Hopf point while leaving the residual unchanged.
`--precondition-state-mean` optionally uses the spatially averaged initial
reaction derivatives instead. These are solver choices, not changes to the
reaction–diffusion model.

A different seed or field hash does not establish a new morphology. Search
batches should compare movies modulo time origin, periodic spatial
translations, and allowed lattice rotations/reflections, then inspect their
spatial spectra. Single-star fields at different wavelengths should be labeled
as repeating waves, rather than being described as unrelated morphologies.

### Batched GPU correction

`diversity_modal.py` corrects already prepared mixed-star seeds with batched
FP64 CUDA shooting Jacobians. `rk4_batch_triangular.cu` implements the same
six-neighbor stencil as the native C++ integrator, with coefficient `2/(3h²)`.
Every remote job first compares its CUDA flow with an independently compiled
native flow at identical steps. It also checks the corrected twisted return
with native RK4 at a step limit of `0.1`. A remote success is still only a
candidate for the separate public Float32 catalog audit.

The worker uses up to two A100 40GB containers, no retries, a 180-second run
timeout, and a 180-second startup timeout. Each invocation accepts at most
eight seeds; project-wide budgets must also be accounted for across batches.
It supports lattice sizes divisible by six from 12² through 96², with at most
10,000 Newton unknowns. Existing exact translations are detected from each
supplied initial state, including a possible one-third diagonal translation.
They and declared instantaneous kernel symmetries reduce the unknowns while
preserving the full physical domain and unprojected evolution. In particular,
a high-frequency repeating wave can use a finer grid without needing a full
unrestricted dense Jacobian. Generic sixth-period fields can use 48²→66²
refinement within this bound; comparisons need not use a factor of two. Damped least squares is used only
when an ordinary Newton search direction fails to reduce the same residual.

After a GPU correction, `search.py --export-initial --initial report.json
--feed ...` independently checks the supplied initial state using native
shooting before exporting a full movie. This option requires a fixed feed and
does not perform another Newton solve. `--frames 96` creates a native movie
with 96 saved phases; the independent public audit must pass at that actual
sampling rate. Spatial convergence comparisons use the same phase sampling
on both grids, with all physical parameters fixed.

### Exact repeated cells

`repeat_orbit.py source.json --repetitions 2 --output ...` creates a larger
periodic domain from a known native orbit, holding grid spacing and all reaction
parameters fixed. It then independently evolves the enlarged initial state and
requires its entire Float32 movie to equal the repeated source. The result is
explicitly labeled a repeated known branch, not a newly discovered morphology.
Its final grid must remain at or below the existing catalog limit of 126; the
usual catalog and visible-offset audits are still required.

### Regression checks

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 -m unittest discover \
  -s docs/scott-gray/research/p6 -p 'test_*.py'
```

The native shooting test checks that reciprocal seed indices survive kernel
enumeration and that equivalent primitive/repeated cells produce the same
physical movie. The collection test checks that a failed worker cannot discard
other completed results. `result_collection.py` records the failure without
retries; the driver also saves function-call identifiers for recovery.

## Scope of the evidence

The catalog contains finite-grid numerical solutions, not a rigorous existence
theorem for the continuum PDE. Every admitted field has its own period,
generator-offset checks, nonzero spatial and temporal amplitudes, independent
evolution checks, and spatial refinement record. A failed continuation step is
not evidence that the selected group or parameter is impossible. In particular,
the first-shell third-period branch did not converge at `F=0.00404`, and the
sixth-period first-shell coarse solution at `F=0.00400` did not refine with the
chosen solver settings. Those attempts are excluded from the atlas.

`search-report.json` records the initial 22-entry local atlas. Later diversity
experiments are recorded separately: `search-grid-gpu.json` lists bounded GPU
corrections, input hashes, numerical outcomes, and measured function times;
`search-grid-local-stars.json` records the local twelve-star exploratory sweep.
These research records include failures and do not bypass catalog admission.

The completed P6 diversity run submitted 81 GPU jobs in 15 bounded batches;
all of its Modal applications were observed stopped. Returned function times
total 2,350.71 seconds. Charging two GPUs for the full observed lifetime of
every application, including timestamp rounding, gives a conservative bound
of 3,430 GPU-seconds. These are resource measurements, not an invoice; the
combined project estimate and prior-work reserve are recorded in
[`../diversity-compute-ledger.json`](../diversity-compute-ledger.json).

At the common point `F=0.00406`, `k=0.02`, `L=1024`, ten searched sixth-period
branches completed refinement and the independent public Float32 gate. Their
seed norms are `Q=9,12,16,21,25,27,28,31,36,37`. These include repeating waves
at different wavelengths; they are not ten unrelated morphology families.
An additional explicitly repeated interwoven branch uses a known `L=512`
orbit with the same physical grid spacing, with `96²→120²` refinement on the
larger domain. The catalog, rather than this search inventory, determines
which candidates pass all final checks and remain distinct.
