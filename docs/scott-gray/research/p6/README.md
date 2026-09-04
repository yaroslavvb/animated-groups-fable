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
No Modal jobs were launched for the 632 search; additional cloud spend was $0.

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

## Scope of the evidence

The catalog contains finite-grid numerical solutions, not a rigorous existence
theorem for the continuum PDE. Every admitted field has its own period,
generator-offset checks, nonzero spatial and temporal amplitudes, independent
evolution checks, and spatial refinement record. A failed continuation step is
not evidence that the selected group or parameter is impossible. In particular,
the first-shell third-period branch did not converge at `F=0.00404`, and the
sixth-period first-shell coarse solution at `F=0.00400` did not refine with the
chosen solver settings. Those attempts are excluded from the atlas.

`search-report.json` records the successful candidates, rejected attempts,
refinement measurements, and local-only compute provenance for this batch.
