# Numerical verification of the bundled 442 orbits

The reference atlas contains nonuniform periodic chemical waves satisfying
all six requested 442 time characters. The reference solutions come from
**two computed branches**, a rotating wave and a standing wave. The atlas
also includes higher spatial modes of standing waves. Reflections or
translations place the branches in the coordinates of other catalog entries.
These are small-amplitude concentration waves, not the U-skate gliders in
the visual references. Their full symmetry can be larger than the requested
group.

This is numerical evidence on a discretized periodic square, with a spatial
refinement check. It is not a computer-assisted existence proof for the
continuum PDE, a proof of the complete isotropy group, or a claim that the
atlas contains every solution.

## Delivered atlas

The manifest contains **77 entries at 12 physical parameter sets**, all with
positive diffusion, nonuniform motion and the requested cyclic time character.
Counts are g94: 13, g95: 15, g96: 12, g97: 12, g98: 13, g99: 12.
Coordinate-related entries are not counted as independent discovered branches.
These fields are numerically verified offline by
[`research/build-catalog.mjs`](research/build-catalog.mjs). The resulting
[`data/precomputed-atlas.json`](data/precomputed-atlas.json) stores the accepted
parameter sets, diagnostics, and thumbnails. Opening the viewer reads this
catalog; selecting a pattern fetches its concentration payload and checks its
SHA-256 integrity. Neither action reruns the PDE or recomputes valid parameters.
The common physical values are Dᵤ=.16, Dᵥ=.08, L=256, and the five-point stencil.
Feed values run from .00395 to .004089987272497608; k is .02 except for the two
additional points (.004,.01995) and (.004,.02005).

Across the actual exported Float32 fields, maximum refined return RMS is
**7.9671 × 10⁻⁹**, whole-trajectory RMS **1.42 × 10⁻⁸**, and generator-phase RMS
**1.8051 × 10⁻⁸**. Maximum relative collocation PDE mismatch is 0.1846%.
All fields have N24-to-N48 comparison evidence. For the extended GPU continuation,
period changes reach **2.3418%** and initial-field RMS differences reach .00955.
The GPU refinement comparison measures initial states, whereas the local
continuation report also compares complete movies. Neither is a rigorous
continuum error bound. The independent timestep checks establish much smaller
time-integration errors on the specified finite grid.

The g95 atlas has two wavelengths at each of F=.00403, F=.00400 and F=.00395
with k=.02. The odd third spatial mode also gives a second pattern for g94 and
g98 at F=.00395. Other parameter/group combinations currently have one known
pattern. A rotating third-mode search failed to converge and contributes no
entry; this does not prove that such a branch cannot exist.

## Reference parameters and delivered data

Both reference branches use the standard five-point Laplacian and:

| Parameter | Value |
| --- | ---: |
| Feed F | 0.004089987272497608 |
| Kill k | 0.02 |
| Dᵤ | 0.16 |
| Dᵥ | 0.08 |
| Physical side L | 256 |
| Spatial grid N | 48 |
| Cell spacing dx | 256 / 48 |
| Time slices M | 128 |

Each `.f32` asset contains 589,824 little-endian float32 values: 128 frames,
each with an N×N U plane followed by an N×N V plane, indexed x first.
The final frame is at `(M−1)T/M`; a duplicate endpoint is not stored.
Metadata gives the exact configuration, byte count, SHA-256 checksum, and a
binary URL relative to that metadata file. See the
[asset manifest](data/verified-orbits.json) for every available point,
including any subsequently added parameter continuations.

The following errors were recomputed from the **delivered float32 values**,
after quantization. They do not substitute the smaller errors of the
double-precision shooting calculation.

| Group | Reference family | Period T | Refined return RMS | Maximum refined generator-phase RMS |
| --- | --- | ---: | ---: | ---: |
| g94 | Standing, translated | 325.56596939424105 | 3.998 × 10⁻⁹ | 3.60 × 10⁻¹⁷ |
| g95 | Standing | 325.56596939424105 | 3.998 × 10⁻⁹ | 4.085 × 10⁻⁹ |
| g96 | Rotating | 325.9471188233087 | 4.056 × 10⁻⁹ | 3.758 × 10⁻⁹ |
| g97 | Rotating, reflected | 325.9471188233087 | 4.056 × 10⁻⁹ | 3.758 × 10⁻⁹ |
| g98 | Standing, translated | 325.56596939424105 | 3.998 × 10⁻⁹ | 4.085 × 10⁻⁹ |
| g99 | Rotating, reflected and translated | 325.9471188233087 | 4.056 × 10⁻⁹ | 3.758 × 10⁻⁹ |

The standing branch has PDE residual RMS 5.862 × 10⁻⁸, relative PDE
mismatch 0.02458%, temporal RMS 0.012224, and spatial RMS 0.012221.
The rotating branch has PDE residual RMS 8.564 × 10⁻⁸, relative PDE
mismatch 0.02542%, temporal RMS 0.017249, and spatial RMS 0.017258.
Refined whole-trajectory RMS errors are respectively 5.342 × 10⁻⁹ and
5.200 × 10⁻⁹. Every stored candidate has exactly zero discrete
space–time symmetry error after canonical projection and float32 encoding.

The g94 and g98 reference assets are the same chemical field. The g98
constraints additionally include a diagonal half-cell translation paired
with a half-period shift. The g94 generators all have zero time shift;
their especially small phase error measures an instantaneous spatial
constraint. This does not make g94 a steady field: its independently
measured temporal variation is nonzero.

## Parameter continuation

The first continuation sequence includes five feed values at k = 0.02 for
each requested symmetry, listed below. Further parameter samples and
higher spatial modes appear in the manifest. Some physical parameter sets
have multiple distinct patterns for the same character: g95 at F = 0.00403
includes both the original standing wave and a doubled spatial mode.
[Spatial spectra and translation tests](research/HIGHER-SPATIAL-MODES.md)
distinguish these complete orbits from changes of time origin or spatial
coordinates. Reflected/translated copies are not counted as new branches.
The interface separates symmetry, physical parameters, and available patterns.

| Feed F | Standing period, N48 | Rotating period, N48 |
| --- | ---: | ---: |
| 0.004089987272497608 | 325.565969 | 325.947119 |
| 0.00408 | 329.310344 | 331.039300 |
| 0.00407 | 332.759634 | 336.220124 |
| 0.00405 | 339.379217 | 346.663015 |
| 0.00403 | 346.098601 | 356.730082 |

For the four added feed values, delivered-data return RMS is at most
4.60 × 10⁻⁹ and the maximum generator-phase RMS is at most 7.12 × 10⁻⁹.
Each point was solved at N24 and N48. Farther from the reference point,
spatial discretization matters more: the largest relative period change is
0.292% and the largest coarse/fine field difference is 4.37% of temporal
variation. Per-point metadata records these values; small shooting errors
must not be confused with a small continuum discretization error.

[CPU continuation instructions](research/CONTINUATION.md) reproduce the
parameter sequence from a bundled initial field, then independently audit
the actual Float32 export. [GPU search results](research/SEARCH.md) describe
additional searches and their computational cost. The manifest is the
complete list of available sampled points; parameters between samples are
not automatically certified.

## What admission actually checks

During the offline build, [`solution-atlas.mjs`](solution-atlas.mjs) accepts a
field only after recomputing its diagnostics. A saved `validated: true` label
cannot bypass that admission. The same independent numerical tests apply to
new candidates from an explicitly requested manual search. Admission clones
the field and configuration, obtains operations
from the canonical [`groups.json`](groups.json), and requires positive
diffusivities, physical concentrations, temporal RMS at least 0.008, and
spatial RMS at least 0.012.

For every canonical operation `(A,v,τ)`, both U and V must obey

```
q(Ax + v, t + τT) = q(x, t).
```

The candidate is checked against the actual Gray–Scott Crank–Nicolson
residual. Independent RK4 integrations then start from its first frame and
check return, agreement with the entire stored trajectory, and every
generator's phase relation. They run beyond T whenever a shifted comparison
needs a future frame: through 1.5T for a half shift and 1.75T for a
three-quarter shift. **Future time is not wrapped in these integrations.**
The integrations are repeated at half the actual timestep, including any
stability or frame-alignment adjustment.

The rotating reference uses dt = 0.3637802665 and 0.1818901333;
the standing reference uses dt = 0.3633548766 and 0.1816774383.
The full return and phase metrics above come from the second integration.
The independently evolved field is never projected back into symmetry.

For a nonzero phase shift, the rotation-only and phase-only contrasts must
exceed both an absolute floor and four times the measured numerical
uncertainty. Thus a purely spatial wallpaper, or a nearly stationary movie,
cannot borrow a time-character label. The
[`phase-audit.mjs`](phase-audit.mjs) checks the whole field and both species;
a specially chosen quiet probe cannot hide a mismatch.

Temporal Fourier energy tests possible shorter periods T/d for every
integer d from 2 through M/2, with a spectral-resolution gate. This includes
odd repeats: repeating a g96 orbit three times must not relabel its directed
phase as g97. These tests resolve the supplied temporal grid; they are not
a theorem about every possible continuum subperiod.

## Spatial refinement

Both reference branches were independently solved at N=24 and N=48 while holding
L=256 fixed. The comparison restricts the fine solution to the coarse nodes
and aligns the temporal phase. It compares the double-precision numerical
solutions before packaging; the delivered float32 data are separately
validated above.

| Family | T at N=24 | T at N=48 | Relative period change | Coarse-node field RMS change | Maximum field change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rotating | 325.96365688248665 | 325.9471188233087 | 5.074 × 10⁻⁵ | 9.106 × 10⁻⁵ | 2.114 × 10⁻⁴ |
| Standing | 325.57591393274754 | 325.56596939424105 | 3.054 × 10⁻⁵ | 6.951 × 10⁻⁵ | 2.888 × 10⁻⁴ |

This is useful convergence evidence from two grids. More spatial grids and
temporal refinement are needed to establish a continuum error estimate.

## Reproduction and regression checks

[`research/reproduce_orbits.py`](research/reproduce_orbits.py) starts from
an analytic Hopf-mode seed, solves quarter-period or half-period shooting
with a phase condition, records the resulting orbit, and performs
independent smaller-timestep checks. It calls the C++17 RK4 implementation
in [`research/gray_scott_rk4.cpp`](research/gray_scott_rk4.cpp). Python 3,
NumPy, SciPy, and a C++17 compiler are required; no pretrained or prerecorded
field is needed for the two base branches.

From `docs/scott-gray`, for example:

```sh
python3 research/reproduce_orbits.py --family rotating --grid 48 --frames 128 --output reproduced-rotating
python3 research/reproduce_orbits.py --family standing --grid 48 --frames 128 --output reproduced-standing
node --test tests/solution-atlas.test.mjs tests/phase-audit.test.mjs tests/bundled-orbits.test.mjs
```

The reproduction scripts provide candidate fields, not automatic admission.
The offline audit must still recheck their concentrations, canonical operations,
independent extended trajectories, refinement, and resolved phase contrast.
The shipped-asset regression reads the actual manifest and binary bytes,
checks each checksum, and runs fresh admission for every listed asset.
It also verifies that the real g95 half-shift movie is rejected under g96's
quarter-shift character, and that repeating a single spatial frame cannot
qualify as an orbit with genuine time symmetry.

The catalog build stores the accepted results for reuse. These offline build
and regression commands perform numerical verification; merely reopening
the viewer does not. Regenerate the catalog after changing an orbit or its
verification requirements so the published records match the audited data.

The viewer uses one fixed concentration range over the entire selected
movie for each channel, shared by the main image and comparisons. It never
renormalizes individual frames to manufacture apparent motion. The browser
displays precomputed, admitted records after payload integrity checks, plus
new manual-search results only after independent admission. Presets and failed
searches remain starting guesses or unresolved attempts.
