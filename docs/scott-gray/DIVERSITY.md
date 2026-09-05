# Periodic-pattern diversity

The gallery contains **207 selectable records**: 143 in 442 and 64 in 632. These include related coordinate versions in different groups; they are not independent branch counts.

The throughout-playback visibility check currently marks **179 time-offset records**, **28 spatial references**, **1 excluded**, and **0 awaiting that check**. Spatial references have no required nonzero time shift.

## Most choices at one parameter set

Each row fixes F, k, both diffusion coefficients, physical side L, and the spatial stencil. N and M are numerical resolutions, not extra physical parameters. Counts below include only passing time-offset records or explicitly labelled spatial references. All ties and every parameter set are listed in [the machine-readable summary](data/diversity-summary.json).

| Family / group | Kind | Most choices | One parameter set attaining this count |
| --- | --- | ---: | --- |
| [442 / g94](./#g94) | spatial reference | 9 | F=0.00395, k=0.02, Du=0.16, Dv=0.08, L=256; five-point |
| [442 / g95](./#g95) | time offset | 8 | F=0.00395, k=0.02, Du=0.16, Dv=0.08, L=256; five-point |
| [442 / g96](./#g96) | time offset | 8 | F=0.0038, k=0.02, Du=0.16, Dv=0.08, L=256; five-point (+1 tied sets) |
| [442 / g97](./#g97) | time offset | 8 | F=0.0038, k=0.02, Du=0.16, Dv=0.08, L=256; five-point (+1 tied sets) |
| [442 / g98](./#g98) | time offset | 4 | F=0.00395, k=0.02, Du=0.16, Dv=0.08, L=256; five-point |
| [442 / g99](./#g99) | time offset | 3 | F=0.0038, k=0.02, Du=0.16, Dv=0.08, L=256; five-point (+1 tied sets) |
| [632 / g243](p6/#g243) | spatial reference | 1 | F=0.00406, k=0.02, Du=0.16, Dv=0.08, L=256; triangular-six (+3 tied sets) |
| [632 / g244](p6/#g244) | time offset | 2 | F=0.00406, k=0.02, Du=0.16, Dv=0.08, L=768; triangular-six |
| [632 / g245](p6/#g245) | time offset | 2 | F=0.00406, k=0.02, Du=0.16, Dv=0.08, L=768; triangular-six |
| [632 / g246](p6/#g246) | time offset | 2 | F=0.004056076183, k=0.02, Du=0.16, Dv=0.08, L=768; triangular-six |
| [632 / g247](p6/#g247) | time offset | 11 | F=0.00406, k=0.02, Du=0.16, Dv=0.08, L=1024; triangular-six |
| [632 / g248](p6/#g248) | time offset | 11 | F=0.00406, k=0.02, Du=0.16, Dv=0.08, L=1024; triangular-six |

## What changed in the patterns

The added searches use oblique reciprocal waves and mixtures of reflected waves. A mixture can change the arrangement while keeping the seed wavelength fixed. Other seeds change the wavelength and the number of cells. The searches correct these seeds against the nonlinear equations.

For square lattices the seed length is set by a²+b²; for triangular lattices it is a²+ab+b². “Same wavelength” refers to this seed length: nonlinear solutions also contain additional harmonics. The gallery contains concentration waves; these results do not establish Bulatov-style localized gliders.

The gallery also contains an explicitly labelled exact periodic-cell repetition with unchanged physical grid spacing. It is independently checked again in the larger cell and adds a choice at those parameters; it is not a newly discovered morphology. The construction and source parameters are preserved in its metadata.

| Added branch | Groups | F; L | Spatial refinement | Period change | Movie difference / oscillation RMS |
| --- | --- | --- | --- | ---: | ---: |
| [Oblique rotating wave · (3,2)](data/orbits/g96-diversity-p4-rotating-32-single-F0038-f0p0038-F0p00380000-k0p02000000-L256-N64-M128.json) | g96 (visible), g97 (visible), g99 (visible) | 0.0038; 256 | 48→64 | 0.679% | 3.23% |
| [Diagonal rotating wave · (3,3)](data/orbits/g96-diversity-p4-rotating-33-single-F0038-f0p0038-F0p00380000-k0p02000000-L256-N64-M128.json) | g96 (visible), g97 (visible) | 0.0038; 256 | 48→64 | 0.166% | 0.707% |
| [Axial rotating wave · (4,0)](data/orbits/g96-diversity-p4-rotating-40-single-F0038-f0p0038-F0p00380000-k0p02000000-L256-N96-M128.json) | g96 (visible), g97 (visible) | 0.0038; 256 | 48→96 | 0.68% | 3.5% |
| [Oblique rotating wave · (4,1)](data/orbits/g96-diversity-p4-rotating-41-single-F0038-f0p0038-F0p00380000-k0p02000000-L256-N64-M128.json) | g96 (visible), g97 (visible), g99 (visible) | 0.0038; 256 | 48→64 | 0.232% | 1.45% |
| [Oblique rotating wave · (4,2)](data/orbits/g96-diversity-p4-rotating-42-single-F0038-f0p0038-F0p00380000-k0p02000000-L256-N96-M128.json) | g96 (visible), g97 (visible) | 0.0038; 256 | 48→96 | 0.821% | 14.5% |
| [Woven rotating wave · (4,2)](data/orbits/g96-diversity-p4-rotating-42-woven-F0038-f0p0038-F0p00380000-k0p02000000-L256-N96-M128.json) | g96 (visible), g97 (visible) | 0.0038; 256 | 48→96 | 0.655% | 13.3% |
| [Axial rotating wave · (3,0)](data/orbits/g96-diversity-p4-rotating-axial3-F0038-f0p0038-F0p00380000-k0p02000000-L256-N96-M128.json) | g96 (visible), g97 (visible), g99 (visible) | 0.0038; 256 | 48→96 | 1.89% | 8.03% |
| [Axial rotating wave · (3,0)](data/orbits/g96-diversity-p4-rotating-axial3-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g96 (visible), g97 (visible), g99 (visible) | 0.00395; 256 | 24→48 | 0.213% | 5.01% |
| [Diagonal rotating wave · (1,1)](data/orbits/g96-diversity-p4-rotating-diagonal-1-f00395-F0p00395000-k0p02000000-L256-N96-M128.json) | g96 (visible), g97 (visible) | 0.00395; 256 | 48→96 | 0.775% | 3.81% |
| [Diagonal rotating wave · (2,2)](data/orbits/g96-diversity-p4-rotating-diagonal-2-f00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g96 (visible), g97 (visible) | 0.00395; 256 | 24→48 | 0.301% | 3.35% |
| [Oblique rotating wave · (2,1)](data/orbits/g96-diversity-p4-rotating-oblique-21-f004-F0p00400000-k0p02000000-L256-N48-M128.json) | g96 (visible), g97 (visible), g99 (visible) | 0.004; 256 | 24→48 | 0.0959% | 1.85% |
| [Oblique rotating wave · (3,1)](data/orbits/g96-diversity-p4-rotating-oblique-31-f00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g96 (visible), g97 (visible) | 0.00395; 256 | 24→48 | 0.535% | 12.4% |
| [Oblique rotating wave · (2,1)](data/orbits/g96-diversity-p4-rotating-oblique21-f00395-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g96 (visible), g97 (visible), g99 (visible) | 0.00395; 256 | 24→48 | 1.11% | 8.15% |
| [Woven rotating wave · (2,1)](data/orbits/g96-diversity-p4-rotating-woven-21-f004-F0p00400000-k0p02000000-L256-N48-M128.json) | g96 (visible), g97 (visible) | 0.004; 256 | 24→48 | 0.0341% | 3.64% |
| [Woven rotating wave · (2,1)](data/orbits/g96-diversity-p4-rotating-woven21-F0038-f0p0038-F0p00380000-k0p02000000-L256-N64-M128.json) | g96 (visible), g97 (visible) | 0.0038; 256 | 48→64 | 0.0955% | 7.72% |
| [Woven rotating wave · (2,1)](data/orbits/g96-diversity-p4-rotating-woven21-f00395-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g96 (visible), g97 (visible) | 0.00395; 256 | 24→48 | 0.239% | 11.9% |
| [Woven rotating wave · (3,1)](data/orbits/g96-diversity-p4-rotating-woven31-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g96 (visible), g97 (visible) | 0.00395; 256 | 24→48 | 0.617% | 12.9% |
| [Axial standing wave · (1,0)](data/orbits/g95-diversity-p4-standing-axial1-F0038-f0p0038-F0p00380000-k0p02000000-L256-N96-M128.json) | g94 (reference), g95 (visible), g98 (visible) | 0.0038; 256 | 48→96 | 1.44% | 6.96% |
| [Axial standing wave · (2,0)](data/orbits/g95-diversity-p4-standing-axial2-F0038-f0p0038-F0p00380000-k0p02000000-L256-N96-M128.json) | g94 (reference), g95 (visible) | 0.0038; 256 | 48→96 | 1.27% | 5.86% |
| [Axial standing wave · (2,0)](data/orbits/g95-diversity-p4-standing-axial2-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g94 (reference), g95 (visible) | 0.00395; 256 | 24→48 | 0.608% | 6.31% |
| [Diagonal standing wave · (1,1)](data/orbits/g95-diversity-p4-standing-diagonal1-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g94 (reference), g95 (visible) | 0.00395; 256 | 24→48 | 0.854% | 8% |
| [Diagonal standing wave · (2,2)](data/orbits/g95-diversity-p4-standing-diagonal2-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g94 (reference), g95 (visible) | 0.00395; 256 | 24→48 | 0.401% | 3.57% |
| [Oblique standing wave · (3,1)](data/orbits/g94-diversity-p4-standing-oblique-31-f00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g94 (reference), g95 (excluded) | 0.00395; 256 | 24→48 | 0.454% | 11.3% |
| [Oblique standing wave · (2,1)](data/orbits/g95-diversity-p4-standing-oblique21-F0038-f0p0038-F0p00380000-k0p02000000-L256-N64-M128.json) | g94 (reference), g95 (visible), g98 (visible) | 0.0038; 256 | 48→64 | 0.669% | 2.71% |
| [Oblique standing wave · (2,1)](data/orbits/g95-diversity-p4-standing-oblique21-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g94 (reference), g95 (visible), g98 (visible) | 0.00395; 256 | 24→48 | 0.655% | 6.42% |
| [Woven standing wave · (2,1)](data/orbits/g95-diversity-p4-standing-woven21-F0038-f0p0038-F0p00380000-k0p02000000-L256-N64-M128.json) | g94 (reference), g95 (visible), g98 (visible) | 0.0038; 256 | 48→64 | 0.237% | 2.23% |
| [Woven standing wave · (2,1)](data/orbits/g95-diversity-p4-standing-woven21-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.json) | g94 (reference), g95 (visible), g98 (visible) | 0.00395; 256 | 24→48 | 0.297% | 6.43% |
| [Woven standing wave · (1,3)](data/orbits/g95-diversity-woven-1-3-F0p00395000-k0p02000000-L256-N48-M128.json) | g94 (reference), g95 (visible) | 0.00395; 256 | 24→48 | 0.408% | 12% |
| [Interwoven half-cycle wave](p6/data/orbits/g246-diversity-complex-w41-L768-q3-f4056076-F0p00405608-k0p02000000-L768-N96-M96.json) | g246 (visible) | 0.004056076183; 768 | 48→96 | 0.0192% | 6.75% |
| [Interwoven sixth-cycle wave](p6/data/orbits/g248-diversity-q1-mixed-L512-F00406-F0p00406000-k0p02000000-L512-N66-M96.json) | g247 (visible), g248 (visible) | 0.00406; 512 | 48→66 | 0.00963% | 1.06% |
| [Rotating wave · Q4](p6/data/orbits/g248-diversity-q1-mode2-L512-F00406-F0p00406000-k0p02000000-L512-N96-M96.json) | g247 (visible), g248 (visible) | 0.00406; 512 | 48→96 | 0.0199% | 2.23% |
| [Rotating wave · Q9](p6/data/orbits/g248-diversity-q1-mode3-L512-F00406-F0p00406000-k0p02000000-L512-N96-M96.json) | g247 (visible), g248 (visible) | 0.00406; 512 | 48→96 | 0.0418% | 2.89% |
| [Repeated interwoven wave](p6/data/orbits/g248-diversity-q1-repeated-mixed-L1024-F00406-F0p00406000-k0p02000000-L1024-N120-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 96→120 | 0.00738% | 0.814% |
| [Rotating wave · Q7](p6/data/orbits/g248-diversity-q1-wave21-L512-F00406-F0p00406000-k0p02000000-L512-N66-M96.json) | g247 (visible), g248 (visible) | 0.00406; 512 | 48→66 | 0.000422% | 0.597% |
| [Rotating wave · Q12](p6/data/orbits/g248-diversity-q1-wide-L1024-Q12-F00406-F0p00406000-k0p02000000-L1024-N96-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 72→96 | 0.0354% | 2.24% |
| [Rotating wave · Q16](p6/data/orbits/g248-diversity-q1-wide-L1024-Q16-F00406-F0p00406000-k0p02000000-L1024-N96-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 72→96 | 0.0208% | 2.32% |
| [Rotating wave · Q21](p6/data/orbits/g248-diversity-q1-wide-L1024-Q21-F00406-F0p00406000-k0p02000000-L1024-N66-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 48→66 | 0.0583% | 6.03% |
| [Rotating wave · Q25](p6/data/orbits/g248-diversity-q1-wide-L1024-Q25-F00406-F0p00406000-k0p02000000-L1024-N90-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 60→90 | 0.0197% | 2.12% |
| [Rotating wave · Q27](p6/data/orbits/g248-diversity-q1-wide-L1024-Q27-F00406-F0p00406000-k0p02000000-L1024-N96-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 72→96 | 0.00506% | 1.04% |
| [Rotating wave · Q28](p6/data/orbits/g248-diversity-q1-wide-L1024-Q28-F00406-F0p00406000-k0p02000000-L1024-N66-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 48→66 | 0.00892% | 3.14% |
| [Rotating wave · Q31](p6/data/orbits/g248-diversity-q1-wide-L1024-Q31-F00406-F0p00406000-k0p02000000-L1024-N66-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 48→66 | 0.0186% | 3.04% |
| [Rotating wave · Q36](p6/data/orbits/g248-diversity-q1-wide-L1024-Q36-F00406-F0p00406000-k0p02000000-L1024-N96-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 72→96 | 0.0405% | 2.75% |
| [Rotating wave · Q37](p6/data/orbits/g248-diversity-q1-wide-L1024-Q37-F00406-F0p00406000-k0p02000000-L1024-N66-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 48→66 | 0.0981% | 7.02% |
| [Rotating wave · Q9](p6/data/orbits/g248-diversity-q1-wide-L1024-Q9-F00406-F0p00406000-k0p02000000-L1024-N96-M96.json) | g247 (visible), g248 (visible) | 0.00406; 1024 | 72→96 | 0.0415% | 2.09% |
| [Interwoven rotating wave · Q13](p6/data/orbits/g244-diversity-q2-w31-mix3-adaptive-F004062-F00406-F0p00406000-k0p02000000-L768-N96-M96.json) | g244 (visible), g245 (visible) | 0.00406; 768 | 48→96 | 0.0142% | 2.04% |
| [Interwoven rotating wave · Q21](p6/data/orbits/g244-diversity-q2-w41-mix1-adaptive-F004062-F00406-F0p00406000-k0p02000000-L768-N96-M96.json) | g244 (visible), g245 (visible) | 0.00406; 768 | 48→96 | 0.0983% | 8.78% |
| [Mirror standing wave · Q21](p6/data/orbits/g246-diversity-q3-mirror-L768-F004056076-F0p00405608-k0p02000000-L768-N96-M96.json) | g246 (visible) | 0.004056076183; 768 | 48→96 | 0.0899% | 5.25% |
| [Woven rotating wave · shell7](p6/data/orbits/g244-diversity-woven-21-L512-q2-f406-F0p00406000-k0p02000000-L512-N96-M96.json) | g244 (visible), g245 (visible) | 0.00406; 512 | 48→96 | 0.00384% | 1.26% |
| [Woven standing wave · shell7](p6/data/orbits/g246-diversity-woven-21-L512-q3-f406-F0p00406000-k0p02000000-L512-N96-M96.json) | g246 (visible) | 0.00406; 512 | 48→96 | 0.0497% | 5.33% |
| [Woven sixfold wave · shell21](p6/data/orbits/g243-diversity-woven-41-L768-q0-f4068-F0p00406800-k0p02000000-L768-N96-M96.json) | g243 (reference) | 0.004068; 768 | 48→96 | 0.0348% | 3.41% |
| [Woven standing wave · shell21](p6/data/orbits/g246-diversity-woven-41-L768-q3-f406-F0p00406000-k0p02000000-L768-N96-M96.json) | g246 (visible) | 0.00406; 768 | 48→96 | 0.0725% | 4.56% |
| [Woven standing wave · shell21](p6/data/orbits/g246-diversity-woven-41-L768-q3-f4068-F0p00406800-k0p02000000-L768-N96-M96.json) | g246 (visible) | 0.004068; 768 | 48→96 | 0.0457% | 3.43% |

The refinement columns compare whole normalized-period movies at fixed physical parameters, Fourier-resampled to the coarse grid. These measured differences are reported rather than hidden; timestep refinement and spatial refinement are different checks. Coordinate copies across groups remain related branches.

## Checks on the saved fields

Each referenced Float32 payload was rehashed for this report. Its numerical evidence comes from the independent admission gate: PDE residual, motion, spatial structure, prescribed phase relations, unprojected forward evolution beyond one period, half-timestep integration, and primitive-period checks at resolved divisors. Claimed solver success alone does not qualify.

| Family | Largest refined return RMS | Largest refined phase RMS | Largest relative PDE residual |
| --- | ---: | ---: | ---: |
| 442 | 1.7e-08 | 2.09e-07 | 0.322% |
| 632 | 4.2e-09 | 9.1e-09 | 0.0747% |

The visibility check tests only rotations assigned a nonzero phase shift. It compares each displayed concentration separately against the same-time rotated image, using the full-movie color range. Its minimum covers every linear interpolation segment, including the loop seam. Every tested rotation must exceed 5% of each channel’s full color range and an absolute RMS floor of 0.002 (or 100 times the recorded numerical noise, when larger). The thresholds and operation-by-operation results are preserved in the summary. Passing this display criterion is separate from solving the PDE.

Exact simultaneous rotational invariance of U and V at one instant would persist under the autonomous equivariant flow, by forward uniqueness. Combined with a required nonzero offset, it would imply a shorter period. The existing joint-field phase and primitive-period checks address that exact obstruction. The new visibility criterion also rejects a single displayed channel that becomes nearly symmetric, even though the joint state remains asymmetric.

Shape comparisons remove continuous time/position shifts, lattice rotations/reflections, spatial means, and overall amplitude scaling. They compare entire movies. Their finite comparison grid and multistart numerical optimization do not prove exhaustive uniqueness.

For **332 currently matching compared pairs**, the smallest amplitude-normalized shape distance is **0.7733**. This is partial comparison evidence, not a claim that every saved record is an independent morphology. The pair paths and metrics are preserved in the summary.

## Scope of the recorded search

The linked inventories contain **309 jobs**: **289 in completed batches**, **0 in launched/running batches without completion marked**, **20 in failed/incomplete batches**, **0 planned**, and **0 with another status**. These are CPU/GPU seed, continuation and spatial-refinement jobs, not counts of independent solutions. A continuation job can contain several nonlinear corrections.

| Jobs by batch status | Completed | Launched / running | Failed / incomplete | Planned | Other |
| --- | ---: | ---: | ---: | ---: | ---: |
| [632 CPU](research/search-grid.json) | 130 | 0 | 0 | 0 | 0 |
| [442 GPU](research/search-grid-p4.json) | 86 | 0 | 12 | 0 | 0 |
| [632 GPU](research/p6/search-grid-gpu.json) | 73 | 0 | 8 | 0 | 0 |

Counts reflect batch statuses in those inventories; a historical “launched” label does not mean the app is still running. A failed batch can return some usable job reports, so batch status does not determine individual convergence. Repeated roots, failed attempts and parameter/grid continuations remain search work. See [the compute ledger](research/diversity-compute-ledger.json) for the separate budget accounting.

## Finding more visible time-offset patterns

Prioritize two independent spatial modes in temporal quadrature, including degenerate reflected stars at the same wavelength. A leading-order single standing mode can pass through a nearly symmetric displayed channel; nonlinear harmonics can prevent this, and the actual saved field must decide acceptance. Multi-shell seeds near a common oscillation frequency provide another route. Keep only the spatial isotropy required by the selected time character, then vary amplitudes and relative phases.

Deflated Newton has not been implemented in the recorded searches; it is a proposed next step. Continue successful roots in small parameter steps and refine their spatial grids. Deflate already found or weak-contrast roots so repeated searches do not return the same branch. Apply the visibility floor to candidates and verify the original unprojected equations; do not manufacture the contrast with a spatial warp or projection. Parallel GPU batches can test independent seeds, but only admitted, sufficiently distinct fields should enter the gallery.

These are finite-grid numerical results, not proofs of continuum existence, stability, or uniqueness. A failed search does not prove that the requested symmetry is impossible.

## Reproduce and inspect

- [Generate this report](research/report-diversity.py): `python3 research/report-diversity.py` from `scott-gray`; add `--comparison /path/to/audit.json` for matching saved-field comparisons.
- [Whole-atlas diversity audit](research/audit-diversity.py) and [continuous morphology comparison](research/morphology.py).
- [Executed CPU search grid](research/search-grid.json), [442 search plans](research/search-grid-p4.json), [632 GPU search grid](research/p6/search-grid-gpu.json), and [fast candidate visibility screen](research/visible_time_symmetry.py).
- [Prepare coordinate variants with bounded roundoff correction](research/prepare-diversity.py) and [independently admit each saved Float32 field](research/admit-diversity.mjs).
- [442 search notes](research/diversity_p4_notes.md), [632 search documentation](research/p6/README.md), and [diversity search strategy](research/diversity_strategy.md).
- [442 offline catalog builder](research/build-catalog.mjs) and [632 offline catalog builder](research/build-p6-catalog.mjs).
