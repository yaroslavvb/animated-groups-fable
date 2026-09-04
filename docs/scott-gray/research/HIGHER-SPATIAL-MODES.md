# Distinct patterns at fixed physical parameters

The standing-wave atlas includes different spatial wavelengths on the same square of side 256, with `Du = 0.16`, `Dv = 0.08`, and `k = 0.02`. These are distinct periodic patterns at fixed physical parameters. Their extra translations mean that the displayed square is not always a primitive spatial cell.

The clearest same-parameter comparison is the pair at `F = 0.00403`: the original standing wave has period **346.09860146**, while the doubled spatial mode has period **340.27682780**. Translating the doubled pattern by half the square leaves every delivered concentration sample unchanged. The original pattern changes by **0.05331298 RMS** under that translation. A spatial rotation, translation, reflection, or change of time origin cannot turn one of these complete periodic orbits into the other.

These measurements use the actual delivered **Float32** bytes, decoded to Float64 for analysis. The spatial mean is removed separately for each species and each phase. Fourier energies are averaged over the complete period and both concentrations; the axial fraction sums the four modes `(±m,0)` and `(0,±m)`.

| Feed F | Standing pattern | Period T | Principal axial energy | Repeat under translation along x |
|---|---|---:|---:|---|
| 0.00403 | Original branch | 346.09860146 | 43.5807% at m = 1 | L/2 changes by 0.053313 RMS |
| 0.00403 | Doubled spatial mode | 340.27682780 | 93.6677% at m = 2 | L/2 RMS = 0 in the delivered bytes |
| 0.00400 | Doubled spatial mode | 354.13840675 | 83.2059% at m = 2 | L/2 RMS = 0 in the delivered bytes |
| 0.00395 | Tripled spatial mode | 359.44071067 | 92.2874% at m = 3 | L/3 RMS = 3.36 × 10⁻¹¹ |

The doubled and tripled patterns have wavelengths 128 and about 85.333, respectively. They repeat a smaller spatial motif; they are not additional glider discoveries or merely different phase snapshots. The full measurements, hashes, spectra and translation errors are in [spatial-mode-evidence.json](spatial-mode-evidence.json).

## The time character still matters

Each higher-mode field must separately pass the full atlas admission. At `F = 0.00400`, the doubled g95 field has actual Float32 refined return RMS **4.27 × 10⁻⁹**, trajectory RMS **5.53 × 10⁻⁹**, and maximum generator phase RMS **4.33 × 10⁻⁹**. At `F = 0.00395`, the tripled g95 field has return RMS **4.05 × 10⁻⁹**, trajectory RMS **5.31 × 10⁻⁹**, and generator phase RMS **2.93 × 10⁻⁹**.

The tripled mode translated by `(0, L/2)` also passes separately as g94 and g98. Those two records remain coordinate variants of the same underlying branch. The doubled pattern is not exported as g98: its centered translation `(L/2,L/2)` is already instantaneous, whereas g98 requires that operation to carry a resolved half-period phase shift. An ordinary spatial symmetry is insufficient.

The higher modes were solved on 24² and 48² grids. For the doubled mode at F = 0.00400 the period changes by 0.0987%, and the initial-field RMS difference is 0.00067844. For the tripled mode the period changes by 0.2024%, and the initial-field RMS difference is 0.00149247. These are refinement observations, not a continuum existence proof or a stability calculation.

## Reproduce the spatial distinction

From `docs/scott-gray`, with Python and NumPy installed:

```sh
python3 research/analyze_spatial_modes.py --output research/spatial-mode-evidence.json
```

The script verifies each payload hash and reads all shipped g95 metadata and binaries. It performs no symmetry projection, PDE evolution, or image construction. Independent PDE and time-character checks remain the responsibility of `solution-atlas.mjs` and the bundled-orbit regression tests.
