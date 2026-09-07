# Rotation centres in the Gray–Scott overlays

> **Scope.** This document describes the original 442 (p4) Gray–Scott catalog and its solver. The site now covers all 17 wallpaper groups and two further equations; see [research/wallpaper/README.md](research/wallpaper/README.md) and [research/equations/README.md](research/equations/README.md). Counts below refer to the 442 catalog at the time it was written.

The overlay shows rotation centres, including the equivalent centres generated
by the selected group. The original display repeated only the three named
representatives α, β and γ by integer cell translations. Those representatives
generate the abstract group, but their displayed positions were an incomplete
map of its rotation centres.

## Required centres of the selected group

Counts refer to one simulation coordinate cell, with opposite boundaries identified.

| Group | α | β | γ | Total |
| --- | ---: | ---: | ---: | ---: |
| 442: g94–g97 | 1 | 1 | 2 | 4 |
| 442: g98–g99 | 2 | 2 | 4 | 8 |
| 632: g243–g248 | 1 | 2 | 3 | 6 |

For a named centre c and a group operation h(x)=Ax+b, the conjugate centre is
Ac+b modulo integer translations. Its time offset is unchanged: the time
character is abelian and all operations preserve time direction. The marker’s
glyph is rotated with h, so triangles and half-turn lenses also form the
appropriate wallpaper pattern.

At a centre c, the affine rotation is x ↦ Mx+(I−M)c. Selecting a marker uses
this operation and its own prescribed phase, including for newly added
centres. The selected centre is preserved in shared URLs. The generator
checkbox remains off by default.

## Additional centres of individual solutions

Some numerical solutions have smaller spatial repeat cells than the selected
group requires. An offline audit checks same-time translations against **both
concentrations at every saved phase**. FFT autocorrelation screens possible
translations; direct comparisons of the complete saved Float32 movies decide
which pass. The limits are maximum absolute error 10⁻⁷ and RMS error at most
10⁻⁶ of each channel’s space–time standard deviation. The evidence is tied to
the field’s SHA-256 hash.

Of 207 current records, 69 have additional spatial periods compatible with
their sampling mesh: 38 of 143 square-lattice records and 31 of 64
triangular-lattice records. All accepted translation sets are closed under
addition. Their largest measured pointwise error is 2.98×10⁻⁸; 601 of the 640
accepted translations, including identity translations, are bit-for-bit exact.
An independent check also evaluated all 1,500 distinct derived affine
rotation/phase operations (representing 3,448 centres) on every saved frame and
grid node of both concentrations. The largest absolute error was 2.98×10⁻⁸;
the largest RMS error was 2.45×10⁻⁹.

The cited g248 record at F=0.00404, k=0.02, spatial shell 3 has exact additional
periods (1/3,2/3) and (2/3,1/3) in triangular lattice coordinates. Its original
computational cell contains **3 sixfold, 6 threefold and 9 half-turn centres**.
The denser overlay therefore contains 18 centres per simulation cell.

Extra centres are found by solving (I−M)c=v+d+n for certified same-time
translations d and integer vectors n. At coincident centres, the highest
rotation order is shown. This is necessary because a centre originally marked
as threefold can be sixfold for a more symmetric solution. Merely translating
the old three markers would not find all the new centres.

White markers belong to the selected group’s complete centre map. Mint markers
denote additional centres implied by the checked periods of the current
solution. These are numerical properties of the saved fields, not new imposed
equations or a complete classification of continuum symmetries. Only periods
that preserve the actual spatial interpolation mesh enter the solid overlay. Browsing
uses the saved audit; it does not rerun the search or integrate the PDE.

## Apparent repeats that fail the strict check

Both viewers also offer **approximate-centre inspection** when
an offline audit identifies a smaller near-periodic lattice. This inspection is
available with the generator overlay, which remains off by default. When generators are enabled, approximate centres are included unless the user unchecks them. Dashed amber markers are explicitly approximate; they are
never added to the strict symmetry certificate or used to admit a solution.
The concentration samples, playback interpolation, and prescribed group
operations remain unchanged.

Two reported g247 examples illustrate the distinction:

- **Q12, N=96, L=1024:** the saved field has 12 exact same-time translations
  modulo the simulation lattice. Its strict overlay contains 12 sixfold,
  24 threefold and 36 half-turn centres: 72 in total per simulation cell.
- **Q31, N=66, L=1024:** the strict translation subgroup contains only the
  identity, hence six strict centres per simulation cell. The visually
  repeated motifs suggest a smaller lattice of index 31, but its translations
  are not mesh-compatible and the saved movie does not have those exact
  periods. The optional inspection shows its 186 proposed centres, with the
  180 additional ones dashed. The worst translation mismatch in the actual
  interpolated movie is about **3.53%** of a concentration's full range.

The offline audit examines all 207 fields: 16 square-lattice and 14
triangular-lattice fields have additional approximate repeats.

Proposals come from dominant spatial Fourier modes, not pattern names or
screenshots. Every translation in a proposed finite subgroup must be measured;
the subgroup must contain the strict translations and close under addition
and the appropriate 90° or 60° rotation. Both concentrations must stay below 5% maximum error and
2% sample RMS, relative to each concentration's range over the full movie.
These are thresholds for displaying an approximate relation, not for calling
it a symmetry.

The maximum is evaluated at all vertices of the common refinement of the
original and translated playback meshes, at every saved phase. The
difference is affine on each triangular piece or bilinear on each rectangular
piece; both attain their absolute maxima at vertices. These checks bound all spatial
points; linear temporal interpolation cannot increase the maximum. Reported
RMS is a finite-sample RMS at those vertices, not an area integral. Adding
the measured canonical rotation residual to a translation's maximum bounds
the corresponding derived rotation with its assigned time offset.

Selecting a dashed marker displays its actual comparison error and explicitly
states that it is not verified at the strict tolerance. Where an approximate higher-order
centre coincides with a strict lower-order one, a solid outer ring and the
selected-centre description preserve that distinction. Shared links include
`approx=1` or `approx=0` to preserve this inspection preference.

## Pattern cells and shared framing

The default selector now displays **1 cell**, **2 × 2 cells**, or **3 × 3
cells**. These are actual blocks of the pattern's primitive translation cell,
not multiples of the original simulation size L. Every block is outlined,
and the field is clipped to its outer square or rhombus so partial cells
outside the selected block cannot be mistaken for extra cells.

For a same-time translation subgroup of index d, a shortest primitive cell
has side length L/√d. The viewer derives two primitive translation vectors
from the checked subgroup. It applies one camera transformation to the saved
field, CPU/GPU playback, comparison panels, cell boundaries, generator
positions, and glyph orientations. Choosing a denser pattern therefore zooms
in correspondingly; it no longer shrinks many motifs into a nominal one-cell
view. Markers at boundaries are shared with neighbouring cells when counting
centres per cell.

For 442 the outlined cell is square. For 632 it is a 120° rhombus; its geometry
is preserved without stretching it into a square. The camera rotates oblique
primitive bases into the same display orientation. When a smaller cell is
only approximate, that is stated in the dropdown and canvas label, with
approximate generators drawn dashed. Scaling never changes the samples or
promotes those operations to verified symmetries.

The reported Q12 example uses a cell side L/√12 and Q31 uses an explicitly
approximate cell side L/√31. Both now display one outlined cell at count 1.

Version-1 links migrate their requested tile count to this corrected cell
framing while retaining the selected pattern, palette, phase, and playback
state. New links use version 2 and explicitly save `framing=cells` or
`framing=simulation`, the count, and the approximate-overlay preference.
**Simulation width** remains available as a separate view for reproducing the
old physical crop: its 1, 2, and 3 options mean widths L, 2L, and 3L. It is not
labelled as a pattern-cell count.

## Reproduction

From the repository root:

```sh
python3 docs/scott-gray/research/build-overlay-translations.py
python3 docs/scott-gray/research/build-overlay-near-translations.py
python3 -m unittest discover -s docs/scott-gray/research -p test_overlay_translations.py
python3 -m unittest discover -s docs/scott-gray/research -p test_overlay_near_translations.py
node --test docs/scott-gray/tests/rotation-centres.test.mjs docs/scott-gray/tests/overlay.test.mjs docs/scott-gray/tests/view-state.test.mjs
```

Implementation: [rotation centre construction](rotation-centres.mjs),
[translation audit](research/build-overlay-translations.py), and
[saved translation evidence](data/overlay-translations.json). The separate
[approximate-repeat audit](research/build-overlay-near-translations.py) produces
[inspection evidence](data/overlay-near-translations.json).

[442 gallery](./) · [632 gallery](p6/)
