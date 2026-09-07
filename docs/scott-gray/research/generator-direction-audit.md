# Generator direction audit — 7 September 2026

The saved fields use **q(gx, t + τT) = q(x, t)**. A spatial feature at x is reproduced at gx after the stated positive time offset. Equivalently, the later image is the pullback q(g⁻¹x, t). Clockwise and counterclockwise below refer to the displayed screen, whose vertical coordinate increases downwards. This is a finite phase relation, not a claim that every feature has a constant angular velocity between those phases.

## Cause and correction

The original correspondence artwork is drawn in a screen projection of a physical basis with its vertical axis pointing up. The gallery's square camera instead displays increasing second lattice coordinates downwards. Its artwork transform applied rotations and group conjugation but omitted this camera reflection. Chiral square glyphs therefore had the opposite handedness to the displayed field. Triangular cameras already had the correct parity.

The overlay now transports each original path through the complete field camera. With J the lattice-to-screen Jacobian, B the lattice-to-physical basis and S = diag(1, −1), the reference artwork camera is the normalized matrix J B⁻¹ S. Multiplying this by the existing conjugation transform carries both orientation and handedness correctly. The saved fields, positive time offsets, affine actions and original path outlines are unchanged.

A second ambiguity came from identifying every conjugate centre only by its generator name. A spatial reflection conjugates a rotation to its inverse while retaining the positive time offset. The selector now retains the clicked operation, describes its actual screen direction, and preserves it in shared URLs. Tooltips use the same convention. Half-turns are labelled 180° turns because the two rotation directions coincide for this endpoint relation.

## Reported g139 example

For `equation:brusselator:g139:4edab43428d74fa2`:

| Centre in saved lattice | Spatial matrix | Positive offset | Screen direction in both gallery framings |
|---|---|---|---|
| (1/4, 0) | [[0, −1], [1, 0]] | T/4 | 90° clockwise |
| (1/4, 1/2) | [[0, 1], [−1, 0]] | T/4 | 90° counterclockwise |

Both relations have zero error in both saved concentration fields at every sampled phase. Using the opposite time sign instead gives a maximum error of 0.908776. The actual WebGL and CPU frame renderings also agree pixel-for-pixel after the correct clockwise quarter-turn and forward T/4 advance in the regression test. Thus the movies were not running backwards.

## Catalog survey

The reproducible [audit script](audit_time_direction_catalog.py) reads all Float32 payloads from the combined wallpaper catalog, equation catalog and both legacy atlases, verifies payload hashes, and checks every declared affine operation at every grid node and saved phase in both fields. Duplicate record IDs are merged.

| Check | Result |
|---|---:|
| Saved records | 927 |
| Wallpaper families | 17 |
| Gray–Scott / Ginzburg–Landau / Brusselator records | 811 / 65 / 51 |
| Unique payload hashes | 381 |
| Operation–record checks | 5,598 |
| Failed forward-time relations | 0 |
| Maximum absolute forward error | 2.9802322387695312 × 10⁻⁸ |
| Operations where the two time signs differ | 1,284 |
| Wrong-sign passes among those operations | 0 |

Zero offsets and half-period offsets cannot distinguish the two signs: −T/2 and +T/2 are identical modulo T. These account for the other 4,314 operation checks and are explicitly classified in the [machine-readable results](time-direction-catalog-audit.json).

Separate geometry regressions cover all 68 group definitions, canonical and conjugate rotations, square and triangular cameras, both framing modes and rotated primitive cells. Browser checks cover desktop and mobile, exact selected-centre URL restoration, both playback backends and all 17 galleries. These checks validate the display convention and stored symmetry relations; they are not a new proof of PDE orbit existence or stability.
