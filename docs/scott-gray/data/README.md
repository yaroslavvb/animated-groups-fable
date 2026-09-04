# Numerical data and provenance

`verified-orbits.json` lists the periodic fields used to build the viewer's
catalog. Each metadata file under `orbits/` specifies its physical parameters,
canonical group operations, period, numerical checks, spatial refinement,
and the SHA-256 hash and layout of its accompanying Float32 payload. The
offline builder, `../research/build-catalog.mjs`, independently rechecks the
actual bytes with the numerical admission tests; saved validation summaries
do not grant admission during that build. It writes `precomputed-atlas.json`,
which stores the known-valid parameters, measured diagnostics, and thumbnail
URLs; the images are generated in `thumbnails/`.
The browser reads that catalog and fetches only the selected concentration
payload, checking its SHA-256 integrity. It performs no PDE integration or
parameter verification on page load. Explicit new searches still require
independent numerical admission. See
[the numerical evidence](../VERIFIED-ORBITS.md) and
[distinct standing spatial modes](../research/HIGHER-SPATIAL-MODES.md).

From `docs/scott-gray`, run `node research/build-catalog.mjs --verify` after
changing source orbits or acceptance code. Run
`node research/build-catalog.mjs --check` to check source hashes, stored evidence,
and deterministic thumbnails without repeating numerical integration.

The older trajectories and seeds below are retained for reproducibility.
They are not members of the verified atlas.

`spiral-trajectory.f32` is a real, nonperiodic p4/442 spiral-wave trajectory
generated from an adapted Bulatov field. Its 32 frames use the same five-point
spatial equations as this solver, with forward Euler dt=0.8, Du=0.16, Dv=0.08,
F=0.007457, k=0.033896, N=128 and L=234.75127446880322. Each frame contains
a complete U plane then V plane. Time spacing is 20; the final recorded frame
is at t=620. The independent first-frame return at t=640 is 0.20009 RMS,
so the viewer does not loop this recording. It is a transient that ultimately
settles, not a discovered periodic orbit. `spiral-trajectory.json` contains
the source URL, all processing, symmetry checks and timestep comparison.
The spatial C4 projection suppresses roundoff only; no temporal projection
or seam blending is used. Upstream source license is retained below.

`bulatov-glider.f32` is a 128×128 crop (original x=248:376, y=256:384)
of Vladimir Bulatov's evolved 512×512 Gray–Scott concentration field:
[par-24-06-02-13-50-03-917.json](https://github.com/vbulatov2011/symhub/blob/main/apps/symsim/gray_scott/presets/wp/par-24-06-02-13-50-03-917.json).
Layout is little-endian float32, y-major, interleaved U,V. The nearly uniform
crop boundary permits a useful periodic initial condition, but cropping does
not itself establish a periodic solution. Upstream is MIT licensed; the
copyright and license are retained in `BULATOV-LICENSE.txt`.

Source parameters: F=0.062, k=0.0609, Du=0.2097, Dv=0.105, dt=0.8.
Bulatov's nine-point Laplacian has weights 0.8 on axial neighbors, 0.2 on
diagonal neighbors and −4 at the center, with leading continuum coefficient
1.2. This laboratory uses a five-point stencil, Du=0.16 and Dv=0.08.
The source loader rescales the physical cell by sqrt(0.16/(1.2×0.2097)),
while retaining the concentrations. This matches the leading U diffusion
scale; stencil error and the slightly different diffusion ratio mean it is
an adapted initial condition, not an exact reproduction of upstream evolution.

`search-results.json` records six deterministic 200-iteration exploratory
searches with the geometric U-skate seed, N=32, M=32, L=96, T(initial)=1200,
F=0.062, k=0.0609, minimum temporal RMS=0.012 and spatial RMS=0.04.
The browser defaults use lower variation floors (0.008 and 0.012). All six searches remained unverified. They are empirical
attempts, not nonexistence results. See the reproducible CLI in `../search.mjs`.

`../tests/oscillator.json` is an independently computed homogeneous periodic
chemical oscillator, used as a positive control. It has extra spatial symmetry,
so it is not a patterned 442 result or a glider. The production solver's
spatial-variation floor rejects it; the verification test explicitly disables
that floor and verifies g94 only. The other five requested phase characters
fail at the oscillator's minimal period.
