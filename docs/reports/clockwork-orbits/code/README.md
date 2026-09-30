# `code/` — the scripts behind the tutorial

Four Python files, enough to reproduce the two searches the tutorial describes for the **g227**
Brusselator spiral lattice. They are the experiment scripts as they were run, with one change:
every hard-coded machine path has been replaced by discovery, so nothing private ships here.

| file | what it is |
|---|---|
| `lab.py` | the shared laboratory: loads a catalogue entry, builds the character, the reciprocal shells and the three-wave star, lifts through the Hopf eigenvector, runs Newton–Krylov on the twisted shooting equation, compares orbits and runs the site's own acceptance audit |
| `direct.py` | the deterministic construction: symbol → star → Hopf lift → Newton. One command, no noise, no Ginzburg–Landau stage, no random numbers |
| `dde.py` | the delayed glue: the `333` fundamental domain, the history buffer, four-point Lagrange interpolation, RK4 on the delay-differential system |
| `reduced.py` | the reduced right-hand side on the 146 representatives, and the expander back to the full 1296-node cell |

## They import the repository's own numerics

Nothing here re-implements the equations. `lab.py` puts
`docs/scott-gray/research/equations/` and `docs/scott-gray/research/wallpaper/` on the import
path and imports `rdlab.py` — the repository's Laplacians, its Brusselator right-hand side, its
RK4, its `twisted_residual`, its `rpo_polish` and its `audit`. That is deliberate: the point of
these experiments was to measure the published pipeline, not a lookalike of it. The catalogue
entries come from `docs/scott-gray/wallpaper-groups.json` and the published records from
`docs/scott-gray/data/equation-orbits/`.

So the scripts need a checkout of `animated-groups-fable`. They find it in one of two ways:

1. the `AGF_REPO` environment variable, if set; otherwise
2. by walking up from this folder until a directory containing
   `docs/scott-gray/research/equations/rdlab.py` appears — which is automatic when this folder
   sits where it is published, at `docs/reports/clockwork-orbits/code/`.

If neither works, `lab.py` says so and names the environment variable.

## Requirements

Python 3.10 or later with `numpy` and `scipy`. `matplotlib` only for the figure scripts, which
are not included here. Everything runs on an ordinary processor; no GPU is used anywhere in this
tutorial, and neither search costs money.

## Reproduce

Put the four files in one directory and run them from it.

```sh
export AGF_REPO=/path/to/animated-groups-fable

# 1. the shell selection rule, in four lines
python - <<'PY'
import lab
entry = lab.load_entry('g227')
for shell in lab.wave_shells(entry, 36, 40.0, radius=2)[:3]:
    print('|k|^2 = %.6f   projection norm = %.3e   survivors = %d'
          % (shell['k2'], shell['projectionNorm'], len(shell['surviving'])))
PY
# |k|^2 = 0.032815   projection norm = 5.774e-01   survivors = 3
# |k|^2 = 0.097947   projection norm = 2.143e-16   survivors = 0
# |k|^2 = 0.130264   projection norm = 5.774e-01   survivors = 3

# 2. the deterministic construction: seed, Newton, audit
python direct.py g227-b2.3 --b 2.3 --shell 1 --sign 1 --amp 0.558

# 3. the delayed glue from white noise, then two Newton steps
python -c "import dde, reduced"   # the modules; assemble.py drives them in the experiment
```

`direct.py --list` prints the cases. Each case writes `cases/<name>.json` with the residual per
iteration, the period, the `compare_orbits` result against the published record and the audit
verdict, plus a `.npz` holding the iterate snapshots and the final 48-frame movie.

`dde.py` and `reduced.py` are libraries rather than command-line tools: the experiment's driver
(`assemble.py`, not shipped) builds the glue, prefills the history, integrates, updates the delay
once per period by the phase-shift feedback, and hands the settled state to `lab.newton_krylov_rpo`.
The browser port in `live/glue/glue.mjs` follows the same sequence and is easier to read; its
reduced right-hand side agrees with the full-torus one bitwise.

## What to expect

`direct.py` at `--amp 0.558` converges in **5** Newton iterations and about **38 904** full-field
right-hand-side evaluations, reaching `T = 6.390159918585126` against the published
`6.390159918584649` — a relative difference of **7.5e−14** — and `compare_orbits` reports the same
orbit at rms **5.05e−08**, which is **1.10×** the float32 round-off floor of the stored record.
Expect roughly ten seconds on a quiet machine.

At `--amp 0.25` it does **not** converge: the verified window at `b = 2.3` is **0.30–0.60**, and
0.25 still stalls after 150 iterations. That is the one free knob, and it is the reason the
tutorial spends a paragraph on it.

## Honest limitations

* These are research scripts. They carry the settings of the runs the tutorial quotes, not a
  general interface, and only g227 at `N = 36`, `L = 40` is exercised end to end here.
* Wall times depend heavily on machine load; the right-hand-side counts are the number to compare.
* `direct.py`'s edge is resolution, not symmetry: at `b = 3.0` Newton still converges to residual
  **1.4e−15** with every winding correct, and the orbit still fails the site's audit, because
  `N = 36` no longer resolves it.
* The delayed glue was demonstrated on g227 only, at `N = 36` and `N = 48`. Whether it generalises
  to mirrors and glides — where the offsets are `0` and `1/2` and the glue's structure changes —
  is untested, and is the most valuable next experiment.
