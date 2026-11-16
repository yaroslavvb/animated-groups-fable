# One journey: the surface, the tile, the pattern — 15 Nov 2026

The contract is SPEC.md section 12. This note is why it was decided this way.

## What he asked

> can you make sure that folding is compatible with Conway's approach to surfaces (chapter 8 …) and implementation in
> https://spacesheep.dev/@yaroslavvb/classification-of-surfaces . In particular, I'm confused about the folding of
> …#g=%2A632, Normally, the folded part is just the surface, but here there is a bit of confusion about which part lies
> in the folding and which part lies in the tiling. Unify those two. Also, maybe the Unfold and Tile buttons should be
> in the same place so I can first unfold and then tile. Also, get rid of crystallographic notation. I only care about
> ortho.

## What was inconsistent

For 13 groups the 3D pane showed one tile, and Fold zipped its edges: the folded part was the surface. For the four
kaleidoscopes it showed a star of 2n tiles round one corner folding onto the tile like a paper snowflake. Those 2n − 1
other tiles are copies of the tile: they belong to the tiling. The plane showed the same copies a second time, in its
own Tile step, in another order. So for `*632` the question "which part is the folding and which the tiling" had no
answer on the page.

## What the book says

- Chapter 8, p. 93: "Any repeating pattern can be folded into an orbifold on some surface." A surface is polygons and
  zippers; "a triangle is a tidy surface — it's a sphere with a hole in it" (fig. 8.1).
- Chapter 9, opposite p. 109, on `**`: "we first fold the pattern along its mirror lines, into a fan shape and then
  into a strip. We then roll this strip into a cylinder". And p. 112: "A kaleidoscopic corner is folded up into just
  that — a corner of a kaleidoscope!"

So Conway folds the whole pattern, in two kinds of move: the copies are brought onto one region (along mirrors, a fan
fold), and that region's own edges are joined (a roll). The page had the two kinds of move in two panes with two
buttons, and for the kaleidoscopes it had put the first kind into the pane of the second.

## The decision

One line with three stops: **surface — tile — pattern**. Fold runs it one way, Unfold and then Tile the other.

1. **What is folded is the tile alone.** A kaleidoscope's tile has no zipper, so it is the surface, and its fold half
   is empty. Its Fold is the gathering of the pattern, which is the tiling run backwards. That is the unification: for
   a kaleidoscope the two are literally one motion.
2. **The 3D pane shows the tiling too.** I first built the model with the tiling in the plane only. Then a
   kaleidoscope's 3D pane never moved, and on every other group the eye had to jump panes between Unfold and Tile. With
   the copies in the 3D pane the surface opens into the tile and the tile into the pattern in one view, and a mirror's
   copy really turns under the paper: Conway's fan fold, seen from the side.
3. **One scrubber, a button at either end.** His words were "the Unfold and Tile buttons should be in the same place
   so I can first unfold and then tile": the right-hand button reads Unfold, and Tile once the tile is flat.

## Choices that could have gone the other way

- **`t > 0` means no copies.** Before, the surface could be folded while the plane showed the whole pattern. On a line
  that state does not exist. What it gave was the pattern as a map to choose a cut by, so the plane keeps a pale map
  under the lone tile. The map is paler than the pattern on purpose: at the tile stop the plane and the 3D pane then
  both say "only the tile is laid".
- **Fold from the pattern gathers quickly** (3.2 times the tiling's speed, about 1.6 s). The gathering at full length
  before every fold would be five seconds of waiting. A kaleidoscope's gathering is its whole fold and runs at 1.5
  times.
- **A round patch, not word-length layers.** The plan grows by word length in the side pairings; for `*632` four
  layers make a lopsided blob. The 3D pane shows the copies within 4.4 tile radii (at most 64), each with its parent.
- **Copies in full tone.** A first try tinted the copies grey so the tile stood out. A tinted copy leaving the tile
  then washed the tile out, the same fault his comments of 13 Nov named in the plane. The tile has its bold edges.
- **A glide sinks while it turns.** The half screw about the axis is the honest motion, but the tile straddles the
  axis, so half of it would rise through the paper. Sinking by the tile's half-width times sin(π s) keeps it rigid and
  under the paper, as the plane draws it.
- **The snowflake fold is kept, unused.** It is tested work and the only fold that shows paper stacking. No group uses
  it; the app's support for a star (fading commas, ghost colours) is removed.

## What "compatible with the classification page" came to

- Its vocabulary: zipper, hole, rim, handle, crosscap, cross-handle; teal front and sand back.
- Its names for the examples of pp. 105–106, used in the captions: a punched sphere, a twice-punched sphere, a sphere
  with a handle, a punched crosscap, a pair of crosscaps.
- Its three numbers (Euler characteristic, boundaries, sides) in the chip's tooltip, from `surfaceFacts`.
- A link from each caption into the matching part of that page.

The shapes themselves needed no change: each of the five named examples was already drawn as that surface. The Klein
bottle is drawn as a cross-handle, which chapter 8 shows to be two crosscaps.

## Left as it was

- **The title still gives way under 370 px.** That was decided on 13 Nov so the chip could keep "p3m1 · equilateral
  triangle" whole. The chip now holds the surface's name alone ("disk"), so the title would fit again. The rule is
  tested at every gated size and nobody reads the page at that width; it stays until someone asks.
- **The caption's link is a link in a sentence, one line high.** Every other control is a 44 px tap target. Round the
  caption's first words there are 2 px to the chip above and 4 to 8 px to the plane below, so a 44 px box would lie
  over one of them. WCAG 2.5.8 exempts a link in a sentence ("Inline"), and the tools now ask of it what can be asked:
  all in view, at least 44 px wide, a line high (`test/shell-layout.lib.js`, `tools/qa-matrix.mjs`).

## Measured

- Suite: 926 tests on the mini, 0 failures. Layout gate in Chrome: see SPEC 12.3 for the narrowest row.
- A drag of the cut costs the same with the pattern in the 3D pane: 2 to 4 ms per rebuild on the mini's M4
  (`dev/unify/drag-cost.mjs`).
- The motions keep every distance to 1.2e-7 tile sizes (single-precision mesh points); the deepest flip goes 1.86 tile
  sizes under the paper (`test/tiling3d.test.js`).
