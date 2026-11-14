# The classic Klein bottle for ×× — 14 Nov 2026

The owner, looking at https://spacesheep.dev/@yaroslavvb/the-folding#g=xx&t=1: *"I expected to see a Klein bottle and
only one surface; however, if I look through it, I see two surfaces, so this visualization is confusing to me."*

## What he saw

×× closed into the figure-8 immersion (`src/folds/roll.js`, the judge's design A of 9 Nov, `qa/klein-judge.md`): a
tube whose cross-section is a figure 8 that makes half a turn round the ring. It is one surface, but each lobe of the 8
is a tube of its own to the eye, and with the two-sided print of 13 Nov one lobe is teal and the other sand: two tori
fused along a circle. On 9 Nov the classic bottle (design C) was set aside because the complaint then was about an empty
shape, not about the shape. Now the complaint is the shape.

## What was decided

1. **The closed shape is the classic bottle**: body, shoulder, neck, a hook to the side, in through the side wall, down
   inside to the base, where the wall turns in and becomes that inner neck. It lies on the plane with its plane of
   symmetry horizontal, so the default camera (55 degrees up) sees the textbook profile, and from straight above it is
   the textbook figure.
2. **The default cut folds with no paper passing through paper.** This was the rule of 13 Nov ("re-cut first in the
   cases where there is a self-intersection of the surface"), and design C broke it: there the glide seam was the
   base's rim and the neck went through the wall as one sheet. Here the Rectangle is laid on the bottle so that its two
   glide-sewn edges are the two sides of the curve where the neck goes through the wall. One end of the tube ends on
   the wall from outside, the other from inside, and they are sewn through it. The surface's self-intersection is
   exactly its glide seam, as the cross-cap's double line is the Pocket's cut.
3. **Three moves that paper can make**, instead of a tube turning itself inside out:
   - the end that becomes the inner neck **folds over** the sheet (a rounded fold: the U of the base's rim);
   - the doubled sheet **rolls up** into a tube with a tube inside it (the blue seam closes along both);
   - the neck **hooks round** to the wall, and inside the body the inner neck leans over to the same place.
   A tube cannot get one end inside itself without rolling material over a moving rim (a sock turned in); folding the
   flat sheet first puts the inner neck inside before there is a tube.
4. **A line of words for each move** over the fold pane, and at t = 1 "the two ends are sewn through the wall
   (dashed)". He found the shape confusing; three different moves in seven seconds need naming.

## The map

Coordinates in the anchored frame: ξ across (0 on the glide axis nearest the anchor: the tube's keel line), η along
(0 at the anchor). A row η = const is carried to an arc of a circle about a horizontal axis at height h above the
row's own lowest point, the "keel" (c(η), z(η)):

    P(ξ, η) = c + [μ ξ sinc θ − z sin θ] N + [μ ξ cosc θ + z cos θ] e_z,    θ = 2π a ξ / b,    h = μ b / (2π a).

Every row turns through the same angle, so the rolled sheet is a wedge of a surface of revolution about an axis that
comes down from infinity, and the two layers (sheet and flap) close together. The keel is a chain of eleven pieces,
straight runs and arcs, driven by three angles: the pitch (the flap: −π f through the U), the heading (the hook and
the arcs to the wall: h times the final ones) and the shoulder's ramp. The pieces' lengths are solved so that the keel
closes (`bottleShape`): at t = 1 the two rims are one curve with opposite frames, so the map is invariant under the
glide and the translation to rounding (1e-15), and every tile closes.

A row is a plane circle, but the curve where a neck meets a round wall is a saddle. The rows near each rim are
therefore sheared along the neck, which is straight there: at t = 1 the two rims lie on the wall, point for point
(1e-16 on the edge itself).

With today's lattice (b = 0.9, A = 1.7), world units:

| | |
|---|---|
| body radius, neck radius, gap | 0.180, 0.085, 0.095 |
| hook radius; the arcs outside and inside the wall | 0.150; 0.110, 0.190 |
| the neck meets the wall at | 75 degrees to the axis |
| length of the keel; stretch along | 1.937; 1.14 |
| stretch across: body, neck | 1.26, 0.59 |

The paper is squeezed on the neck (checks about twice as long as wide there) and stretched on the body. A longer,
narrower tile would suit the bottle better; the lattice was left alone so that the plane, the print and old links stay
as they are.

## What was measured

- **Crossing** (`dev/` probes, now `test/bottle.test.js`): with the re-cut suite's measure, 0.0000 tile widths at every
  one of 100 moments. Without leaving the rims out, 0.44 at t = 1: the rim on the wall, all the way round the neck
  (a faceted rim dips through a faceted wall by the facets' sag). `test/recut.test.js`: 16 motions, every preset and
  random cuts, straight and wavy: 0.0000.
- **Evenness**, per 1/200 of the fold, tile sizes: the default cut's largest step 0.0228, largest second difference
  0.00120 (the figure 8 had 0.018 and 0.0011 with two moves). Dragged and wavy cuts folded as one sheet: 0.031 and
  0.0019; the bounds of `test/folds.test.js` for `klein` are now 0.046 and 0.0029, by that file's rule.
- **The Hexagon preset folded as one sheet crosses only 0.06 tile widths**: it holds two thin gables beyond the rim
  line. The re-cut suite's control therefore uses the Rectangle moved a quarter of the glide along, which sends a band
  of paper through the wall (0.43, the neck's girth).
- **The comma**: across the glide seam (the rule made for the figure 8) it lay under the neck and inside the body:
  3 % of the default view. From the table it lies on top of the body: front 56 %, seen 44 %.

## What stayed

- `src/folds/roll.js` and its tests keep the figure-8 fold; no group uses it. The seam-comma rule stays in
  `src/motif.js`, unused.
- The re-cut (`src/folds/recut.js`) is unchanged: it asks the fold of the default cut for the home, and gets this one.
- The closed bottle shows the paper's back (sand) all over its outside, as the torus does: the sheet curls up, so the
  front is inside. The front shows in the mouth of the neck while it hooks round, and in the Comma pattern, which is
  translucent, the inner neck shows through the wall.

## Open

- The outer rim dips through the wall by less than the rim the measure leaves out, during the last 3 % of the fold
  (the shear and the hook finish together). Not visible; a shear that finishes a little before the hook would end it.
- The one-sheet fold of a cut moved far along the glide axes draws a large part of the tile from one end of the tube to
  the other. The app never shows it (such a cut is re-cut). Folding it in place and then sliding the closed sheet round
  the bottle, as the torus does, would be the better motion.
