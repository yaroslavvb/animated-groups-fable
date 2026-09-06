# Rotation centres in the Gray–Scott overlays

The overlay shows rotation centres, including the equivalent centres generated
by the selected group. The original display repeated only the three named
representatives α, β and γ by integer cell translations. Those representatives
generate the abstract group, but their displayed positions were an incomplete
map of its rotation centres.

## Required centres of the selected group

Counts refer to one coordinate cell, with opposite boundaries identified.

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
The denser overlay therefore contains 18 centres per cell.

Extra centres are found by solving (I−M)c=v+d+n for certified same-time
translations d and integer vectors n. At coincident centres, the highest
rotation order is shown. This is necessary because a centre originally marked
as threefold can be sixfold for a more symmetric solution. Merely translating
the old three markers would not find all the new centres.

White markers belong to the selected group’s complete centre map. Mint markers
denote additional centres implied by the checked periods of the current
solution. These are numerical properties of the saved fields, not new imposed
equations or a complete classification of continuum symmetries. Only periods
that preserve the actual spatial interpolation mesh are included. Browsing
uses the saved audit; it does not rerun the search or integrate the PDE.

## Reproduction

From the repository root:

```sh
python3 docs/scott-gray/research/build-overlay-translations.py
python3 -m unittest discover -s docs/scott-gray/research -p test_overlay_translations.py
node --test docs/scott-gray/tests/rotation-centres.test.mjs docs/scott-gray/tests/overlay.test.mjs docs/scott-gray/tests/view-state.test.mjs
```

Implementation: [rotation centre construction](rotation-centres.mjs),
[translation audit](research/build-overlay-translations.py), and
[saved translation evidence](data/overlay-translations.json).

[442 gallery](./) · [632 gallery](p6/)
