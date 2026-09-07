# Local motion and generator symbols

The original generator symbols describe an affine spatial action and a time
offset. They do not, in general, determine a pattern's local direction of motion.
For a half-turn with a half-period offset,

\[
q(R_\pi x,t+T/2)=q(x,t),\qquad
R_\pi=R_{-\pi},\qquad T/2\equiv -T/2\pmod T.
\]

Consequently, clockwise and counterclockwise motion can satisfy exactly the same
generator. Reversing the glyph to match a moving feature would conflate the
symmetry action with a property of the particular solution. The viewer retains
the original glyph and draws a separate arc only when the saved data support a
consistent local direction.

## Offline measurement

`local_motion_metadata.py` reads the saved Float32 concentrations, verifies each
analysed payload's SHA-256 and dimensions, and samples physical Euclidean circles
around the exact centres used by the overlay. Square-grid sampling is bilinear;
triangular-grid sampling uses the same piecewise linear triangles as playback.
No PDE integration, projection, training, or paid compute is involved.

The three radii are 0.22, 0.30, and 0.38 times the nearest rotation-centre
distance. A radius must span at least two grid steps, and at least two radii must
be resolved. Each circle has 256 angular samples. Both concentrations and every
saved phase, including the wrap between the last and first frames, contribute.

For temporal lags of one and two frames, the procedure fits the angular
displacement in `q(t + lag, θ + δ)` that best matches `q(t, θ)`. Positive δ means
features move in the positive physical-angle direction. Circular correlation
and a local quadratic minimum locate the displacement. The squared error
retains changes in the angular mean; uniform breathing does not receive credit
as rigid rotation.

An arrow requires all of the following:

- At least 70% improvement in squared error relative to no angular displacement.
- The same direction in at least 95% of phases with appreciable temporal change.
- Agreement of the one-frame and two-frame angular rates within 20%.
- At least 30 degrees of fitted displacement per movie period.
- A nonzero, non-nodal first temporal harmonic around the circle. It must carry
  at least 50% of the temporal variation, with minimum magnitude at least 15% of
  its RMS magnitude. Its winding magnitude must be at most six.
- The fitted sign agrees with the opposite of the harmonic winding sign. Both
  channels, all resolved radii, and both lags agree in direction; the winding is
  the same on all inspected circles.
- The fitted displacement does not reach the angular search boundary, and the
  local variation is appreciable relative to the concentration's full range.

These are deliberately conservative empirical gates, not a probability estimate
or a proof of rigid rotation. Mixed motion, weak signals, unresolved circles,
and alias ambiguities receive no directional arrow. A moving reaction-diffusion
feature is also not a material particle. The reported sign is in physical-plane
coordinates; the viewer converts it through the current camera orientation.

## Reported example and catalog coverage

For `wallpaper:g6:731aa45654d4d690`, the half-turn/+half-period relation has maximum
saved-grid residual below `3 × 10⁻⁸` in both concentrations. The measured motion
is positive at α `(0, 0)` and β `(1/2, 1/2)`, and negative at γ `(0, 1/2)` and
δ `(1/2, 0)`. The corresponding first-harmonic windings are −1, −1, +1, +1.
The smallest fit improvement is 92.93%; every active phase agrees in sign.
This alternating motion is compatible with the four identical half-turn symbols.

The generated manifest covers all 927 saved record IDs and 8,251 overlay centres,
including legacy aliases. It contains 1,533 reliable rotation measurements,
2,448 mixed-motion cases, 958 cases without clear rotation, 2,554 under-resolved
neighbourhoods, and 758 ambiguous cases. Reuse of identical payloads and geometry
reduces the computation to 349 payload tasks and 6,486 centre measurements.
The full local run takes approximately 75 seconds with three workers.

## Reproduction and bindings

From the repository root, with Node.js 18 or newer and Python/NumPy available:

```sh
node docs/scott-gray/research/build-motion-centres.mjs /tmp/scott-gray-motion-centres.json
python3 docs/scott-gray/research/local_motion_metadata.py --input /tmp/scott-gray-motion-centres.json --output docs/scott-gray/data/local-motion.json --workers 3
python3 -m unittest discover -s docs/scott-gray/research -p 'test_local_motion_metadata.py'
```

The tests use `node` from the current path; `NODE_BINARY` can select another
Node.js executable.

Add `--target wallpaper:g6:731aa45654d4d690` and choose a separate output file to
obtain full ring, channel, and lag evidence for that record. The browser manifest
keeps only compact evidence summaries; rounding them does not change the gates,
which are evaluated before rounding.

Every record is bound to its ID, field SHA-256, grid dimensions, and lattice.
The manifest includes the measurement script hash, all thresholds, and a hash
of the input geometry with local filesystem paths removed, using sorted-key
compact JSON. Tests compare its coverage and centres with a fresh export from
the actual viewer. Analytic tests cover both directions, checkerboard chirality
with identical half-turn actions, standing waves, opposite channel directions,
opposite directions at different radii, reversals, under-resolution, and the
physical metric of triangular sampling. A saved-data regression independently
remeasures the reported g6 example.
