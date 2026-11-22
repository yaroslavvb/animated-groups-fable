# Studio

An editor for two-colour films with the symmetry of a Shubnikov census class.
You place shapes, give them motions, and the group makes the copies; whatever
you draw, the film has exactly the class's symmetry. It opens in
[`g95-n2-3`](../#p4/g95/g95-n2-3), the class of
[Plume Monochrome](https://plume-monochrome.pages.dev/): a quarter turn with a
quarter of the loop keeps the inks, a half turn or half the loop swaps them.
Any of the census's 307 two-colour classes can be chosen instead
(`?class=<id>`, or the chip beside the title).

Live: <https://yaroslavvb.github.io/animated-groups-fable/shubnikov/studio/>

## What a design is

A design is a list of layers. It is plain JSON, and the whole of it travels in
the address (`#d=…`, base64url), so a link is a save file.

| Layer | What the group makes of it |
|---|---|
| **flood** shape | Every copy claims the ground nearer to it than to any copy in the other ink: a soft Voronoi diagram of the copies. `edge` rounds the frontiers. |
| **stamp** shape | The copies sit on top of the ground as themselves. Where a white and a black copy overlap, the deeper one keeps the place. |
| **invert** shape | Whatever lies under a copy changes ink. |
| **wave** | A plane wave summed over the group with signs, added to the floods' field. The census's own films are sums of these (`#p=census` opens one as nine wave layers). |

A shape has a place (lattice coordinates) and a stack of motions, each closing
after one loop: **orbit** (circle, ellipse or line), **path** (point to point,
with pauses), **spin**, **rock**, **pulse**, **blink**.

A copy is the shape as it was `tau` of a loop ago, carried by `(M | v)`, in the
other ink when the element swaps inks. For `g95-n2-3` that is eight copies a
cell.

### What the group cancels

Under an ink-swapping element the field changes sign, so anything that element
leaves in place is zero. The editor shows this rather than hiding it:

- a shape that stands still, or whose motion repeats every half loop, lies
  exactly on its own negative: the layer is flagged **cancels**;
- a round shape on a rotation centre does the same;
- a wave must run an odd number of times round the loop;
- where a white and a black copy share a stretch of outline, the ground beyond
  it is exactly as near to one as to the other, and stays **grey** until
  another flood or a wave settles it.

## The arithmetic

`studio-core.mjs` has no DOM and no GL. A frame is four real fields, each with
the class's symmetry on its own:

| Field | Meaning | Under an ink-swapping element |
|---|---|---|
| `G` | ground: `h (ln Σ_white e^(−d/h) − ln Σ_black e^(−d/h))` over the floods' copies, plus the waves | changes sign |
| `A` | stamp cover: positive inside the smooth union of the stamps' copies | unchanged |
| `S` | stamp ink: the same log-ratio, over the stamps' copies | changes sign |
| `I` | inverter: negative where an odd number of inverting layers cover | unchanged |

`d` is the signed distance to a copy's outline and `h` its softness. The ink at
a point is the sign of `S` where a stamp covers and has ink, else the sign of
`G`, flipped where `I` is negative; zero (grey) where the deciding field is
zero. The sums are taken in the log domain, so a crisp edge (`h` of a few
thousandths) is as well conditioned as a soft one.

Two details that matter:

- **Exact distances.** A shape's distance must be the true Euclidean one
  outside the shape, not a bound. A comma and its half-turned twin fill a disc;
  with a bound, a whole wedge outside that disc reads as a tie.
- **Coincident copies are removed before summing** (`cancelCoincident`). A
  white copy lying exactly on a black one adds nothing; left in, the two sums
  would differ by rounding alone and the picture there would be noise.

## Drawing

`studio-gl.mjs` writes the same arithmetic as a fragment shader, in two passes:

1. **cell**: the four fields over one lattice cell, into an RGBA16F texture.
   Every texel walks every copy of every shape; this is where the time goes.
2. **screen**: the texture tiled over the view. Each field is thresholded at
   zero with an edge one device pixel soft, and the four are put together.

The cost of a frame does not depend on how much plane is shown, and panning and
zooming are free. Because the texture holds fields rather than the finished
picture, outlines stay sharp when a cell is magnified. An edge is softened by
its slope only where the neighbouring samples show the sign really changes:
where copies tie, the field falls away exponentially without crossing zero, and
a slope alone would call that an outline.

Where a float texture cannot be rendered to, the same shader draws straight to
the screen (`?renderer=direct`).

The cell texture is sized to the device pixels it covers (`cellQuality`), and
while the film plays its size is capped lower on a slow machine.

## Files

| File | |
|---|---|
| `index.html`, `studio.css` | the page |
| `studio-app.mjs` | everything a hand touches: selection, drags, handles, the inspector, the timeline, undo, the address, export |
| `studio-core.mjs` | the group from a census entry, shapes and their distances, motions, a frame's copies, the fields, the link codec |
| `studio-gl.mjs` | the renderer |
| `studio-presets.mjs` | the designs offered, the census film as waves, random designs |
| `tests/studio.test.mjs` | the arithmetic, in Node |
| `tests/studio.browser.mjs` | the page in a browser |
| `tests/sheet.html` | a developer page: designs as rows of frames, drawn by the real renderer |

## Address

| | |
|---|---|
| `#d=<base64url>` | a design |
| `#p=<id>` | a design by name: `plume`, `turnstile`, `sawblade`, `courier`, `dunes`, `iris`, `shuttle`, `windmill`, `stars`, `lenses`, `census` |
| `?class=<id>` | a two-colour class of the census (default `g95-n2-3`) |
| `?paused=1`, `?t=0.25` | start paused, at a time |
| `?renderer=direct` | the single-pass renderer |

## Tests

```sh
node --test docs/shubnikov/studio/tests/studio.test.mjs

python3 -m http.server 8936 --directory docs
node docs/shubnikov/studio/tests/studio.browser.mjs http://127.0.0.1:8936/
BROWSER=webkit node docs/shubnikov/studio/tests/studio.browser.mjs http://127.0.0.1:8936/
```

The Node suite carries random spacetime points by every element of the group
and checks each field's law, for the offered designs, for forty random designs,
and for a sample of the other 306 classes; it also checks that the census film
of `g95-n2-3` is reproduced, point for point, by nine wave layers.

The browser suite reads the canvas back and compares it with the arithmetic,
checks the law on the pixels alone (the frame a quarter loop on is the same
picture turned; the frame half a loop on is its negative), and drives the
editor: select, drag through a turned copy, handles, sliders, undo, links, the
dialogs, another class, a phone.

## Releasing a change

The page's modules carry one cache token, `studio-vN`: on `studio.css` and
`studio-app.mjs` in `index.html`, and on every import between the modules
(`studio-app.mjs`, `studio-gl.mjs`, `tests/sheet.html`). Bump them all together
whenever a module or the stylesheet changes. GitHub Pages lets a browser keep a
file for ten minutes, and a reload refetches only the page itself; with the
token on the imports as well, a reader who reloads straight after a deploy
cannot be left with a new `studio-app.mjs` talking to an old `studio-core.mjs`.
The Node suite fails if the tokens disagree.

## Adding a shape

A shape is defined twice, and the browser suite holds the two together:
`sdShape` in `studio-core.mjs` and `sdShape` in `studio-gl.mjs`, with the same
index in `SHAPES`. Give it an exact exterior distance (see above), a bound
(`shapeBound`), and its rotational symmetry (`sym`), which decides the spin
rates that close the loop.

To look at designs while working on them:

```
tests/sheet.html?only=plume,iris&frames=6&size=220&tmax=0.25
tests/sheet.html?random=1..12
tests/sheet.html?compare=1          # mark pixels where shader and arithmetic disagree
```
