# Continue verified time-symmetric Gray–Scott orbits

This workflow follows a known periodic branch through nearby feed values.
It solves the reaction–diffusion equations with their cyclic colour phase
conditions; it does not make an arbitrary simulation periodic by replaying
or rotating it. Requirements: Python 3 with NumPy/SciPy, a C++17 compiler,
and Node 20 or newer. The native solver supports the five-point stencil.

Run these commands from `docs/scott-gray/research` after placing
`continue_orbits.py`, `audit-continuation.mjs`, and `gray_scott_rk4.cpp` there.
Start from the bundled canonical standing branch:

```sh
python3 continue_orbits.py \
  --family standing \
  --initial ../data/orbits/g95-standing-N48-M128.json \
  --feeds 0.00408 0.00407 0.00405 0.00403 \
  --output continued-standing

node audit-continuation.mjs continued-standing/candidates.json \
  --output continued-standing/bundles
```

For the rotating branch, use `--family rotating` and
`../data/orbits/g96-rotating-N48-M128.json`. These canonical g95/g96 inputs
must be used as branch seeds; other group entries are coordinate variants.
The initial input can be a binary-bundle JSON referencing Float32 data or a
reproduction JSON accompanied by its Float64 field. An optional
`--initial-fine` supplies a separate fine-grid initial state.

The first command corrects each parameter point on N24 and then N48, with
128 time samples by default. `--coarse-grid`, `--fine-grid`, and `--frames`
change those resolutions. Physical length stays fixed across refinement.
Kill, diffusivities, and length default to the initial field values; optional
`--kill`, `--du`, `--dv`, and `--length` set them explicitly and then keep them
fixed throughout the feed sequence. Every output records the full settings.
Small parameter steps are more reliable than a jump to an unrelated preset.

The continuation uses a secant predictor when two previous parameter points
are available. A coarse-grid parameter correction initializes the next fine
grid. On each grid, Newton shooting solves

```
Phi(T/2, q0) = q0(R90^-1 x)   for standing g95
Phi(T/4, q0) = q0(R90^-1 x)   for rotating g96.
```

A phase condition fixes the otherwise arbitrary time origin. The standing
branch has instantaneous mirrors `x -> -x`, `y -> -y`; the rotating branch
has mirrors `x -> 1/2-x`, `y -> 1/2-y`. Reducing unknowns by these extra
symmetries speeds the solve. Forward evolution is unprojected RK4, with a
conservative diffusion timestep cap. The first command's outputs are
**candidates**, including when its shooting residual is small.

The second command applies the canonical spacetime projection only to remove
small shooting roundoff, converts to Float32, decodes those exact export
bytes, and sends them through `createSolutionAtlas`. It recomputes the PDE
residual, all group/phase relations, independent extended trajectories,
closure, time resolution, phase contrast, shorter-period checks, and a
halved timestep. Exports also meet explicitly recorded stricter limits:
maximum projection change <= 1e-8; both full and refined independent return,
path, and phase RMS <= 1e-6.
The browser repeats its own admission checks when loading the field.

The fundamental branches have the corresponding three coordinate variants:
g95/g98/g94 for standing and g96/g97/g99 for rotating. They are two underlying
branches, not six independently discovered branches. Only accepted Float32
exports appear in `bundles/verified-orbits.json`; rejected results appear in
`failures.json`. Metadata includes hashes, byte lengths, measured errors, and
per-point spatial refinement. Copy accepted metadata/binaries into the site's
`data/orbits` directory and merge the generated orbit entries into its atlas
manifest. `--url-prefix` changes the generated URL prefix when needed.

## Validate saved GPU outputs locally

The same auditor accepts saved GPU Newton-shooting results without launching
any cloud work. Each source JSON must have `config` and `family` (`standing`
for canonical g95 or `rotating` for canonical g96), and reference its complete
Float64 movie with `fieldUrl` / `fieldEncoding: "float64-le"`; a same-named
`.f64` file is the default. The `refinement` and `spatialRefinement` metadata
spellings are both supported. These solver-produced diagnostics are only
provenance: the auditor recomputes admission from the actual concentration
samples after Float32 conversion.

For a directory `saved-gpu` containing canonical g95/g96 JSON and `.f64` pairs,
create its candidate list and run the portable local auditor:

```sh
python3 - <<'PY'
from pathlib import Path
import json
directory = Path('saved-gpu')
candidates = []
for path in sorted(directory.glob('g9[56]-*.json')):
    source = json.loads(path.read_text())
    candidates.append({'url': path.name, 'family': source['family']})
(directory / 'candidates.json').write_text(json.dumps({
    'schema': 'scott-gray-continuation-candidates-v1',
    'candidates': candidates,
}, indent=2))
PY
node audit-continuation.mjs saved-gpu/candidates.json --output saved-gpu/bundles
```

Every coordinate variant is audited separately. A higher spatial mode may
have extra instantaneous translations that make a proposed nonzero color
phase impossible; those variants are rejected and omitted. In particular,
the doubled standing pattern must not be exported as g98 merely by changing
its label. See [the measured spatial-mode distinctions](HIGHER-SPATIAL-MODES.md).

These are finite-grid numerical results. Their N24-to-N48 comparison measures
resolution sensitivity, not a rigorous continuum error bound. At the four
additional feed values above, both branches passed all independent tests.
As feed moves farther from the initial point, the N24/N48 field difference
increases; the measured values remain attached to each exported record.
A failed continuation or failed audit is not a proof that the requested
symmetry or parameter point is impossible.
