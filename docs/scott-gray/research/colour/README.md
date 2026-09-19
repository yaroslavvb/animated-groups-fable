# More equations for the three-colour pages

`../gyre/`, `../triskele/` and `../trefoil/` all paint one Gray–Scott orbit. This directory
looks for **other** hexagonal periodic orbits that the same two colour rules can be applied
to, from equations other than the three the site already publishes, so that each rule gets a
family page instead of a single picture.

Everything here extends `../equations/rdlab.py` and re-uses `../equations/admit.py`; neither
file is edited. Records carry the gate `colour-offline-v1` and the SHA-256 of
`rdlab.py` + `admit.py` + `rdlab_colour.py`.

## The two rules, in lattice coordinates

With `R` the 120° turn `(u, v) -> (-v, u - v)` on the hexagonal lattice
(`a1 = (1,0)`, `a2 = (-1/2, -sqrt3/2)`), and `U` the first channel of a `T`-periodic field:

**Gyre** `colour(x, t) = argmax_k U(g^k x, t + k T/3)`, with `g` a third-turn about a point
`p` that is *not* a symmetry centre of `U`. On an `N`-node mesh every admissible `g` is
`x -> R x + w (mod N)` for an integer `w`, and the turn centre is `p = (I - R)^{-1} w / N`.
Because `I + R + R^2 = 0`, `g^3 = id` for every `w`, so
`colour(g x, t + T/3) = colour(x, t) - 1` holds exactly for *any* `T`-periodic field. What
the search is really looking for is a field and a `w` for which the rule is also *good*: no
argmax ties, balanced colours, chunky regions, no speckle, and no exact colour-preserving
symmetry beyond the lattice.

**Trefoil** `colour(x, t) = argmax_k U(x + k b, t)` with `b = (1/3, 2/3)`. `R b = b` (mod L),
so translation by `b` cycles the colours with no time shift at all. The colour group is `S3`
— with the transpositions *entangled* — as soon as the field also satisfies
`U(h x, t + T/2) = U(x, t)` for an operation `h` with `h b = -b` (mod L).
`rdlab_colour.hosts_trefoil` finds those operations in each entry:

| entry | signature | b-reversing half-period operations |
| --- | --- | --- |
| `g247`, `g248` | `⁶6³3²2` | the half-turn |
| `g246` | `²6¹3²2` | the half-turn and the two sixth-turns |
| `g269` | `∗¹6²3²2` | the half-turn, two sixth-turns |
| `g271` | `∗²6¹3¹2` | half-turn, sixth-turns and three mirrors |
| `g233` | `¹3∗²3` | three mirrors |
| `g270` | `∗²6²3²2` | three mirrors |

`rdlab_colour.tie_risk` flags the *same-time* operations that map some `x` onto `x + k b`:
on those fixed lines `U(x) = U(x + k b)` by symmetry and the argmax is a coin flip, which is
exactly why the square-lattice Plume route was rejected in `research/s3-design.md`. Only
`g225`, `g226`, `g247` and `g248` carry no such line at all.

## Equations

`rdlab_colour.py` adds, to rdlab's Gray–Scott / Ginzburg–Landau / Brusselator / Barkley /
FitzHugh–Nagumo: **Schnakenberg**, **Selkov**, **Gierer–Meinhardt** (basal production and
saturation), **Lengyel–Epstein** (CIMA), the two-variable **Oregonator**, a **cyclic
three-species replicator** (rock–paper–scissors, written on two channels because the
equal-diffusion replicator conserves `u0 + u1 + u2 = 1`), a general **λ–ω** family with real
diffusion, and **cubic-quintic CGL**. Each entry of `PARAMETER_SETS` records a parameter set
with its uniform-state Hopf eigenvalues; `python rdlab_colour.py --smoke` re-derives them and
integrates each one in zero dimensions to show it really oscillates.

The λ–ω and cubic-quintic CGL families are *phase symmetric* (`A -> e^{iφ}A`), so like CGL
they have exact relative equilibria `B(x) e^{iΩt}`; everything else needs Newton–Krylov
twisted shooting.

## Files

| | |
| --- | --- |
| `rdlab_colour.py` | equations, relative equilibria, colour rules and their measurements, admission wrapper |
| `search_colour.py` | job plans, the pool driver, per-job time box, `out/<batch>/<job>/` records |
| `report_colour.py` | outcomes per equation and per entry, per-job cost, admitted records |
| `out/ledger.jsonl` | one line per job, appended by the driver |

```sh
python rdlab_colour.py --hosts            # which entries host which rule, and their tie risk
python rdlab_colour.py --smoke            # Hopf eigenvalues + a short integration per parameter set
python search_colour.py --plan first --run --workers 14 --budget 150 --deadline 1150
python search_colour.py --plan long  --run --workers 14 --budget 600 --deadline 14400
python report_colour.py --records
touch out/STOP                            # ends a running batch after the job in flight
```

## What the measurements mean

`gyre_quality` and `trefoil_quality` return the numbers the pages quote, computed from the
exported Float32 bytes. Run against the published field (`../gyre/field.f32`, 66 × 66 × 96)
they reproduce `research/s3-design.md` exactly: Trefoil ties 0, both laws 1.0, balance
exactly 1/3, boundary density 0.29025, speckle 9e-5, best purely spatial transposition
**0.540375** and best mirror **0.477531**; Gyre ties 0, law 1.0, balance exactly 1/3,
boundary density 0.30035, speckle 1.3e-4, no exact colour-preserving symmetry beyond the
lattice and the best colour-preserving point operation at 0.5975. Those are the thresholds
`search_colour.usable_gyre` / `usable_trefoil` apply.
