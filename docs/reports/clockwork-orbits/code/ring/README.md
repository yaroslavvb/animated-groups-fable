# `ring/` — the whole method on three cells

Section 2 of the tutorial in runnable form. Three identical Brusselator cells on a ring, with the
clockwork symmetry **"move one step round the ring = wait a third of a period"**, which is the
g227 problem with **six** unknowns and a period instead of 2 592 and a period.

Nothing here reads the repository, the network or any data file. NumPy and SciPy are the only
requirements; `matplotlib` and `pillow` are used in the figure stage, after the numbers are
written.

| file | what it is |
|---|---|
| `ring.py` | the laboratory: the equation, the ring shift, the character, the pencil seed, RK4, the twisted shooting residual, Newton, the monodromy and its Floquet multipliers, the history buffer and the delayed glue |
| `run_all.py` | runs everything and writes `results.json` and `figs/*.png`, plus the same figures as `.webp` into the page's `assets/` |
| `results.json` | every number section 2 of the tutorial quotes; the page reads its values at build time rather than repeating them by hand |

```sh
python3 run_all.py               # about twelve minutes on one core
python3 run_all.py --quick       # coarser integration, about two minutes
python3 run_all.py --figs-only   # redraw the figures from an existing results.json
```

## The setup, in full

Cells `j = 0, 1, 2`, two species each:

```
u_j' = a - (b+1) u_j + u_j^2 v_j + D (u_{j+1} + u_{j-1} - 2 u_j)
v_j' = b u_j       - u_j^2 v_j   + D (v_{j+1} + v_{j-1} - 2 v_j)
```

with `a = 1` and `b = 2.3`, the parameters of the published g227 record, and coupling
`D = 0.02`. The clockwork constraint is `q(t + T/3) = S q(t)` with `(S q)_j = q_{j-1}`, so the
twisted shooting residual is

```
F(q0, T) = S^-1 Phi_{T/3}(q0) - q0
```

and a zero of it is a solution with `q_{j+1}(t + T/3) = q_j(t)`, i.e. the three cells carrying one
trace between them, each a third of a period behind the last.

## Why `D = 0.02`

The coupling has to be weak enough that the pattern the symmetry asks for exists at `b = 2.3`.
The ring's Laplacian has eigenvalue `-3` on that pattern, so it goes Hopf at
`b = 1 + a^2 + 6D = 2 + 6D`; at `D = 0.02` that is `2.12`, comfortably below 2.3, and the
resulting orbit has a healthy amplitude. Above `D = 0.05` the pattern has not been born yet at
`b = 2.3` and there is nothing to find.

That choice does **not** rig the interesting part. Whatever `D > 0` is, the in-phase state is an
attractor and the clockwork orbit is a saddle, for the reason `run_all.py` measures: with equal
diffusion the coupling term is a multiple of the identity, so a pattern perturbation of the
in-phase cycle decays exactly like `exp(-3 D T)` times the (already contracting) single-cell
monodromy. Plain simulation therefore synchronises for every coupling strength, and the delayed
glue is what makes the orbit reachable. `D` only sets how far above onset the ring sits.

## What to expect

Printed by `run_all.py`, and stored in `results.json`:

* the surviving ring pattern — one of the three projects to **1** onto the clockwork character and
  the other two to **0**, which on a computer means about `2e-16`;
* the Hopf data of the 2 × 2 reaction Jacobian, eigenvalues `0.15 ± 0.988686i`, period estimate
  `T0 = 6.3550868`, and the uniform limit cycle's rms amplitude `0.5604`, which is the seed
  amplitude rule;
* Newton from that seed: **5** steps, residual `1.72e-01 → 9.0e-13`, period
  `T = 6.36610555907`. That value is stable under refinement: `--nstep 600`, `1200`, `2400` and
  `4800` — time steps from `3.5e-03` down to `4.4e-04` — all agree to `8e-12` absolute, i.e. to
  eleven significant figures, `6.3661055591`;
* the Floquet multipliers: the clockwork orbit is a **saddle**, leading modulus **1.2549** per
  period, while the in-phase cycle has everything inside the unit circle, **0.6800** in the pattern
  direction — which matches `exp(-3 D T)` to four digits;
* plain simulation from **5** random starts, 400 time units each: all five synchronise, the
  pattern amplitude falling by **0.681** per period to about `1e-10`;
* the delayed glue from white noise: **23** periods to a relative period error of about `1e-12`,
  with the shape error contracting by about **0.26** per period, from four different seeds;
* the amplitude window: Newton reaches the orbit from every seed amplitude between **0.20** and
  **0.70**; `0.05` stalls, `0.10` diverges, `0.90` converges to a different, long-period solution
  and `1.20` does not converge at all.

## Honest notes

* The Jacobian is formed outright by finite differences because it is 7 × 7. On the real problem
  the same Jacobian is 869 × 869 and is reached only through directional derivatives. That is the
  only structural difference between this solver and the one the tutorial's section 3 uses.
* `0.5604` is this script's own measurement of the uniform limit cycle's rms. The real problem's
  recorded value for the same two-variable rule is `0.558`; the 0.4 % gap is how the cycle is
  sampled, not a different rule.
* The delayed glue's contraction factor, like the real problem's `0.692`, is **measured**. The
  delayed system's state is a history segment, so it is infinite-dimensional and its spectrum is
  not the ring's spectrum restricted to a subspace.
* The toy has no counterpart for the forced vortices of the companion theorem report: with three
  cells there is no plane for phase to wind in. Everything else transfers step for step.
* Wall times are dominated by pure-Python RK4 on a six-element array. The run is short enough not
  to matter and long enough to notice; `--quick` halves the accuracy and quarters the time.
