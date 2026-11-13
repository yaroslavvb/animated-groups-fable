# The print, the pattern selector, re-cut first — 13 Nov 2026

The owner's ask (13 Nov 2026): *"make the foldings in …/the-folding more understandable, consider …/the-folding-22x and
use the 'Checkerboard' choice, and for the motion use 'Re-cut first' in the cases where there is a self-intersection of
the surface. Also, I want more of the surface to be covered with pattern, for instance in \*x, most of the surface is
empty, so it's not obvious how the unfolding is happening. Maybe add a selector at the top which allows me to pick
different patterns."*

## What was decided, and why

1. **The checkerboard is a pattern of the group, not a grid on one tile's paper.** The lab printed a square grid on the
   tile; it broke at every seam, and the pieces of a re-cut tile would have landed out of register. A print that every
   element of the group keeps is a pattern of the orbifold: seamless when folded, and the same in the plane's every
   tile. It is found per group by a search over grids on the group's own lattice (`src/pattern.js`), not tabulated.
2. **The paper has two sides**: front teal, back sand (the lab's colours). A pillow therefore closes sand side out (its
   flaps fold over), a piece carried by a glide lies face down, the Möbius band and the Klein bottle show both. The
   plane says the same thing: copies of the tile of the other hand are printed in sand, which replaces the grey tint.
3. **The print is drawn by the fragment shader**, from each vertex's paper point (`setSurface({ uv })`): no mesh is
   cut, it is crisp at every zoom and anti-aliased; the plane draws the same formula as canvas paths (even-odd over
   bands). Both are tied to one tone function by `test/pattern.test.js`.
4. **Three patterns**: Checkerboard (default), Rings (bands at equal distance from the cone points; from the mirrors or
   glide axes where there are no rotations), Comma (the picture as it was: one comma on a translucent sheet, for
   looking inside a shape). The selector sits at the right of the header; a native select under a pill.
5. **Re-cut first for xx and 22x.** `dev/recut/probe-direct.mjs` measures how much of the sheet passes through itself
   when a cut is folded as one sheet: every cut but each group's default one, and every wavy cut. The default cuts
   (Pocket, Rectangle) close with their rims MEETING on the double line. So every other tile is cut along the copies
   of the home tile's rim and carried there, piece by piece, by elements of the group; then the home tile folds.
   For xx the Rectangle is the home although one of the two sheets that cross runs through its middle: its two edges
   close onto that sheet, they do not pass through it (an annulus between two glide axes, wound twice, would have four
   rims meeting, as the Pocket has; it would make even the default cut re-cut, for no gain the eye can see).
6. **No motion selector.** The owner named the motion; the lab stays for comparing motions.

## After the review (the same day)

An independent reader of the diff found nothing blocking and eight small real things; the opt-in browser layout test
(`SHELL_LAYOUT=1 node --test test/shell-layout.test.js`), which this round had not run before shipping, found four
more on phones. All fixed and tested; SPEC 10.1 has the contracts. What is worth remembering:

- **Run the layout test before any change to the header or the legend ships.** The selector took 55 px of a phone's
  header and one legend item a line of its legend; three earlier guarantees broke without a single node test failing
  (the chip's second line at 360 px, the caption of a phone on its side, the 3D pane's 150 px at 320 x 518).
- **Chrome's layout is not Safari's.** The same checks in WebKit (`bash dev/recut/webkit-layout.sh`, on the M5) found
  the page 42 px wider than a phone's window: WebKit counts the text of the invisible native select as overflow.
- **Words over the picture cover the picture on a small pane.** The camera fits the shape's bounding sphere to the
  pane, so a tall tile reaches within 13 px of a 183 px pane's foot; a pill of 25 px there lies on it. On panes under
  450 px the words have their own strip and the canvas is shorter.
- **A sieve at generic points does not prove a print exact.** A grid one hundredth of a mark off its group changes the
  tone only in slivers along its lines; random points miss them. `exactlyInvariant` probes either side of the lines.
- **A dropped speck is a pinhole with a rim.** The outline's samples on a speck under `DROP_SHARE` stay on the run of
  the piece next to it and land a speck's depth (up to 0.005 tile sizes) outside the home tile. That is the only way
  a sample of a run may land outside; the test tells the two apart by asking which copy of the home holds the sample.

## Numbers

- Rebuild (a frame of a drag, draft mesh): xx 2.9 ms, 22x 3.5 ms with re-cut (1.6 / 2.1 ms without).
- Crossing over the motion, tile widths (`dev/recut/probe-recut.mjs 12`, 58 motions): none (below 0.004) everywhere,
  with the triangles within 0.03 tile sizes of a piece's rim left out; as one sheet the same cuts cross along 0.7–2.7.
- A play: the home fold's 7 s plus 1.2–4.7 s of moves.

## Files

`src/pattern.js`, `src/folds/recut.js`, `src/selfx.js` (the lab's detector, now shared), `src/render3d.js` (print,
palette), `src/plane.js` (print, back-side tiles, re-cut overlay), `src/app.js`, `src/folds/index.js`,
`src/index.template.html`, `src/styles.css`, `src/palette.js`; `test/pattern.test.js`, `test/recut.test.js`;
`dev/recut/` (the probes and the patch scripts of this round); `lab22x/` (the lab's sources, brought into the repo).
