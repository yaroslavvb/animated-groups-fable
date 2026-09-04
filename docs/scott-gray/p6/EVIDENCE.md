# Verified periodic Gray–Scott waves for 632

All six requested cyclic color characters have nonuniform, time-dependent numerical examples. Their parameters, concentration movies, thumbnails and verification results are saved before publication. Opening the page or selecting a parameter does not run a search or reintegrate the equations.

These are finite-grid chemical waves. They are not proofs of continuum existence, a complete classification of periodic solutions, or verified gliders. Additional spatial symmetries are allowed. Opposite-handed entries are related by an exact spatial reflection, and each exported field is independently checked against its own directed time character.

<!-- atlas-summary:start -->
The atlas contains **22 independently verified records at 6 physical parameter sets**, spanning all six characters. All published fields use **48² spatial nodes and 192 saved phases**. Each group has three or four selectable parameter sets. For g247 and g248 at `F = 0.00404`, two distinct waves coexist: the first reciprocal shell has period `344.7403`, and reciprocal shell 3 has period `335.5436`.

| Group | Available feed F (k = 0.02) | Saved patterns | Largest refined return RMS |
| --- | --- | ---: | ---: |
| g243 | 0.00406, 0.00407, 0.00408 | 3 | 4.17e-09 |
| g244 | 0.00405, 0.00406, 0.00408 | 3 | 4.03e-09 |
| g245 | 0.00405, 0.00406, 0.00408 | 3 | 4.03e-09 |
| g246 | 0.00400, 0.00404, 0.00408 | 3 | 4.11e-09 |
| g247 | 0.00400, 0.00404, 0.00406, 0.00408 | 5 | 4.20e-09 |
| g248 | 0.00400, 0.00404, 0.00406, 0.00408 | 5 | 4.20e-09 |

Across all records, the largest independently refined time-symmetry RMS is **4.54e-09**, the largest PDE residual is **2.01e-07 RMS**, and the largest half-timestep trajectory difference is **5.55e-12 RMS**. Spatial refinement changes the period by at most **0.201%**, and changes the full movie by **0.53–4.19%** of the coarse temporal RMS. These spatial differences are much larger than the discrete shooting error and remain part of the accuracy assessment.

[Complete saved diagnostics, hashes and provenance](data/precomputed-atlas.json).
<!-- atlas-summary:end -->

## Which time symmetries?

The operations are the same as [the 632 correspondence page](../../correspondence-p6.html). In lattice coordinates, the positive 60° rotation is

```
R = [[1, -1], [1, 0]].
```

For both concentrations, the required relation is `q(Rx, t + τT) = q(x, t)`. The six groups assign the following offsets to this rotation:

| Group | 60° time offset | Numerical example |
| --- | --- | --- |
| g243 | 0 | Sixfold breathing wave |
| g244 | T/3 | Rotating wave |
| g245 | 2T/3 | Opposite-handed rotating wave |
| g246 | T/2 | Alternating wave |
| g247 | 5T/6 | Opposite-handed rotating wave |
| g248 | T/6 | Rotating wave |

All six characters are algebraically compatible with the autonomous, spatially equivariant Gray–Scott equations. A nonzero offset must also produce a measurable difference from the same-time spatial rotation. A stationary image, a purely spatial symmetry, or a repeated movie relabeled with another period cannot pass those checks. See [the exact generators, Chaim notation and feasibility argument](CHARACTERS.md).

## Physical lattice and equations

The lattice vectors are `a = (1, 0)` and `b = (−1/2, √3/2)`. The physical side length is `L = 256`, and `h = L/N`. Both species use the six equal-length neighbors in directions `±a`, `±b`, and `±(a+b)`:

```
Δh f = 2/(3h²) × (sum of the six neighbors − 6f)
u_t = Du Δh u − uv² + F(1 − u)
v_t = Dv Δh v + uv² − (F+k)v.
```

The factor `2/3` gives the isotropic continuum Laplacian to second order. A square-grid five-point stencil would not commute with the 60° lattice rotation and is rejected by this family's verifier. All saved examples use `Du = 0.16`, `Dv = 0.08`, and `k = 0.02`.

The viewer uses the physical triangular geometry. Interpolation is piecewise linear on equilateral triangles, so rotating the interpolated field preserves the discrete symmetry between lattice nodes. Both the CPU renderer and WebGL renderer use this interpolation, and offline thumbnails use the same CPU sampler. This display interpolation does not assert that the interpolant solves the continuum PDE between nodes.

## Independent numerical admission

The search evolves candidates with a C++ triangular-lattice RK4 integrator. The offline [JavaScript verifier](verify.mjs) separately implements the equations and ignores submitted claims of convergence or validation. It reads the exact published Float32 samples and checks:

1. Finite, nonnegative concentrations with temporal RMS at least `0.008` and spatial RMS at least `0.012`.
2. The full space–time Crank–Nicolson residual, in both species at every node.
3. Every canonical group operation and its directed phase offset on the saved field.
4. Unprojected forward evolution through `T + max(τ)T`. Future phase comparisons use newly integrated states, without wrapping the saved movie or projecting the trajectory into symmetry.
5. Independent evolution at half the timestep, including return error, full-trajectory agreement and timestep convergence.
6. Resolved nonzero phase effects and rejection of shorter periods detectable in the complete sampled temporal spectrum.

The absolute limits are `2×10⁻⁵` RMS for the PDE residual, return and trajectory mismatch; `2×10⁻⁷` for the candidate's maximum generator error; and `2×10⁻⁶` for timestep-refinement RMS. The gate also applies relative bounds, primitive-period checks and a noise-dependent phase-contrast floor. The exact limits are exported as `LIMITS` in the verifier; saved catalog diagnostics contain the measurements and thresholds.

Each payload is hashed before admission. The catalog records its SHA-256, canonical configuration, verifier fingerprint, display ranges and thumbnails. At playback, the browser downloads only the selected binary and checks its hash and size. This inexpensive integrity check confirms it is displaying the saved bytes; it does not rerun numerical verification.

## Spatial refinement is separate evidence

For each delivered branch, the search also solves at `N = 24` and `N = 48` with the same physical parameters and lattice length. The comparison aligns normalized time and Fourier-resamples the fine spatial movie to the coarse lattice. The metadata records both period changes and whole-field differences under `provenance.spatialRefinement`.

Those cross-grid comparisons come from the Python/C++ search pipeline. They are separate from the independent JavaScript acceptance tests, which verify the actual published 48² payload and refine its time integration. A tiny return residual establishes an accurate discrete periodic orbit; it must not be substituted for a continuum error estimate.

## Reproduction and extension

See [the search API and recorded attempts](../research/p6/README.md) for the branch search, Fourier-block Newton–Krylov preconditioner, continuation, spatial refinement and export commands. The search is local CPU computation; this 632 extension used no Modal GPUs or additional Modal spend.

From `docs/scott-gray`, rebuild numerical admission and all saved thumbnails with Node 20 or newer:

```sh
node research/build-p6-catalog.mjs --verify
```

Check the committed artifacts without integrating the equations again:

```sh
node research/build-p6-catalog.mjs --check
node --test p6/tests/*.test.mjs tests/precomputed-p6.test.mjs
```

Changing any candidate bytes, group definitions, verifier code or thumbnail renderer invalidates the saved build fingerprint. An unsuccessful search is recorded as a failed attempt, not a proof that its parameters or symmetry are impossible.
