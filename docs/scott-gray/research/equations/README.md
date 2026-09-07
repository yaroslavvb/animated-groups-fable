# Periodic orbits of two more equations, on the same time-shift actions

The Gray–Scott catalog asks, for each of the 68 forward actions of the
clockwork/colouring correspondence, for a time-periodic solution `q(x,t)` with

```
q(Mx + v, t + τT) = q(x, t)      for every operation (M, v, τ) of the entry.
```

This directory repeats the question for two other equations, so every wallpaper
page can show more than one kind of dynamics under the same symmetry. The affine
actions, the lattices, the admission thresholds and the browser gates are those of
[the Gray–Scott extension](../wallpaper/README.md); only the right-hand side changes.

## The equations

**Complex Ginzburg–Landau**, in the sign convention of Vladimir Bulatov's
[SymSim simulator](https://symmhub.github.io/SymmHub/apps/symsim/ginzburg_landau/symsim_ginzburg_landau_wp.html)
(`A = u + iv`, five-point Laplacian on the square lattice, six-neighbour Laplacian
on the triangular lattice):

```
A_t = A + (1 + iα) D ∇²A − (1 − iβ) |A|² A
```

**Brusselator**:

```
u_t = D_u ∇²u + a − (b + 1) u + u² v
v_t = D_v ∇²v + b u − u² v
```

## Two strategies that were not available for Gray–Scott

*Relative equilibria of Ginzburg–Landau.* The equation is equivariant under the
global phase rotation `A ↦ e^{iφ}A`, so a state of the form `A(x,t) = B(x) e^{iΩt}`
is time-periodic with `T = 2π/|Ω|`, and a phase winding of `B` under a spatial
operation becomes a time shift: `B(gx) = e^{−2πi sign(Ω) τ_g} B(x)` gives exactly
`q(gx, t + τ_g T) = q(x, t)` for both channels. That subspace is *invariant* under
the flow, so `rdlab.cgl_relative_equilibrium` integrates the unmodified equation
from noise inside it (projecting only to remove round-off), until the amplitude
`|B|` stops changing, then `rdlab.cgl_polish` solves `F(B) − iΩB = 0` with a
Newton–Krylov iteration and a global-phase condition to round-off (residual
≈ 1e−13). The saved movie is the exact phase rotation of the converged state.
Both signs of `Ω` are tried; the audit decides which one realises the entry's
directed phases. Topology decides what can exist: a rotation centre of order `n`
with offset `k/n` must carry a phase winding `≡ ∓k (mod n)`, and the windings
over one cell must sum to zero. Every entry whose only nonzero offsets sit on
rotations or translations admitted a solution; entries with a mirror or glide
carrying a half-period shift force `B = 0` along the mirror line, and those
line defects are dynamically unstable in this equation — the independent
unprojected replay rejects them, as it should. Zero-offset references relax to
the uniform oscillation and are not published for this equation.

*Amplitude-equation seeding for the Brusselator.* Near its Hopf point
(`b = 1 + a²`) the Brusselator reduces to a Ginzburg–Landau equation. A
Ginzburg–Landau spiral lattice with the target character, computed on the same
mesh with the reduced coefficients, is lifted through the Hopf eigenvector to a
Brusselator seed, and `rdlab.rpo_polish` then solves the twisted shooting
equation `Φ_{T/m}(q) = q ∘ g^{-1}` for the unprojected Brusselator flow by
Newton–Krylov, with the period as an unknown and a phase condition. The saved
movie is one independent RK4 period from the converged state. Plain forward
integration with kernel projection (the SymSim strategy) was also tried for the
Brusselator and for the Barkley excitable model; it synchronises to the uniform
oscillation or drifts, because a time-shift character is not a state-space
constraint and cannot be imposed step by step. Those attempts are recorded in
the session transcript, not published.

## Admission

`admit.py` re-derives every structural check from the exported Float32 bytes
(all canonical operations at every saved phase within 2e−7; per-channel same-time
contrast of at least 0.002 and 5 % of the range for every nonzero offset,
minimised over each playback segment; variation floors; resolved primitive
period; temporal tail energy) and then integrates the equation forward from the
exported first frame at two timestep limits without any projection; trajectory
and closure RMS must stay within 1e−5. The certificate has the same shape as the
Gray–Scott wallpaper certificate, so the browser applies the same gates; the
forward phase bounds reuse `../wallpaper/audit.py`. Records carry the gate
`equations-offline-v1` and the SHA-256 of `rdlab.py` + `admit.py`.

## Reproduce

Python 3.12 with NumPy and SciPy (`uv venv --python 3.12 && uv pip install numpy scipy pillow modal`):

```sh
python build_equation_atlas.py --batch <batch-dir> ... --output ../../data/equation-atlas.json
python ../wallpaper/merge_atlas.py --legacy <legacy-subgroups.json> --equations ../../data/equation-atlas.json
python admit.py ../../data/equation-orbits/<record>.json     # re-admit one saved record
```

`modal_equations.py` is the bounded cloud wrapper (CPU only, 2 physical cores and
8 GiB per container, 24 containers, 420-second tasks, no retries, no deployments;
dry run by default, `--launch` to spend). The job lists and batch summaries of
the recorded sweeps are in `batches/`; `compute-ledger.json` accounts for them.

## Results (September 2026)

Five bounded Modal batches (1,020 CPU jobs, all returned; see `compute-ledger.json`
and `batches/`) searched every entry at three Ginzburg–Landau parameter sets
(α, β) = (1.46, 0.174) (SymSim's "moving loops"), (1.26, 0.127) and (2.21, 0.40),
cell sides L = 40 and 64, two seeds each, and four Brusselator parameter sets
((a, b) = (1, 2.1), (1, 2.3), (2, 5.2) with equal diffusion and (1, 2.1) with
D_u/D_v = 2) at L = 40. Converged candidates were refined to N = 48 (relative period
change recorded in each record's provenance) and the published movies are the
N = 36 states with 32 or 48 saved frames, re-admitted from their exported bytes.
Up to two distinct records per entry and equation were kept.

Records: 720 over 68 entries; distinct saved fields Gray–Scott 254, Ginzburg–Landau 65, Brusselator 51
- Gray–Scott: 51 of 51 nonzero-offset entries
- Ginzburg–Landau: 35 of 51 nonzero-offset entries; missing g9, g60, g64, g57, g69, g73, g131, g138, g231, g233, g244, g245, g246, g270, g269, g271
- Brusselator: 29 of 51 nonzero-offset entries; missing g55, g65, g60, g74, g64, g67, g57, g69, g73, g98, g131, g130, g138, g129, g136, g135, g231, g235, g233, g270, g269, g271

| Wallpaper group | Entry | Signature | Gray–Scott | Ginzburg–Landau | Brusselator |
| --- | --- | --- | ---: | ---: | ---: |
| p1 | g1 | ◦ (zero offset) | 12 | — | — |
| p2 | g6 | ²2²2²2²2 | 17 | 2 | 2 |
| p2 | g7 | ¹2¹2²2²2 | 6 | 2 | 1 |
| p2 | g5 | 2222 (zero offset) | 12 | — | — |
| pm | g10 | ∗∗ (zero offset) | 6 | — | — |
| pg | g11 | ×× (zero offset) | 8 | — | — |
| cm | g9 | ∗²×² | 13 | — | 2 |
| cm | g8 | ∗× (zero offset) | 12 | 1 | — |
| pmm | g55 | ∗²2²2²2²2 | 9 | 2 | — |
| pmm | g65 | ∗¹2²2²2²2 | 3 | 2 | — |
| pmm | g60 | ∗¹2²2¹2²2 | 3 | — | — |
| pmm | g74 | ∗¹2¹2²2²2 | 3 | 1 | — |
| pmm | g64 | ∗¹2¹2¹2²2 | 4 | — | — |
| pmm | g54 | ∗2222 (zero offset) | 12 | — | — |
| pmg | g61 | ²2²2∗² | 4 | 2 | 2 |
| pmg | g62 | ²2²2∗¹ | 6 | 2 | 2 |
| pmg | g67 | ¹2²2∗² | 1 | 1 | — |
| pmg | g57 | ¹2¹2∗² | 3 | — | — |
| pmg | g66 | ¹2²2∗¹ | 2 | 2 | 1 |
| pmg | g56 | 22∗ (zero offset) | 7 | — | — |
| pgg | g75 | ¹2²2×⁴ | 1 | 2 | 2 |
| pgg | g63 | ²2²2×¹ | 5 | 2 | 2 |
| pgg | g59 | ¹2¹2×² | 16 | 2 | 2 |
| pgg | g58 | 22× (zero offset) | 7 | — | — |
| cmm | g72 | ²2∗²2²2 | 5 | 2 | 1 |
| cmm | g69 | ¹2∗²2²2 | 4 | — | — |
| cmm | g70 | ²2∗¹2²2 | 1 | 2 | 2 |
| cmm | g71 | ²2∗¹2¹2 | 15 | 2 | 2 |
| cmm | g73 | ¹2∗¹2²2 | 2 | — | — |
| cmm | g68 | 2∗22 (zero offset) | 9 | — | — |
| p4 | g96 | ⁴4⁴4²2 | 24 | 2 | 2 |
| p4 | g97 | ⁴4⁴4²2 | 24 | 2 | 2 |
| p4 | g99 | ⁴4⁴4¹2 | 17 | 2 | 2 |
| p4 | g95 | ²4²4¹2 | 24 | 2 | 1 |
| p4 | g98 | ¹4²4²2 | 21 | 2 | — |
| p4 | g94 | 442 (zero offset) | 24 | — | — |
| p4m | g131 | ∗²4²4²2 | 6 | — | — |
| p4m | g130 | ∗²4¹4²2 | 7 | 2 | — |
| p4m | g138 | ∗¹4²4²2 | 3 | — | — |
| p4m | g129 | ∗¹4²4¹2 | 12 | 1 | — |
| p4m | g136 | ∗¹4¹4²2 | 12 | 1 | — |
| p4m | g128 | ∗442 (zero offset) | 12 | — | — |
| p4g | g139 | ⁴4∗²2 | 2 | 2 | 1 |
| p4g | g133 | ²4∗²2 | 10 | 2 | 1 |
| p4g | g137 | ⁴4∗¹2 | 14 | 2 | 2 |
| p4g | g134 | ²4∗¹2 | 13 | 1 | 1 |
| p4g | g135 | ¹4∗²2 | 12 | 1 | — |
| p4g | g132 | 4∗2 (zero offset) | 6 | — | — |
| p3 | g225 | ³3³3³3 | 16 | 2 | 2 |
| p3 | g226 | ³3³3³3 | 16 | 2 | 2 |
| p3 | g227 | ³3³3¹3 | 2 | 2 | 2 |
| p3 | g224 | 333 (zero offset) | 12 | — | — |
| p3m1 | g231 | ∗²3²3²3 | 7 | — | — |
| p3m1 | g230 | ∗333 (zero offset) | 7 | — | — |
| p31m | g235 | ³3∗²3 | 1 | 2 | — |
| p31m | g234 | ³3∗¹3 | 1 | 2 | 2 |
| p31m | g233 | ¹3∗²3 | 3 | — | — |
| p31m | g232 | 3∗3 (zero offset) | 8 | — | — |
| p6 | g247 | ⁶6³3²2 | 20 | 2 | 2 |
| p6 | g248 | ⁶6³3²2 | 20 | 2 | 2 |
| p6 | g244 | ³6³3¹2 | 6 | — | 2 |
| p6 | g245 | ³6³3¹2 | 6 | — | 2 |
| p6 | g246 | ²6¹3²2 | 8 | — | 2 |
| p6 | g243 | 632 (zero offset) | 4 | — | — |
| p6m | g270 | ∗²6²3²2 | 5 | — | — |
| p6m | g269 | ∗¹6²3²2 | 4 | — | — |
| p6m | g271 | ∗²6¹3¹2 | 3 | — | — |
| p6m | g268 | ∗632 (zero offset) | 4 | — | — |


The Ginzburg–Landau entries that stay empty are exactly those whose nonzero offsets
sit on mirrors or glides (line defects, unstable) and the two 632 sixth-turn
characters g244/g245, whose spiral cores are unstable at these parameters; the
Brusselator misses the same mirror entries plus several whose Newton seed converged
to a state that fails the visibility floor. Every entry keeps its Gray–Scott
records, so no page lost content.
