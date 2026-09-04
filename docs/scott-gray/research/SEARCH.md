# Searching Gray–Scott orbits with cyclic time symmetry

The solver found two nonuniform periodic branches, continued them in both feed and kill parameters, and found additional spatial wavelengths at the same physical parameters. The delivered atlas contains **77 verified group records at 12 physical parameter pairs**. Many records are coordinate variants of the same branch; 77 does not mean 77 distinct patterns. These are smooth concentration waves, not the gliders shown in Bulatov's examples. Every bundled field passes an independent offline audit for its selected cyclic character before publication; a moving transient or a symmetry-projected animation is not accepted.

`build-catalog.mjs` performs the numerical verification offline and stores the accepted parameters, diagnostics, and thumbnails in `../data/precomputed-atlas.json`. Opening the viewer reuses that catalog. Selecting a pattern fetches its concentration payload and checks SHA-256 integrity; no PDE integration or parameter search runs on page load. Explicitly requested new searches still undergo independent numerical admission.

## What the solver actually solves

For the rotating branch (g96), the unknown initial concentrations and period satisfy

```
Phi(T/4) q(x) = q(R90^-1 x).
```

For the standing branch (g95), the same equation uses `T/2`. `Phi` is ordinary, unprojected Gray–Scott evolution. A phase condition removes the arbitrary choice of the time origin. An independent RK4 implementation then integrates two full periods, without wrapping time or imposing any time symmetry, and measures every required generator at its actual future time.

The standing and rotating branches have additional spatial symmetries. Their translated/reflected copies provide examples for the remaining requested groups; this does not claim six independent branches or minimal symmetry groups. In particular, an even spatial mode can make a half-cell translation act instantaneously, so it must not be admitted to a group requiring that translation to advance time by half a period.

## Why batching on one GPU helps

At a 48×48 grid the branch's instantaneous mirrors reduce the shooting state to 1,250 concentration values plus the period. A finite-difference Jacobian therefore needs 1,252 independent trajectories: one base trajectory and one perturbation for each unknown. The GPU evolves this entire batch together using FP64, a five-point Laplacian, four-stage RK4 and CUDA graphs. No projection occurs inside a trajectory.

The Newton step uses a GPU linear solve. A line search checks concentrations, period bounds, and residual decrease. Continuation follows a verified branch, first on a 24×24 grid and then independently on 48×48 at the same physical side length, 256. Searches that fail these conditions remain unresolved.

Independent seed searches are a different level of parallelism: they can use separate GPUs. The recorded higher-mode search used two A100s concurrently; each GPU still batched its own Jacobian. No persistent endpoint, schedule, or unbounded queue was created.

## Measured benchmark

Measured on September 4, 2026, using an NVIDIA A100-SXM4-40GB. CPU timings use the same independent C++ RK4 code, on one CPU thread in the same Modal container. GPU times are medians of three warmed runs. All tested GPU states and finite-difference Jacobian values were bit-for-bit equal to this CPU implementation.

| Branch | Trajectories | GPU time | CPU time | Warm speedup |
|---|---:|---:|---:|---:|
| Rotating | 1 | 2.854 ms | 14.197 ms | 4.97× |
| Rotating | 32 | 4.355 ms | 452.885 ms | 104.0× |
| Rotating | 256 | 24.048 ms | 3.877 s | 161.2× |
| Rotating, complete Jacobian | 1,252 | 122.878 ms | 18.299 s | 148.9× |
| Standing | 1 | 5.677 ms | 31.851 ms | 5.61× |
| Standing | 32 | 8.591 ms | 915.884 ms | 106.6× |
| Standing | 256 | 45.727 ms | 7.628 s | 166.8× |
| Standing, complete Jacobian | 1,252 | 245.087 ms | 36.672 s | 149.6× |

GPU kernel compilation took **1.000 seconds**. Charging compilation and graph capture to one complete Jacobian still gives 16.2× speedup for rotating and 29.1× for standing. This comparison does not hide server startup: the entire benchmark app, including image build and deliberately repeated CPU reference runs, lasted 189 seconds. Its remote call took 151.8 seconds, of which 140.8 seconds were inside the benchmark function. Cold GPU execution is therefore not useful for a single tiny trajectory; reuse and batching are essential.

Local desktop CPU references were 18.77 seconds and 36.53 seconds for the corresponding complete Jacobians. Raw measurements: [GPU and cloud CPU](gpu-benchmark.json), [local CPU](cpu-benchmark-local.json).

## Actual GPU search results

One A100 continued both branches to seven additional parameter pairs, producing all **14 requested base orbits in 85.5 seconds** inside the function. This timing includes GPU initialization, Newton correction at both grid sizes, and independent CPU checks. It is not the full client wall time or a benchmark of all conceivable solution searches.

| Feed F | Kill k | Standing period, g95 | Rotating period, g96 |
|---:|---:|---:|---:|
| 0.00402 | 0.02000 | 349.556198 | 361.526420 |
| 0.00401 | 0.02000 | 353.075244 | 366.231477 |
| 0.00400 | 0.02000 | 356.658539 | 370.975586 |
| 0.00398 | 0.02000 | 364.081042 | 381.160439 |
| 0.00395 | 0.02000 | 376.066324 | 398.977432 |
| 0.00400 | 0.01995 | 351.204169 | 363.474234 |
| 0.00400 | 0.02005 | 362.299413 | 378.977734 |

All 14 passed independent forward evolution and subsequently passed canonical, quantized Float32 atlas admission, including their valid coordinate variants. Coarse-to-fine period differences for these extended branches range from 0.25% to 2.34%; the finite-grid orbit is verified, but this is insufficient to claim continuum convergence. Per-orbit numerical reports and the unresolved attempt are preserved in [gpu-search-results.json](gpu-search-results.json).

Two separate A100 workers then found standing patterns with additional wavelengths: mode 2 at F = 0.00400, k = 0.02, period **354.138407**, and mode 3 at F = 0.00395, k = 0.02, period **359.440711**. Their function times were 7.73 and 6.36 seconds. Both passed strict Float32 admission. They differ from the fundamental branches at those same parameters: their dominant axial Fourier modes are 2 and 3, and they have extra spatial periods. These properties are invariant under a change of time origin or spatial translation. See the [full wavelength comparison](HIGHER-SPATIAL-MODES.md).

A final rotating mode-3 attempt at F = 0.00395 stalled at a 24² shooting residual of 3.50 × 10⁻⁵ after nine Newton iterations. No candidate was exported. This particular seed and solver attempt remain unresolved; no impossibility conclusion follows.

## Validation and output

The cloud solver records residuals, two timestep sizes, two-period return errors, and actual future generator errors. Outputs contain initial states, periods and parameters; the client reconstructs movies independently in C++ before the JavaScript atlas projects roundoff, quantizes to the actual Float32 file, and reruns its admission tests. This avoids transferring full movies from cloud workers and preserves an independent numerical check.

The original bulk-result prototype attempted to transfer about 66 MB of movies at once. That transfer stalled after computation completed. The retained prototype returns roughly 0.5 MB of initial states and reports for 14 orbits, and reconstructs the movies locally. The transfer issue and its recovery are included in the compute ledger.

A successful numerical orbit is not a proof of a continuum orbit, its stability, its minimal symmetry group, or uniqueness at those parameters. Separate wavelengths must be distinguished after accounting for phase and spatial translations, not merely because their stored first frames differ.

## Reproduction

Install the Modal client locally and authenticate using your own account. The scripts install their GPU dependencies inside the remote image. They use the saved numerical examples in `../data/orbits/`; no credentials are included.

```
python -m pip install modal
modal run modal_benchmark.py --output benchmark-result.json
modal run modal_continuation.py --output-dir continuation-results
modal run modal_seed_search.py --output-dir higher-mode-results
```

Continuation also accepts `--families standing`, `--families rotating`, or the default `standing,rotating`. To choose parameters, pass `--targets-json targets.json`, where the file contains a list such as `[{"F":0.004,"k":0.02}]`. The client validates 1–16 targets, finite numerical values, `0 < F ≤ 0.1` and `0 ≤ k ≤ 0.1` before invoking a worker. Bounds are input limits, not a claim that every target has a solution.

The Python worker API is `continue_branches.remote(seeds, targets)`. Each seed contains `family`, `config`, and initial concentration bytes in little-endian Float64, planar U then V order. The supported prototype assumes **N = 48, M = 128, L = 256**, `Du = 0.16`, `Dv = 0.08`, and canonical g95 standing or g96 rotating generator actions. It internally corrects on N = 24 and N = 48. It retains the instantaneous mirror symmetries of these branches and cannot explore every possible branch or isotropy type. The API returns compact initial states, periods, and numerical reports; `modal_io.write_results` reconstructs movies independently and writes a candidate manifest.

For a configurable seed search, `--family`, `--modes`, `--feeds`, `--amplitudes`, and `--kill` accept one or two matched cases. For example, this reproduces the recorded **unresolved** rotating attempt:

```
modal run modal_seed_search.py --family rotating --modes 3 --feeds .00395 --amplitudes .055 --kill .02 --output-dir rotating-mode3
```

The rotating mirror restriction supports odd modes; even rotating modes require another kernel and are rejected before paid work starts. A seed is an initial guess, never an accepted orbit.

To verify and export the actual Float32 payloads from the continuation results, run from this research directory with a recent Node.js:

```
node audit-continuation.mjs continuation-results/candidates.json --output continued-bundles
node audit-continuation.mjs higher-mode-results/mode-2/candidates.json --output mode2-bundles --primary-only
node audit-continuation.mjs higher-mode-results/mode-3/candidates.json --output mode3-bundles
```

The exporter independently integrates every candidate, applies the group's canonical phase action, and writes only passing payloads plus a manifest. `--primary-only` avoids proposing invalid centered-character variants of the even standing mode. `node audit_orbit.mjs PATH-TO-METADATA.json` repeats the admission of an individual exported payload. No success flag from the cloud solver bypasses these checks.

After incorporating accepted exports into the site's source manifest, run `node build-catalog.mjs --verify` from this research directory to regenerate the published catalog. Its stored results let visitors browse the known valid parameters and thumbnails without repeating these numerical calculations. `node build-catalog.mjs --check` checks source hashes, stored evidence, and deterministic thumbnails without reintegrating the PDE; it rejects a stale catalog.

`modal_continuation.py` uses one A100, no retries, and a 900-second function timeout. `modal_seed_search.py` launches at most two seed jobs and two A100 containers, each with a 600-second timeout. Each container requests two CPU cores and 8 GiB of host memory, with a 16 GiB hard limit. All jobs stop after returning their results. A timeout bounds resource usage, not a promise that every search will converge.

For a CPU-only reproduction from an analytic Hopf seed:

```
python reproduce_orbits.py --family standing --grid 24 --output standing-24
python reproduce_orbits.py --family rotating --grid 48 --output rotating-48
```

NumPy, SciPy and a C++17 compiler are required for this CPU reproduction. The GPU continuation uses finite-difference batched Jacobians; the CPU script uses SciPy's root solver. Both are independently checked against forward evolution.

## Costs and limits

The user authorized a $100 total budget. This agent's recorded GPU allocation was capped at $15. The **provider-reported total was $0.24425508** for all five task-created apps, including the benchmark, the stalled bulk-transfer attempt, its successful compact recovery, the two parallel higher-mode seeds, and the unresolved rotating seed. The benchmark alone cost $0.09117265. All five apps were confirmed **stopped with zero active tasks**. The [compute ledger](compute-ledger.json) preserves per-app resource charges, caps, and status; provider-reported charges are distinct from conservative runtime estimates and may later be reconciled in the provider's invoice.

The pricing API reported A100 40 GB at $2.10/hour, A100 80 GB at $2.50/hour, physical CPU cores at $0.04730/hour, and host memory at $0.008/GiB/hour. Rates were checked before running. See [Modal pricing](https://modal.com/pricing), [GPU configuration](https://modal.com/docs/guide/gpu), and [billing and budgets](https://modal.com/docs/guide/billing). The implementation uses [CuPy CUDA graphs](https://docs.cupy.dev/en/stable/reference/generated/cupy.cuda.Stream.html) and the [CUDA component wheels](https://docs.cupy.dev/en/stable/install.html).
