# `code/` — the search that found the g227 animation, re-run step by step

The tutorial explains one method: the one that actually produced the published g227
Brusselator spiral lattice. These two scripts reproduce it.

| file | what it does |
|---|---|
| `original.py` | Re-runs the search job `g227-bruss-a1b23-L40-s1` on this machine, one step at a time, with the repository's own functions and the job's own settings, and records what each step did. |
| `figures.py` | Draws the two picture strips on the page from what `original.py` recorded. |
| `results.json` | The output of `original.py` that the page's numbers are read from. |

```sh
python3 original.py     # about 2 minutes; writes original-run/results.json and snapshots.npz
python3 figures.py      # writes the gl-t*.webp and newton-*.webp panels into ../assets/
```

`original.py` needs NumPy and SciPy (the job ran NumPy 2.2.6 and SciPy 1.15.3); `figures.py` needs
NumPy and Pillow. Everything runs on an ordinary processor: no GPU, no network, no cost.

## It uses the repository's numerics

Nothing here re-implements the equations. `original.py` imports
`docs/scott-gray/research/equations/rdlab.py`, which holds the triangular-mesh Laplacian, the
Brusselator and Ginzburg–Landau right-hand sides, RK4, the symmetry operations, and the solvers the
job called:

| step on the page | function in `rdlab.py` |
|---|---|
| 1. the rest state and its oscillation | `uniform_equilibrium`, `hopf_eigen` |
| 2. the Ginzburg–Landau seed from noise | `cgl_relative_equilibrium` (written out in the script so it can keep snapshots, then called once more to show the two agree exactly), `cgl_polish` |
| 3. the lift to the Brusselator | `seed_from_complex` |
| 4. Newton–Krylov on one frame and the period | `twisted_residual`, `rpo_polish` |
| 5. the film, the audit, the finer mesh | `flow`, `audit`, `resample_complex` |
| the export of the published file | the steps of `build_equation_atlas.py`, including `space_time_project` |

The job itself is `run_brusselator` in `docs/scott-gray/research/equations/modal_equations.py`;
its settings are row `g227-bruss-a1b23-L40-s1` of `batches/bruss1/jobs.json` next to it.

The script finds the repository through the `AGF_REPO` environment variable, or by walking up
from its own folder, which works when it sits where it is published,
`docs/reports/clockwork-orbits/code/`.

The only changes `original.py` makes to the job are measurements: it counts right-hand-side
evaluations and integrations, and passes a callback to SciPy's `root` so every Newton iterate is
recorded. Neither changes the arithmetic.

## What to expect

* **Step 2.** The `+` sign is tried first and settles into a rotating wave that runs the clock
  backwards; the audit rejects it (symmetry error 1.73). The `−` sign passes (1.4e−15).
* **Step 4.** From the seed at amplitude 0.25, Newton–Krylov takes 43 iterations: 35 in which the
  residual stays above 6e−2, then 8 that take it to about 5e−16, at a period of
  6.390159918584616.
* **Step 5.** The audit passes; re-solving on a 48 × 48 mesh moves the period by 6.2e−6 of itself.
* **Export.** The 48-frame single-precision film it writes has the same SHA-256 as the published
  file, `e47c12f9099fb9d2…`, and a maximum difference of exactly 0.

Wall times depend on the machine; the counts of right-hand-side evaluations do not.
