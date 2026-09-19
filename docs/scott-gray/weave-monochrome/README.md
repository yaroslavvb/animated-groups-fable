# Weave Monochrome

A verified Gray–Scott woven rotating wave, in black and white only.

The page draws the sign of

    w(x, t) = U(x, t) − U(−x, t),

white where the pattern exceeds its own half-turn image and black where it falls
short, with the zero contour anti-aliased over about one device pixel. The half
turn is taken about the lattice origin, which the home view puts at the centre of
the screen.

The still is a **twill**: black and white strands run along one diagonal, each
with an over-and-under notch where it crosses the other family. Slide the picture
half a cell along either axis and black and white change places; slide it half a
cell along *both* and nothing changes at all. Over one period the whole weave
turns once; over a quarter of a period it turns through a right angle.

Live: <https://weave-monochrome.pages.dev/> ·
mirror: <https://spacesheep.dev/@yaroslavvb/weave-monochrome>

Sibling pages: `../plume-monochrome/` is the same rule on a sibling orbit at the
same parameters — `wallpaper:g96:731aa45654d4d690`, period 398.977, no branch
recorded — and it draws a plume, not a weave (see
[Why this one is a weave](#why-this-one-is-a-weave));
`../gyre/` and `../trefoil/` are the hexagonal three-colour pages this viewer's
momentum, Safari gesture handling and shutter come from.

## The orbit

`wallpaper:g11:459f00246aed5414` — *Woven rotating wave · (3,1)*, branch
`g96-diversity-p4-rotating-woven31-f0p00395`. It is the orbit the catalogue page

<https://yaroslavvb.github.io/animated-groups-fable/scott-gray/pg/#g11?v=2&pattern=wallpaper%3Ag11%3A459f00246aed5414&palette=ember&tiles=2&framing=simulation&speed=1&generator=Y>

shows in ember, drawn here by a different rule and nothing else.

| | |
|---|---|
| file | `field.f32`, a byte-identical copy of `../data/orbits/g96-diversity-p4-rotating-woven31-f0p00395-F0p00395000-k0p02000000-L256-N48-M128.f32` |
| sha256 | `459f00246aed541414bbe7d3d092ca2e66e4b3e417ccb5d3d8efaa37abbe78d7` |
| layout | 128 frames × 2 channels (U then V) × 48 × 48, float32 little-endian, x fastest |
| bytes | 2 359 296 |
| period | T = 352.037 332 344 174 44 |
| parameters | Gray–Scott F = 0.00395, k = 0.02, Du = 0.16, Dv = 0.08 |
| lattice | square, L = 256, dx = 16/3, 48 nodes a side |
| spectrum | 96.0 % of the power in \|k\|² = 10 — the (3,1) star |
| admission | independently verified periodic orbit; PDE rms 1.7e−7, closure rms 3.8e−9, sampled-symmetry residual max 0 |
| catalogue group | g11 (pg, zero offset) — the subgroup the linked view marks, *not* all the field has |

The first sixteen hex digits of the sha256 are the orbit id, which is why the id
is `…:459f00246aed5414`. `../tests/weave-monochrome.test.mjs` re-reads the atlas
file, re-hashes the shipped copy and compares the two.

## What the saved samples actually satisfy

A full search — 8 square point operations × all 48 × 48 node translations × all
128 time shifts — finds **32 exact symmetries of the samples**, every one at max
absolute residual **0.0**. That is more than the catalogued p4: the field carries
mirrors and glides that the source orbit's own op list (four rotations) does not
mention. U and V satisfy exactly the same 32.

Six of them are what the rule is built on. In node coordinates, 48 nodes = one
lattice length = one cell, all verified at max abs error **0**:

```
U(−x, t)             = U(x, t + T/2)      half turn about the lattice origin
U(x + (24, 0),  t)   = U(x, t + T/2)      slide half a cell along x
U(x + (0, 24),  t)   = U(x, t + T/2)      slide half a cell along y
U(x + (24, 24), t)   = U(x, t)            the field's own shortest repeat
U(R x, t)            = U(x, t + 3T/4)     R: (x, y) → (−y, x)
U(y + 12, x + 12, t) = U(x, y, t)         the glide the source page marks Y
```

### Three rules that look different are the same function

Because `U(−x, t) = U(x + ½L eₓ, t) = U(x, t + T/2)` holds bit-exactly,

* Plume Monochrome's `sign(U(x,t) − U(−x,t))`,
* the half-period rule `sign(U(x,t) − U(x, t+T/2))`, and
* the half-lattice shift `sign(U(x,t) − U(x + ½L eₓ, t))`

are **literally the same field** on this orbit, not merely similar. The "twill
emphasis" one might hope to get by respecting the lattice-shift structure is
already what the half-turn rule computes here. Likewise `U(x,t) − U(Rx,t)`
reduces to `U(x,t) − U(x, t+3T/4)`, and the diagonal-mirror rule
`U(x,y,t) − U(y,x,t)` is bit-identical to `U(x,t) − U(x+(12,12),t)`.

## The colour law

Every line below is exact — each side is the same expression, so the law survives
any reconstruction filter, on the nodes and off them. Positions are in cell units
(1 cell = L = 256 = 48 nodes); the origin is the lattice origin, which is the
centre of the screen at home.

**These swap black and white**

| motion | time | |
|---|---|---|
| slide (½, 0) — half a cell along x | — | the twill's defining move |
| slide (0, ½) | — | |
| — | + T/2 | wait half a period and the strands change hands |
| half turn about the origin | — | turn the picture upside down |
| quarter turn about the origin | + 3T/4 | |
| reflect in y = x + ¼ | — | a pure mirror, a quarter cell from the Y axis |
| reflect in x + y = ¼ | — | a pure mirror |
| reflect y → −y about y = ⅜, then slide ¼ in x | + T/4 | |

**These leave the colours alone**

| motion | time | |
|---|---|---|
| slide (½, ½) | — | the picture's own shortest repeat |
| quarter turn about the origin | + T/4 | the centre is a colour 4-fold |
| **Y** — reflect in the diagonal y = x through the centre, then slide (¼, ¼) along it | — | the generator the source page marks |
| reflect in x + y = ½, then slide (¼, −¼) along it | — | |
| reflect x → −x about x = ⅜, then slide ¼ in y | + T/4 | |
| — | + T | |

Read off the structure:

* **The two colours are congruent.** A half-cell slide along either axis
  exchanges them exactly; along both axes nothing changes. So the white region
  and the black region are the same shape, and the picture repeats on half the
  cell.
* **Nothing needs to move to swap them:** wait half a period, or turn the picture
  upside down about the centre.
* **The marked generator Y preserves them.** Reflect in the diagonal through the
  screen centre, slide a quarter of a cell along it, and the frame comes back
  identical, black for black. Its two neighbouring mirror lines, a quarter cell to
  either side, swap them instead. That alternation *is* the over-and-under of the
  weave, and it is why the black/white boundary has straight edges one way and
  wobbly edges the other: w vanishes identically along the colour-reversing mirror
  lines, so they are drawn as straight contours.
* The colour-preserving subgroup has index 2 in a group of order 64 modulo the
  lattice — **32 preserving and 32 swapping** — so this is a proper two-colour
  (antisymmetry) spacetime group, not a decorative bicolouring.

`../tests/weave-monochrome.test.mjs` checks every row above at max abs error 0 on
all 128 × 96 × 96 samples, for both the U rule and the V alternate;
`../tests/weave-monochrome.browser.mjs` checks the same operations on the pixels
the page actually paints.

### Why this one is a weave

The same search run on `../plume-monochrome/field.f32` finds **16 preserving + 16
swapping** operations for its w; this orbit gives **32 + 32**. The point groups
are identical — all eight operations of the square appear in both — so the whole
of the difference is the *translation lattice*:

| | half-cell slides that are exact symmetries of w | the picture repeats on |
|---|---|---|
| plume | (½, ½) only, and it **swaps** the colours | the whole cell |
| this orbit | (½, ½) **preserves**; (½, 0) and (0, ½) **swap** | half the cell |

Plume has one colour-reversing translation and no colour-preserving one, so its
two colours are still congruent but its picture does not repeat until the full
cell. Here the diagonal slide preserves the colours and *either* axis slide
reverses them, so the picture repeats on half the cell and a slide along an axis
exchanges black and white. Two colour-reversing translation directions instead of
one is exactly what turns a rotating plume into a weave.

`../tests/weave-monochrome.test.mjs` runs that search on both fields and pins
both counts, so the comparison cannot rot.

### Black and white share the plane exactly

Not approximately: the half-cell slide is an area-preserving bijection of white
onto black, so the two shares are equal by force. Counted on the 128 × 96 × 96
samples the page draws from, **565 248 positive and 565 248 negative**, with the
remaining 4.2 % sitting exactly on the contour — the colour-reversing mirror
lines, where w vanishes identically. On rendered pixels the share is 50.08 %
white, the residue being the antialiased band.

Adjacent saved frames agree on 98.5 % of their texels, so the animation is smooth
and never breaks into speckle. The strands are about **8 nodes across** — 5.93
boundary crossings per cell along x, so 48/5.93 = 8.09 nodes per same-sign run —
which puts about six strands across one cell and about **twelve** across the two
the home view shows.

### The alternate: `?rule=v`

`?rule=v` draws `w = V(x,t) − V(−x,t)` instead: the same 64-element two-colour
group, the same exact 50/50 split, and strands of the same width (8.06 nodes
against 8.09).

It is **not a second picture**. Compared at the same phase the two sign fields
agree on only about a fifth of the samples, which looks like strong
anti-correlation — but scanning every one of the 128 time shifts finds the
agreement peaking at **99.4 %** at a lag of 51 frames, with the runner-up half a
period away from that (the exact colour negative, at 0.6 %). So

    w_V(x, t) = w_U(x, t − 51/128 T)

on 99 % of the drawn volume, and on rendered pixels `?rule=v&phase=0` is
`?phase=0.6015625` on **99.5 %** of them. The alternate shows the same twill at a
different moment of the same loop; the fifth-of-the-samples figure is that
0.4-period offset seen head on. Both the node suite (over all 128 lags) and the
browser suite (on real pixels) pin the relation. Anything else in `?rule=` falls
back to `u`.

## Rendering

Unchanged in substance from `../plume-monochrome/`:

* Every saved frame is spectrally (Dirichlet-kernel) upsampled to 96 × 96 on
  load, and the half-turn difference is taken **there**. The doubled grid is
  closed under the half turn and trigonometric interpolation commutes with it, so
  w is the exact band-limited difference rather than a difference of
  interpolations.
* Each displayed frame is then reconstructed in two cheap steps: the CPU blends
  the four nearest saved frames with periodic Catmull–Rom weights into one 96 × 96
  texture (37 thousand multiply-adds), and the GPU reconstructs every device pixel
  from that texture with periodic bicubic Catmull–Rom — nine bilinear fetches
  where float textures filter, sixteen point fetches otherwise.
* The shader draws `smoothstep(−e, e, w)` with `e = ½·fwidth(w)`, so the contour
  is softened over about one device pixel and no more.

Two textures alternate so an upload never waits for the previous draw; adaptive
resolution (the *governor*) trades render resolution for cadence, and gives up
the shutter before it touches the resolution.

## The shutter (temporal anti-aliasing)

A display shows a frame for a whole frame interval, but the drawn frame is one
instant, so anything moving several pixels per frame arrives as a row of hard
steps instead of a smear — sample-and-hold judder. Each displayed frame is
therefore integrated over a shutter of `SHUTTER` × the frame interval centred on
the frame's own instant, as `TAA_LAYERS` equally spaced sub-samples held in a
`TEXTURE_2D_ARRAY`, one layer each, whose **colours** are averaged. Each
sub-sample carries its own phase *and* its own view, so a pan, a zoom, a turn and
the animation are integrated by the same three taps.

Averaging the field would only displace the sharp contour; averaging the colours
lets the contour sweep across every pixel it crossed. On a two-tone picture that
is the whole of the anti-aliasing there is.

| constant | value | what it is |
|---|---|---|
| `TAA_LAYERS` | 3 | sub-samples per displayed frame (`?taa=`, 1 turns it off, up to 5) |
| `SHUTTER` | 0.3 | the shutter's share of a frame interval (`?shutter=`, 1 is the full box filter, 0 is off) |
| `MOTION_PIXELS` | 0.75 | how wide the smear must be before the shutter is worth its cost (`?motion=`, 0 keeps it on for any motion) |
| `SMEAR_PIXELS` | 6 | the most the view's smear is spread per sub-sample, so a hard fling blurs instead of combing |
| `BOUNDARY_SPEED` | 0.45 | how fast the contour sweeps, in lattice lengths per period |

The gate is on the **smear**, not on the travel: a picture travelling `travel`
pixels a frame is smeared over `travel × SHUTTER` of them, so the shutter engages
at `MOTION_PIXELS / SHUTTER` = 2.5 CSS px of travel a frame at the shipped 0.3
shutter, and 0.75 px a frame with `?shutter=1`. The pattern's own motion reaches
2.5 px a frame at about 2670 CSS px per repeat, against 800 with `?shutter=1`; at
the home framing it moves 0.36 px a frame, so the shutter there is for the view's
motion — a drag, a glide, a pinch. Measured: a 12 CSS px pan flips 15.8 % of
pixels between consecutive frames with no shutter, 13.5 % at the shipped 0.3, and
6.5 % at a full frame interval.

`SHUTTER = 0.3` is the value the colour siblings settled on, and it is worth
saying plainly what it buys here: of the judder in a 12 CSS px pan it removes
about a seventh (15.8 % of pixels flipping between frames becomes 13.5 %), where a
full frame interval removes three fifths (6.5 %). A two-tone picture of hard edges
aliases more visibly under sample-and-hold than the continuous-tone pages this
number was chosen against, so it is the page in the family with most to gain from
a longer shutter — and the one that inherited the shortest. It is kept at 0.3
because choosing otherwise wants a human watching a drag on a real 60 Hz display,
which no measurement here substitutes for; `?shutter=0.6` and `?shutter=1` are one
query parameter away for whoever does that. At the home framing the question is
moot: the pattern moves 0.36 px a frame against a 2.5 px gate, so the shutter only
ever fires during a drag, a glide or a pinch.

`BOUNDARY_SPEED` is bracketed by two measurements on the band-limited field —
colour changes per point per period over boundary crossings per cell gives 0.32 on
the 96-texel grid and 0.54 at 192 nodes and 256 instants, while the contour's own
normal speed `|∂w/∂t| / |∇w|` averages 0.37 near the contour (rms 0.61). The
spread is real: the contour is pinned and motionless along the colour-reversing
mirror lines and quick between them. 0.45 is a round number in the middle, used
only to decide whether the shutter is worth paying for.

The governor treats the shutter as a **rung of its own above** the resolution
ladder. Motion blur must never cost frames, and a cost step sitting on the value
the governor moves up and down would make it oscillate for ever. So when frames
read late the shutter goes first, at full resolution; only if frames are still
late with one sub-sample does the quality factor drop. The shutter comes back only
at full resolution, after two clean windows, and after a wait that doubles each
time it has to be dropped again soon after.

## Framing and controls

**Home view.** The lattice origin at the screen centre (`CENTER = [1, 1]`, i.e.
`tiles/2`) and 2 L across the shorter side (`TILE_PIXELS = 760/2`), matching
`framing=simulation&tiles=2&speed=1` on the source page. The origin is the colour
4-fold, the point the half turn swaps the colours about, and a point the Y glide
axis runs through — w vanishes there at every phase, so a black/white pivot sits
exactly under the middle of the screen. Two cells show about twelve strands,
which is the sweet spot: at one cell only six fit and it reads as a chunky
checkerboard. The loop opens at phase 0, the minimum-boundary, crispest-twill
frame (boundary length varies only 11 % across the loop, so no phase is a dud),
and runs one period per eight seconds.

`scaleFor` holds that framing **between 760 and 1520 CSS px of shorter side**.
Below 760 it keeps 2 L across rather than cropping — a 390 px phone gets 195 px
per repeat. Above 1520 it stops holding `TILE_PIXELS`, because doing so would
keep multiplying the repeats rather than the picture: at 3840 × 2160 and device
ratio 1 a fixed 380 px per repeat puts ten repeats and about forty strands on the
screen, which reads as dense houndstooth rather than as a weave with legible
over-and-under notches. So the framing never goes finer than **4 L across the
shorter side**: `min(max(TILE_PIXELS, shorter/4), shorter/2)`, which is 540 px
per repeat on a 4K screen and leaves every ordinary desktop exactly as it was.

**Gestures.** One finger or a mouse pans; two fingers pan, zoom and turn about
their midpoint; the wheel zooms about the pointer, and Option (Alt) with the wheel
turns instead. The pattern is periodic, so panning is endless in every direction.
A turn that ends within 4° of a **quarter** turn snaps to it, since the lattice is
square.

**Keys.** Space pauses · F fullscreen · S the stats overlay (also a tap on the
name) · 0 or Home resets · `+` / `−` zoom · `]` / `[` turn 15°, Shift for 60°, and
both repeat while held · arrow keys pan, Shift for a longer step.

**Query parameters.** `?rule=u|v` · `?phase=` · `?play=0|1` · `?scale=` CSS pixels
per lattice length · `?x=&y=` the lattice point at the centre · `?angle=` degrees
clockwise · `?dpr=` pins the render resolution · `?stats=1` · `?taa=` · `?shutter=`
· `?motion=`.

### Momentum

`momentum.mjs` is `../gyre/momentum.mjs` with exactly **one** adaptation: this
lattice is square, so a thrown turn aims at a quarter turn rather than at a sixth
(`TURN_STEP = π/2`, `TURN_CATCH = TURN_STEP/2`). The node test strips the prose,
undoes that one substitution and asserts the two modules are the same code, line
for line.

What it does:

* Every gesture — one finger, two fingers, the trackpad, a burst of wheel events
  — keeps the same list of samples and hands the same three-channel velocity to
  the same glide, so there is one piece of inertia in the viewer rather than one
  per input.
* The release velocity is the mean over the gesture's last ~100 ms, divided by the
  time from the first sample to the release, so a hesitation before letting go
  damps the throw. A release that is really a stop (slow, or after an 80 ms pause)
  throws nothing at all.
* The zoom is integrated **multiplicatively** — a fling adds a *factor*, not a
  number of pixels per lattice length — so it feels the same at every zoom.
* Decay time constants: pan 0.35 s (the value the sibling pages have always used,
  so a one-finger fling is unchanged to the last pixel — the node test runs the
  old code against the new and demands identical steps), zoom 0.22 s, turn 0.25 s.
* **Elastic zoom limits.** A glide that reaches a limit does not stop dead against
  it: it gives up to 4 % in log units and springs back over 150 ms. Only a glide
  may be out there. Anything that cuts a glide short — a finger, the wheel, a
  button, a key — calls `stopFling`, which first re-pins the view on the limit it
  was stretching; dropping the state alone would leave the view permanently past
  8000, since nothing else re-clamps the scale.
* **Thrown turns are aimed.** When the glide starts, the angle it is heading for is
  worked out and the nearest quarter turn to *that* becomes the target — but only
  if the correction is no larger than 45° and no larger than the throw itself, and
  only if that quarter turn lies the way the fingers were turning. So a flick lands
  on a symmetry of the picture (a quarter turn with a quarter period is one of the
  colour-preserving operations above), while a small nudge is never dragged 45° it
  did not ask for and nothing is ever pulled backwards.
* A pinch whose second finger lifts within 120 ms of the first is one release: the
  zoom and the turn are thrown with the pan.
* A wheel burst throws too, at a third of the measured rate and only once three
  events have arrived, so one notch of a mouse wheel moves exactly as far as it
  asks and no further.
* `prefers-reduced-motion` takes the inertia off every release: the view stops
  where it was let go, with no glide and no spring.

### Pinching and turning at once on a Mac

macOS sends a trackpad pinch and a trackpad turn as two **separate** streams.
AppKit sends `NSEventTypeMagnify` and `NSEventTypeRotate`, and WebKit forwards
each as its own `gesture*` event carrying only its own quantity: the magnify kind
sets the rotation to zero and the rotate kind sets the scale to a neutral 1 (the
platform event carries 0). Applying both fields of every event lets the two
streams cancel — a pinch that keeps snapping back to no turn, and a turn that
keeps snapping back to no zoom — which is why they only ever worked one at a time.

So each quantity is accumulated on its own and taken only from an event that
actually carries it. An event naming *neither* is ambiguous, and the kind of
stream is latched over the whole gesture rather than guessed per event:

* if any one event has ever named both, this Safari accumulates both in every
  event, and every field of every event is applied;
* if only one quantity has ever been named, a silent event is that quantity
  returning to neutral, and is applied;
* if both have been named but never together, it is the split Mac stream and a
  silent event is **ignored** — reading it as both would throw away the other
  accumulator and collapse the view mid-gesture.

The stats overlay carries the diagnostic, so a report from a real Mac says which
pattern that Safari uses: `gesture raw <scale>/<rotation> · flat <n>s <n>r both
<n> of <n> · held <n> · kept <scale>×/<rotation>°`. The browser suite drives four
event patterns (split, the platform's literal 0, cumulative, and the streams
interleaved the other way round) and requires all four to pinch to 1.4× and turn
30° at the same time.

Every other control re-bases a trackpad gesture in progress, so a Mac can pinch
with one hand and hold `]` with the other.

## Social assets

Regenerate while the local server is running, from the repository root:

```sh
node docs/scott-gray/tests/weave-monochrome.card.mjs   # social-preview.png
node tools/export_ember_social.mjs http://localhost:8934/scott-gray/weave-monochrome/ docs/scott-gray/weave-monochrome 1 weave-monochrome-preview.mp4
```

The card is `social-preview.png`, 1200 × 630 at phase 0; the video is
`weave-monochrome-preview.mp4`, 1080 × 1080, one full period at 30 fps, seamless.
Both are drawn by the page's own WebGL renderer at exact phases, so a slow export
cannot stutter. The shared exporter still writes a `social-preview.jpg` beside
them; this page does not use it. Two reasons:

* **PNG, not JPEG.** The picture is two tones and hard edges. Lossless PNG is both
  exact along the contour and about 70 KB against the JPEG's 178 KB.
* **No resize in the capture.** The shared exporter renders the video at
  1080 × 1080 and then resizes the viewport to 1200 × 630 for the still. The home
  framing follows the shorter side, so that resize moved the picture 127 CSS px in
  a single draw, and the shutter — which could not tell a relayout from a pan —
  integrated the still across it: the old card was 11.5 % mid-grey with 6.3 px
  edge ramps against the page's own 2 %, and framed at 315 px per repeat rather
  than 380. The renderer no longer reads a size change as motion (which also fixes
  the one smeared frame a window resize, a rotated phone or entering fullscreen
  used to paint), and `weave-monochrome.card.mjs` sets its viewport once, before
  the page loads, and refuses to write a card more than 4 % grey.

## The field on the wire

`field.f32` is 2.36 MB of float32 and the whole of the time to first paint on a
cold load — `app.mjs` awaits it before the first frame. Cloudflare compresses the
`.mjs` files and not `application/octet-stream`, so the page fetches
**`field.f32z`**, the same bytes gzipped, at 665 KB — 28.9 % of the original.

`.f32z` rather than `.gz` so no host decodes it in transit uninvited, and the
loader sniffs the gzip magic number (`1f 8b`) rather than trusting a header: if a
host does decode it, the plain field arrives and is used as it is. Anything
without `DecompressionStream` (Safari before 16.4), and anything that fails on the
compressed copy, falls back to `field.f32`, which is still shipped. The notice
counts the download out as a percentage rather than sitting still, since on a slow
connection that wait is the whole of the page's loading time.

Both files are checked in, and the node suite inflates the compressed copy and
compares it with the shipped field byte for byte.

## Validation

```sh
node --test docs/scott-gray/tests/weave-monochrome.test.mjs
node docs/scott-gray/tests/weave-monochrome.browser.mjs http://localhost:8934/scott-gray/weave-monochrome/
BROWSER=webkit node docs/scott-gray/tests/weave-monochrome.browser.mjs http://localhost:8934/scott-gray/weave-monochrome/
node docs/scott-gray/tests/weave-monochrome.browser.mjs https://weave-monochrome.pages.dev/ live
node docs/scott-gray/tests/weave-monochrome.card.mjs            # rebuilds and re-checks the card
```

Run the browser suites **one at a time**: each launches its own browser at
1440 × 1000 with `deviceScaleFactor` 2 and screenshots the full canvas on nearly
every step, and two at once exhaust the GPU.

The node suite covers the shipped bytes and their hash against the atlas, the six
exact identities on the saved samples for both U and V, that the drawn volume is
the band-limited half-turn difference, every row of the colour-symmetry table at
max abs error 0, the exact area balance and the absence of dust, that U and V are
different pictures, that the reconstruction carries the law off the saved frames,
the shutter's units and its cost gate, the governor's shutter rung, the viewport
and its elastic limits (including the framing cap on a 4K screen), the
quarter-turn snap, the compressed copy of the field, the two-colour group counted
in full here and on the plume sibling, the lag at which the V rule reproduces the
U rule, the page's own metadata, and the momentum module in full.

The browser suite covers retina rendering, the balance of black and white, the
two-colour law on rendered pixels (half turn, half period, half-cell slide,
both-axis slide, the glide Y, and the quarter turn with a quarter period), the
shader against an independent CPU reconstruction of the same rule at three
scales and phases, the V alternate and the phase it reproduces, fixed scale and
seamless tiling, the mobile layout, that a resize paints the settled frame and
never a smear, drag pan with its fling, wheel and pinch zoom, a two-finger turn snapped
to 90°, the Safari trackpad in four event patterns with the held-event diagnostic,
the shutter's gate and what it removes from a fast pan, momentum on
pinch/turn/wheel/trackpad with the elastic limit and the tap that stops a glide,
reset, stats, pause and play, the idle controls, GPU context recovery, reduced
motion, and that the console stays clean.

## Deploy

```sh
export CLOUDFLARE_ACCOUNT_ID=e1e1985643cc8491f400c94ffc9f399a
npx -y wrangler@latest pages deploy docs/scott-gray/weave-monochrome --project-name weave-monochrome --branch main --commit-dirty=true
npx --yes spacesheep deploy docs/scott-gray/weave-monochrome --space <uuid> --visibility public
```

`spacesheep` drops a `.spacesheep.json` into the folder, which is how a later
deploy finds the space again. Deleting it so that it is never served — and it
should not be served — means the next deploy creates a **second** space instead of
updating the first, and the CLI has no delete. So pass `--space <uuid>` every
time, take the uuid from `npx --yes spacesheep list`, and delete the file after
the last deploy rather than after each one.

### A note on the name

The design proposed **Weave**, to sit beside *Gyre* and *Trefoil*. What shipped is
**Weave Monochrome**, which pairs with `../plume-monochrome/` — the other
black-and-white page, and the one this rule comes from. The deck therefore carries
two conventions: a colour page is one word, and a black-and-white page is
`<motif>-monochrome`. `manifest.webmanifest` keeps `Weave` as the short name.
