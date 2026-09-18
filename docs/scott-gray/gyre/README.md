# Gyre

Three colours that can only be cycled by doing three things at once: **turn the
picture a third of a turn about one particular point, run it forward a third of
a period, and step every colour back one place.** Drop any one of the three and
the picture does not come back. A single frame has no symmetry at all beyond its
translations — no rotation centre, no mirror, nothing — and yet the animation has
a threefold colour symmetry welded to a motion in space *and* in time.

The sibling page `../triskele/` paints the very same field, byte for byte, with a
rule whose colour symmetry **splits**: there the turn alone recolours, the wait
alone recolours, and together they cancel. Here nothing splits. That contrast is
the page. Serve this folder as static files; no build, dependencies, remote data
or server computation are required.

## The orbit

`field.f32` is byte-identical to the verified orbit
`../p6/data/orbits/g247-diversity-q1-mixed-L512-F00406-F0p00406000-k0p02000000-L512-N66-M96.f32`,
catalogued as `wallpaper:g225:8fcde9bc1178d93d` (also listed as
`wallpaper:g247:8fcde9bc1178d93d`) and named **"Interwoven sixth-cycle wave"** —
and byte-identical to `../triskele/field.f32`, which the node test asserts.

| | |
| --- | --- |
| SHA-256 | `8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c` |
| Bytes | 3 345 408 — 96 frames × 2 channels × 66 × 66 nodes × float32 little-endian, planar U then V, x fastest |
| Model | Gray–Scott, `F 0.00406`, `k 0.02`, `Du 0.16`, `Dv 0.08` |
| Lattice | triangular (`stencil: triangular-six`), basis a₁ = (1, 0), a₂ = (−1/2, √3/2), box L = 512, dx = 7.7576 |
| Period | T = 333.9869 time units, sampled at M = 96 frames, so T/3 is exactly 32 frames |
| Value range | U ∈ [0.11683, 0.24075], V ∈ [0.10605, 0.18599] |
| Groups of the field | p3 (`g225`, orbifold `333`) and p6 (`g247`, orbifold `632`) — both mirror-free |

The renderer reads only the U channel; the V plane is fetched and discarded, as
on the sibling viewers, so that the shipped file stays the atlas file and the
test can assert byte identity and the SHA-256 against the source orbit.

## The colouring

Let **g** be the third-turn of the plane about the point

    p = (1/18, 1/9)   in lattice coordinates,

which is **not** a symmetry centre of the wave — it sits 0.0962 lattice lengths
from the nearest threefold centre of the field. In lattice coordinates a
third-turn about the origin is an integer matrix, so a third-turn about `p` is
that matrix plus a translation:

    g(q) = S q + w,     S(u, v) = (v − u, −u),     w = (I − S) p = (0, 1/6),

with S³ = I, hence g³ = 1. The three points `q`, `g q`, `g² q` are one orbit of
that turn. Paint each point of the plane by whichever member of its orbit leads,
each read at its own third of the cycle:

    colour(x, t) = argmax over k in {0, 1, 2} of U(g^k x, t + k T/3).

`w` is 1/6 of a lattice length along a₂ — exactly **11 of the 66 nodes** — so `g`
carries saved nodes to saved nodes and every claim below is checked in exact
integer arithmetic on the raw samples, with no interpolation anywhere.

### The law

At `(g x, t + T/3)` the three compared numbers are

    U(g^k(g x), t + T/3 + k T/3) = U(g^(k+1) x, t + (k+1) T/3),

which is the list compared at `(x, t)` shifted one place along — the same three
numbers, relabelled. So, exactly, for any field, any centre and any
reconstruction filter:

    colour(g x, t + T/3) = colour(x, t) − 1   (mod 3).

**Why the halves fail together.** The same reindexing with no time shift gives
`colour(g x, t) = colour(x, t − T/3) − 1`. So the turn alone is a colour symmetry
if and only if the third-period shift alone is — they stand or fall together, and
here both fall. And once the entangled operation is a symmetry, the same
operation *without* the colour cycle cannot be: that would force
`colour = colour − 1`.

**Why lattice translations keep the colours.** `colour(x + a, t)` compares
`U(g^k x + S^k a, …)`, and `S^k a` is again a lattice vector, so the three
numbers are unchanged. The picture is a wallpaper pattern on the *same* unit cell
as the field, even though `g` maps the lattice only to a translate of itself.

## The symmetry table

Generators of the symmetry group of the **coloured picture**. "Colour" is the
cyclic permutation of terracotta → teal → sand → terracotta the generator
induces; "Time" is the shift it carries. The rows marked *not a symmetry* carry
the measured agreement over all 96 × 4 356 = 418 176 saved node-frames, where
chance is 1/3 and a symmetry is 1.

| Generator | Colour | Time | Agreement |
| --- | --- | --- | --- |
| translation by a lattice vector a₁ or a₂ | none | 0 | **1** |
| third-turn `g` about `p = (1/18, 1/9)` | **−1** | **T/3** | **1** |
| two-thirds turn `g²` about the same `p` | **+1** | **2T/3** | **1** |
| `g` alone, no time shift | — | — | *not a symmetry*: **0.428446** at best over the three relabellings |
| a T/3 shift alone, no turn | — | — | *not a symmetry*: **0.428446** at best |
| `g` with T/3 but **no recolouring** | — | — | *not a symmetry*: **0.000000** — it agrees nowhere |
| `g` with T/3 and the colours stepped the other way | — | — | *not a symmetry*: **0.000000** |
| the 120° turn about the **lattice origin** with 2T/3 (Triskele's own relation) | — | — | *not a symmetry*: **0.521233** |
| the field's own sixfold relation, 60° with 5T/6 | — | — | *not a symmetry*: **0.711619**, and only with a colour *transposition* |
| any other third-turn that **keeps** the colours, at any centre, any shift | — | — | *not a symmetry*: **0.566197** at best |
| any other third-turn that **cycles** them, about any other centre | — | — | *not a symmetry*: **0.896316** at best — half a node off `p` |
| `g` itself, one saved frame off T/3 | −1 | T/3 ± T/96 | *not a symmetry*: **0.969654** |
| any of the six mirrors, at any centre, shift and recolouring | — | — | *not a symmetry*: **0.476974** at best |

Every number in the table is recomputed by `../tests/gyre.test.mjs` on every run.

**The exact symmetry is not isolated, and pretending otherwise would be the one
dishonest line in this page.** Move the turn centre half a node off `p` — to the
translation (10, 10) or (11, 10) nodes rather than (11, 11), a centre
`0.0087` lattice lengths = **0.58 nodes** away — and 89.6 % of the picture still
agrees. Keep the centre and move the time shift one saved frame off T/3, and
**96.97 %** agrees. That second figure has no mystery in it at all: one saved
frame out of 96 changes the picture by 3 %, so *any* exact symmetry composed with
a one-frame shift keeps 97 %, and indeed the plain identity at a one-frame shift
scores the same 0.969654 to the last digit — the test asserts that the two are
equal. The ridge is the law's own graph, seen from slightly off. Which is why the
table's test is **exactness**, never agreement: a symmetry either returns the
picture or it does not, and only three operations of the 30 108 672 do.

**The search that settles it.** All 12 point operations of the triangular lattice
× all 4 356 lattice translations × all 96 time shifts × all 6 colour permutations
= **30 108 672 combinations** — that is, every operation carrying the 66 × 66
saved grid and the 96 saved frames to themselves; what happens between them is
the off-node check further down. Two independent sweeps run on every test run: a
brute-force one that tests each combination for exactness and abandons it at its
first disagreeing node, and a Fourier one that computes the full agreement of
every combination at once (one 96 × 66 × 66 cyclic correlation per point
operation, using `[c′ = π(c)] = ⅓ Σⱼ ωʲ⁽ᶜ′⁻π⁽ᶜ⁾⁾` to fold all six colour
permutations into two complex correlations). They share nothing but the colours
themselves, and they agree: exactly three combinations are symmetries.

| point op | translation | time | colour |
| --- | --- | --- | --- |
| identity | 0 | 0 | identity |
| `R240` = `S` | (0, 11) nodes = `w` | T/3 | **−1** |
| `R120` = `S²` | (11, 11) nodes | 2T/3 | **+1** |

So the colour-preserving subgroup is exactly the lattice translations — **p1** —
and the group of the picture is **p3**, the catalogue's `g225` (orbifold `333`,
signature ³3³3³3, the p3 entry whose threefold turn carries a third of a period).
The homomorphism to ℤ₃ is onto with kernel p1, so in this group the three colours
are only ever *cycled*.

No mirror survives, and the search is what says so rather than the algebra: over
all six mirrors, every one of the 4 356 centres, all 96 shifts and all six
relabellings, the best agreement is **0.476974**. (It would be circular to argue
it from the group found *after* mirrors were excluded — a surviving mirror would
simply have made the group bigger, and its colour action a transposition. Nothing
forbids transpositions structurally: the field's own sixfold near-miss in the
table above acts by one. They are absent here because the field is chiral, not
because the algebra rules them out.)

Algebraically, with colours numbered 0 = terracotta, 1 = teal, 2 = sand:

    colour(g x, t + T/3)  = colour(x, t) − 1   (mod 3)      exactly, everywhere
    colour(g x, t)        = colour(x, t − T/3) − 1          exactly, everywhere
    colour(x + a, t)      = colour(x, t)                    for every lattice vector a

Read as something to do with your hands: **wait a third of a period and the whole
picture has turned a third of a turn clockwise about the point under the middle
of the screen, with every region taking the previous colour.** Over one
eight-second loop the pattern makes one full turn about a point that is the
centre of nothing. The on-screen sense (clockwise) is measured from the rendered
pixels in the browser test, not read off the algebra.

## Why this is "entangled", and how Triskele differs

On **Triskele** the colour group *splits*. Three separate things are each true on
their own:

    colour(R x, t)        = colour(x, t) − 1        the turn alone recolours
    colour(x, t + T/3)    = colour(x, t) − 1        the wait alone recolours
    colour(R x, t + 2T/3) = colour(x, t)            together they cancel

Every frame of Triskele is, by itself, a threefold rosette: you can see the
symmetry in a screenshot, and time merely renames the colours in place.

On **Gyre** none of the three halves is true. The only map that takes the picture
to itself is the whole triple — turn, wait, recolour. Drop any one and the
agreement falls from 100 % to 43 %, or to 0 %. That is what makes the symmetry
*entangled*: the colour permutation is not a decoration attached independently to
the space part and to the time part; it is welded to one specific combination of
them, and the generator that cycles the colours is a motion in space **and** in
time.

Only 52.9 % of nodes agree with Triskele's own colouring of the same field, so it
is genuinely a different picture and not a recolouring of the same one.

### The turn centre is a free demonstration of the law

`g` fixes `p`, so at `x = p` the law has nothing left to say but

    colour(p, t + T/3) = colour(p, t) − 1,

and the page obliges. Measured at twelve phases — in the node test from the
reconstruction, and in the browser test from the middle pixel of the rendered
frame — the colour at `p` runs

    2, 1, 1, 1, 1, 0, 0, 0, 0, 2, 2, 2

— sand, then teal, then terracotta, stepping back exactly one place every T/3,
three times a loop, with no exceptions.

Because all three sampled points collapse onto `p` there, the colouring is *flat*
in a small disc around it: radius 0.05 to 0.07 lattice lengths, about 20–26 CSS
pixels at the home framing, where it is indistinguishable from an ordinary
region. **Zoom all the way in and the screen becomes one flat colour that steps
three times per loop** — the symmetry with its spatial part switched off. That is
deliberate and worth knowing rather than hiding; it is also where the picture
moves fastest, which is what the shutter below is for.

## Rendering

WebGL 2, one full-screen triangle, no per-pixel work beyond the sampling.

- The texture is 66 × 66 RGBA float (one layer per shutter sub-sample, see below).
  Channel *k* holds the field at phase `φ + k/3`, each blended from the four
  nearest saved frames with periodic Catmull–Rom weights. Because T/3 is exactly
  32 saved frames, the three channels share one set of weights, and advancing the
  phase by T/3 renames channel *k* as channel *k+1* **exactly**.
- The shader reads **channel k at position g^k q**:

      q0 = q,  q1 = S q0 + w,  q2 = S q1 + w,  value_k = field(q_k)[k]

  (three positions, nine bilinear fetches each where `OES_texture_float_linear`
  is present, sixteen point fetches otherwise). **No symmetrised kernel is
  needed**, unlike Triskele: both sides of the law read the *same* channel at the
  *same* position, so `value_k(g x, φ + 1/3)` and `value_{k+1}(x, φ)` are
  literally the same texture fetch and plain Catmull–Rom is exact. Checked at
  24 000 random off-node points over six phases: worst discrepancy `1.1 × 10⁻¹⁵`,
  zero colour violations. The positions are built one from the last rather than
  from closed forms, so the two sides of the law evaluate the same expressions.
- The winner is drawn with an antialiased argmax: each colour's weight is a
  `smoothstep` of how far it leads the better of the other two, over about one
  device pixel of the same margin.
- The palette is terracotta `#c9563e`, teal `#57979a`, sand `#e2be68` — the same
  three as Triskele, so that the two pages read as *same wave, same colours,
  different rule*. Every pair stays at least 24 CIELAB units apart in normal
  vision and in simulated protanopia, deuteranopia and tritanopia, with
  L\* = 51 / 59 / 79. None may read as a background: each owns exactly a third of
  space-time.
- Adaptive resolution, from `../plume/` but no longer identical to it: this
  page's governor has the shutter as a rung above the resolution ladder, and its
  climb-back keeps away from a level it has already measured as late. When
  continuous frames arrive later than the display's cadence the shutter goes
  first, then the render resolution a step at a time, each step kept only if the
  cadence actually improves. Neither climbs back into a level already measured as
  too slow until its cooling-off expires, and the shutter returns only at full
  resolution after two clean windows — so a GPU that cannot hold the cadence
  settles instead of flickering between two states. `?dpr=1` (or any ratio) pins
  the resolution and turns all of this off.

Spatial and temporal interpolation improve display quality; they do not claim a
higher-resolution PDE solution.

### How the colours share the plane

Each colour claims **exactly** 139 392 of the 418 176 saved node-frames — exactly
a third — because `(x, t) → (g x, t + T/3)` is a measure-preserving bijection of
space-time that sends the region of one colour onto the next. At a *single*
instant the shares need not be equal, and are not: they range over
**[0.312443, 0.350551]**, the same range for all three since the three are images
of one another. In the rendered 2880 × 2000 screenshot the shares measure
0.333 / 0.317 / 0.350.

Other measures of the picture, all recomputed by the node test on the lattice's
own edges — the six nearest neighbours are ±a₁, ±a₂ and ±(a₁ + a₂), so the three
directions that cover every edge exactly once are (1, 0), (0, 1) and (1, 1);
(1, −1) is √3 as far and is a *second* neighbour, not an edge:

| | Gyre | Triskele, same field |
| --- | --- | --- |
| boundary density (share of lattice edges between two colours) | **0.1037** | 0.1076 |
| lone nodes (colour differing from all six neighbours) | **7.9 × 10⁻⁵** | 1.3 × 10⁻⁴ |
| colour changes per node per period | **2.91** | 3.00 |

So this page paints the chunkier and the cleaner of the two colourings of the
same wave. Decisiveness — the mean winner-minus-runner-up over the field's
standard deviation — is **1.004**, so boundaries are sharp rather than marginal.
Those first and third rows together are also the *speed* of the picture: 2.91
crossings a period over 66 × 0.1037 = 6.84 boundaries per lattice length is
**0.426 lattice lengths per period**, which is the constant the renderer turns
into an on-screen speed when deciding whether the shutter below is worth paying
for.

## Temporal anti-aliasing: the shutter

A display holds each frame for a whole frame interval, but a drawn frame is one
instant. When something crosses several pixels between one frame and the next,
that arrives as a row of hard steps instead of a smear — sample-and-hold judder,
which is what "jumpiness when things are moving fast" looks like. The
one-pixel-wide spatial antialiasing (`fwidth`) cannot cover it.

So each displayed frame is **integrated over a shutter**: `TAA_LAYERS = 3`
equally spaced sub-samples filling `SHUTTER = 0.3` of a frame interval centred on
the frame's own instant (the full-frame filter, `?shutter=1`, is what the
measurements below were made with; the default was cut to 0.3 on 17 September
2026 at the user's request, for a crisper picture). Each sub-sample carries **its own phase and its own view**:
the phase is blended on the CPU into its own layer of one `TEXTURE_2D_ARRAY`
(RGBA32F, wrapping on the two lattice axes), and the view — centre, scale and
turn — is interpolated across the same three instants from the step the view
actually took since the last frame. So the animation, a drag, an inertial glide,
a pinch and a two-finger turn are all integrated by the same three taps. The
fragment shader averages the **colours** of the sub-samples, never the field:
averaging the field would leave one hard boundary, only displaced, while
averaging the colours carries the boundary across every pixel it swept, which is
what a camera records. The node test proves that distinction pixel by pixel.

Four properties make it safe here:

- **The symmetry is untouched.** Every sub-sample runs the identical kernel, so
  the entangled law holds *per sub-sample*, exactly. The shutter blends three
  pictures each of which obeys the law.
- **A still picture is bit-identical to one drawn without it.** With nothing
  moving there is nothing to integrate and the renderer uses a single layer, so
  `?taa=0`, `?taa=3` and `?taa=5` give the same paused frame to the last bit —
  which is what lets the pixel comparisons in the browser test be exact.
- **It is spent only where it can do something.** The gate is on the *smear* the
  shutter would draw, not on the travel: a picture moving `travel` CSS px a frame
  is smeared over `travel × SHUTTER` of them, and under `MOTION_PIXELS = 0.75` px
  of smear there is nothing worth three taps. At the shipped 0.3 shutter that
  asks for **2.5 CSS px of travel a frame** — which the pattern's own boundaries,
  at 0.426 lattice lengths a period (measured above), reach only at about
  **2790 CSS px per repeat**, and `?shutter=1` brings forward to 837 px per
  repeat, the figure this page quoted while the gate read the travel rather than
  the smear — the shutter itself has been 0.3 since the page was written, so that
  number moved because the gate changed, not because the shutter narrowed. At the
  home framing the pattern moves 0.34 px a frame, so **the home view pays nothing** —
  and at ordinary framings what engages the shutter is the *view's* motion: a
  drag, a glide, a pinch, the moment it passes 2.5 px a frame. A picture standing
  perfectly still is never integrated, whatever `?motion=0` asks for: there is
  nothing there to smear. Press **S** and the overlay says which is in force.
- **Frame rate is never traded for it.** The shutter is the governor's *first*
  rung, above the resolution ladder: a GPU that cannot hold the cadence loses the
  motion blur first, and pixels only if that was not enough. Hanging it on the
  quality factor instead — which is what this page did until it was reviewed —
  puts a 2.5× cost step on the very value the governor moves up and down, and the
  governor then crosses that step for ever: 35 switches in 80 s in simulation,
  each one changing render resolution and motion blur together. As a rung of its
  own, with a retry wait that doubles each time, the same simulated GPU (27 ms a
  frame with the shutter, 10 ms without, on a 60 Hz screen) drops it four times
  in five minutes and then leaves it alone — and its render resolution never
  moves at all. The node test runs that simulation.

**A full frame interval is the filter the sampling asks for**, not a stylistic
choice: consecutive frames' sub-samples then tile the timeline with no gap and no
overlap, i.e. the animation is drawn at three times the frame rate and box
filtered down to it. Measured on this page, five phases, 640 × 400 at DPR 1, as
the share of pixels whose colour changes by more than T/255 on some channel from
one 60 Hz frame to the next. The palette's three pairs sit 104, 114 and 139 apart
at their furthest channel, so **T = 104 is a whole colour flip however the three
are arranged**, and T = 128 — the threshold this page used to quote — sees only
teal ↔ sand. **Every row was measured at `?shutter=1`**, the full frame interval
this section is about, so these are the numbers that filter reaches and not the
ones the shipped 0.3 shutter draws — for those, see the pan the browser test
measures at both settings, below:

| what is moving | shutter | > 104 (a colour flip) | > 128 | > 40 |
| --- | --- | --- | --- | --- |
| home framing, 380 px per repeat | off, by the gate | 0.000 → 0.000 % | 0.000 → 0.000 % | 0.202 → 0.202 % |
| 2400 px per repeat | off at the default, on here | **0.308 → 0.123 %** | 0.105 → 0.007 % | 0.784 → 0.874 % |
| 8000 px per repeat | on | **0.868 → 0.303 %** | 0.247 → 0.077 % | 0.943 → 1.113 % |
| a drag at 4 px a frame | on | **3.416 → 1.432 %** | 1.742 → 0.363 % | 8.155 → 9.505 % |
| a drag at 12 px a frame | on | **12.744 → 4.666 %** | 7.093 → 2.093 % | 22.089 → 26.851 % |
| a fling at 30 px a frame | on | **31.645 → 19.106 %** | 18.827 → 10.903 % | 49.196 → 55.217 % |

Two honest notes on that table. The `> 40` column **rises**, by a tenth to a
fifth: motion blur is exactly the trade of one hard step for three soft ones, so the count of
pixels making a *small* change goes up while the count making a full colour flip
falls by half or more. And the panning rows are the reason the shutter integrates
the view at all — a gentle drag throws up an order of magnitude more judder than
the animation ever does at the home framing, and before this pass the shutter did
nothing about it.

At the other end, three sub-samples cannot reconstruct an arbitrarily long smear:
past about six pixels apart they read as three copies of the picture rather than
one blur. So the view's contribution is integrated over at most
`SMEAR_PIXELS × TAA_LAYERS` = 18 CSS pixels, and a hard fling keeps some of its
judder (which is why the 30 px row improves by a third rather than by two
thirds) instead of turning into a comb. The pattern's own motion never reaches
that width — 7 px a frame at the deepest zoom — so the cap bounds panning only.

The default shutter is now `0.3` of a frame — about three tenths of the
smoothing measured above, chosen for crispness; `?shutter=0.5` is the 180° film
convention and `?shutter=1` the full box filter the table was measured with. Cost on an M5 Max (ANGLE
Metal, headless Chrome), median draw including a `readPixels` sync, at a framing
where the shutter is engaged: 2560 × 1440 1.2 → 2.9 ms, 2880 × 1800 1.5 → 3.7 ms,
3840 × 2160 2.2 → 5.8 ms — 17 % / 22 % / 35 % of a 60 Hz frame, paid only while
something is moving that fast.

| parameter | meaning |
| --- | --- |
| `?taa=0` or `?taa=1` | shutter off — the un-integrated picture the pixel comparisons need |
| `?taa=2…5` | sub-samples per displayed frame (default 3; 5 is a soft ceiling) |
| `?shutter=0…2` | the shutter's width as a share of a frame interval (default 0.3; `0.5` is the film convention, `1` the full box filter; `0` collapses it to a single sub-sample, so it draws *and costs* exactly what `?taa=1` does) |
| `?motion=…` | how wide the smear must be, in CSS pixels, before the shutter is worth paying for — so the picture must move `motion / shutter` px a frame, 2.5 px at the defaults (default 0.75; `0` keeps it on whenever anything moves at all, but never over a still picture) |

Press **S** and the stats overlay reads, for example,
`60 fps · 2880×1800 px · quality 1.00 · 3000 px per repeat · 81 taps · display 60 Hz · shutter 3×0.30 frame`
— or, at the home framing where nothing needs integrating,
`60 fps · 2880×1800 px · quality 1.00 · 380 px per repeat · 27 taps · display 60 Hz · shutter off (of 3)`.
Both are what the page actually prints at 1440 × 900 CSS pixels on a 2× screen.
2400 px per repeat sits *below* the 2790 px per repeat the default shutter needs, and reads
`… · 2400 px per repeat · 81 taps · display 60 Hz · shutter 3×1.00 frame` only
with `?shutter=1`. The taps count is per pixel and includes the shutter, so it is
the honest measure of what a frame costs.

## Framing and controls

The home view puts the turn centre `p = (1/18, 1/9)` at the screen centre, with
one lattice length across 380 CSS pixels; screens whose shorter side is under
760 CSS pixels keep two repeats across that side instead. The loop takes eight
seconds and begins at phase 0; screens with reduced motion enabled start paused.

The pattern is endless: drag it with a finger or the mouse (a quick release keeps
it gliding). Two fingers pan, zoom and turn it at once about their midpoint, and
a turn that ends within 4° of **a sixth of a turn** snaps to it, since the
lattice is triangular — even though the picture's own colour symmetry is only a
third of a turn. Zooming out stops where one node of the 66-node lattice spans
one device pixel; zooming in stops at 8000 CSS pixels per repeat, which is where
the flat disc around `p` fills the screen.

### Momentum

**Everything a gesture can move keeps moving when you let go**, not just the
pan: throw a pinch and the picture goes on growing for a moment, throw a turn and
it goes on turning, and a two-finger gesture that did all three carries on doing
all three as one glide. `momentum.mjs` holds the whole of it — the same file the
sibling pages ship, byte for byte — with no DOM, no clock and no animation frame
in it, which is what lets the node test check the behaviour rather than the
wiring.

The release velocity is the mean over the gesture's **last 100 ms** — first
sample to last, divided by the time from the first sample to the release, so that
a hesitation before letting go damps the throw. Then each of the three channels
is floored and capped on its own:

| | decay τ | thrown above | never above | so a glide adds at most |
| --- | --- | --- | --- | --- |
| pan | 0.35 s | 60 px/s | 6000 px/s | 2100 CSS px |
| zoom | 0.22 s | ×1.35 a second | ×6 a second | **×1.49** |
| turn | 0.25 s | 17°/s | 200°/s | **50°** |

The pan's numbers are the ones this page always had, to the last digit — a node
test asserts the one-finger fling is *bit-identical* to the code that shipped
before momentum, velocity and displacement, on every frame of the glide. The zoom
is integrated **multiplicatively** — a glide adds a *factor*, so it feels the
same at every framing — and the turn is measured the short way round the circle,
so two fingers crossing the atan2 seam do not read as a whole turn a frame.

Four things keep it from ever running away, and they are the reason it reads as
light rather than loose:

- **A gesture that stops before it ends throws nothing.** A release more than
  80 ms after the last movement is a stop; so is a pause of more than 50 ms
  anywhere inside the window, which cuts the history there rather than averaging
  across it.
- **A scale or a turn needs more than 24 ms of movement to be measured at all.**
  Fingers report every 8–16 ms, so this only ever rejects a burst of events
  arriving in the same instant — which is not a fast pinch but no measurement.
  (The pan has no such floor, so that its long-standing behaviour is untouched.)
- **The fingers of a pinch never lift together.** What the pinch was doing is
  kept for 120 ms as the first finger leaves; if the second follows inside that,
  it is one release and the zoom and turn are thrown. If it stays down, the pinch
  has ended and only the pan it goes on to make is thrown.
- **Any new input cancels the glide** — a finger, the wheel, a trackpad pinch, a
  key, the reset button — and a viewer who asks for reduced motion gets no glide
  at all, on any gesture including the pan. A glide cut short *while it is
  outside the zoom limits*, in the middle of the elastic below, is put back on
  the limit as it is dropped: the excursion is the glide's to give and the
  glide's to return, so whatever ends it early does the returning.

**At the zoom limits the glide gives rather than stopping dead.** It passes the
limit by up to **4 %**, by as much of that as it still had speed to spend, and is
returned to the limit over **150 ms** — out fast, back smooth, landing on the
limit exactly. The way out is a quarter sine rather than a cubic, because a cubic
leaves the limit about twice as fast as the glide arrived at it, which reads as a
pop. Only a glide may leave the allowed range, and only for those 150 ms; every
hand-made zoom still stops flat against it, and a tap in the middle of the
excursion lands the view on the limit rather than leaving it stretched. Measured
in the browser test: a glide into the 8000 ceiling peaks around 8315 px per
repeat — the test pins only that it passes 8000 and stops short of the 8326 the
4 % allows, and the exact peak moves a few px run to run — and comes to rest at
exactly 8000, and so does the same glide
interrupted at its peak, and the same at the floor.

**A thrown turn is aimed at a sixth of a turn.** When the glide starts, the angle
it is heading for is worked out — `angle + rate × τ` — and the nearest sixth to
*that* becomes the target, reached by moving the decay's own asymptote onto it,
so the turn eases onto the sixth with the same exponential rather than being
corrected at the end. Two guards keep it honest: the correction is never more
than half a sixth (30°, the most it could ever be) and never more than the throw
itself, so a small nudge is left exactly where it was thrown, and the target is
never a sixth *behind* where the fingers let go. A turn that is not caught — a
short flick between two sixths — still eases onto a sixth if it happens to stop
within 4° of one, over 130 ms, which is the snap the fingers get.

The wheel is a gesture too — a two-finger scroll arrives as thirty events — so a
burst of them ends with the same glide, **gently**: three tenths of the measured
rate (six for a trackpad pinch, which Chrome reports as a ctrl-wheel), capped at
half of what a finger may throw, and only once at least three events have
arrived. One notch of a mouse wheel moves the view exactly as far as it asks for
and no further. Safari's trackpad `gestureend` throws the zoom and the turn like
any other release.

### Pinching and turning at once on a Mac

macOS sends a trackpad pinch and a trackpad two-finger turn as **two different
event streams**: WebKit forwards a magnify event carrying a scale with the
rotation zeroed, and a rotate event carrying a rotation with a neutral scale
(`NativeWebGestureEventMac.mm` writes `isRotation ? 0 : magnification` and
`isRotation ? rotation : 0`). Applying both fields of every event lets the two
streams cancel — a pinch that keeps snapping back to no turn, and a turn that
keeps snapping back to no zoom — which is why they only ever worked one at a
time. This viewer keeps **two independent accumulators**, taking each quantity
only from an event that actually carries it, and pins the view with both every
time.

An event that carries *neither* quantity is ambiguous: a magnify event whose
pinch has returned to exactly 1× and a rotate event whose turn has returned to
exactly 0° are indistinguishable. The kind of stream settles it, latched over the
whole gesture rather than guessed at per event:

- an event that has ever named **both** means this Safari accumulates both in
  every event, and from then on every field of every event is applied;
- if only **one** quantity has ever been named, the stream is that one kind, so a
  silent event is that quantity coming back to neutral and is applied;
- if both have been named but never together, it is the split Mac stream and a
  silent event is **held**: reading it as both would throw the other accumulator
  away and collapse the view mid-gesture. (Pinch to 1.4×, turn 20°, then turn
  back through exactly 0°, and the zoom used to vanish for the rest of the
  gesture. Now it survives; the turn simply waits for the next event that names
  something, a frame away.) The `gestureend` event is treated the same way, so a
  gesture that ends neutral cannot jump the view home as the fingers lift.

iPhone and iPad are untouched: the handler bails out while any pointer is down,
so the two-finger pointer path keeps doing pan, zoom and turn together.

Two fallbacks for a mouse, or a trackpad whose rotate gesture never arrives:
**Option (Alt) + wheel turns** about the pointer while the wheel alone zooms, and
the turn and zoom keys now **repeat while held** (3° and 1.05× a repeat, against
15° and 1.25× for a single press), so one hand can hold `]` while the other
pinches. Every control that moves the view re-bases a trackpad gesture in
progress, so a key or wheel change is not undone by the next gesture event.

**The diagnostic.** Once a gesture has happened, the stats overlay (press **S**)
gains, for example:

    · gesture raw 1.000/30.000 · flat 2s 2r both 0 of 4 · kept 1.400×/30.0°

`raw` is the last event's own `scale`/`rotation` (`—` for a non-finite field);
`flat Ns Mr` counts the events since `gesturestart` that named no scale and no
rotation, `both K` those that named both, out of the total; `held K` appears when
an ambiguous event had to be kept out (see above); `kept` is where the two
accumulators stand. `flat 2s 2r both 0 of 4` is the split Mac stream;
`flat 0s 1r both 3 of 4` is a Safari that accumulates both. **That line is what
to read off after one pinch-and-turn on a real Mac** — it says which pattern that
Safari sends.

### Everything else

| input | effect |
| --- | --- |
| drag / one finger | pan, endlessly, with a glide on release |
| two fingers | pan, zoom and turn together, all three gliding on release; a turn within 4° of a sixth snaps, and a thrown one is aimed at the nearest sixth |
| trackpad pinch and two-finger turn (Safari) | zoom and turn, simultaneously, gliding on release |
| wheel / two-finger scroll | zoom about the pointer, with a gentle glide after a burst |
| Option + wheel | turn about the pointer |
| `+` `−` | zoom about the centre, 1.25× a press, 1.05× a repeat while held |
| `]` `[` | turn 15° a press, 60° with Shift, 3° a repeat while held |
| arrows | pan (240 px with Shift) |
| `0` / Home / the recentre button | back to the home view |
| Space, `F`, `S`, double-click | pause, fullscreen, stats, fullscreen |

`?scale=`, `?x=`, `?y=`, `?angle=` (degrees, clockwise), `?phase=`, `?play=0`,
`?dpr=` and `?stats=1` behave as on `../plume/`, alongside `?taa=`, `?shutter=`
and `?motion=` above; a finite value outside the allowed range is clamped to the
nearest one it may take, so a hand-edited link still does what it asks for.
Controls and cursor hide after inactivity; GPU context restoration resumes the
pattern; hidden tabs suspend rendering. Inside a frame that is not allowed to go
fullscreen, the button instead reads "Open full page" and opens the viewer in its
own tab.

A share link worth knowing: `?angle=120` draws the home frame turned a third of a
turn clockwise, which is **pixel for pixel** the frame at `?phase=0.3333` with its
colours stepped on one place. The browser test asserts exactly that.

## Social assets

Twitter/X sharing uses `social-preview.jpg` (1200 × 630) with large-summary and
Open Graph metadata, rendered straight from the WebGL viewer at
`?play=0&phase=0.08&scale=330` with the controls hidden.

## Validation

From the repository root (Node 20+), with the static server serving `docs/`:

```sh
node --test docs/scott-gray/tests/gyre.test.mjs
node docs/scott-gray/tests/gyre.browser.mjs http://localhost:8934/scott-gray/gyre/
BROWSER=webkit node docs/scott-gray/tests/gyre.browser.mjs http://localhost:8934/scott-gray/gyre/
node docs/scott-gray/tests/gyre.browser.mjs https://gyre-wave.pages.dev/ live
```

The **node test** (16 tests, about five seconds) works on the saved samples in
exact integer arithmetic: the field's SHA-256 and byte identity with both the
atlas orbit and `../triskele/field.f32`; that `g` fixes `p`, that `g³ = 1` and
that `w` is a whole 11 nodes; the entangled law at **all 418 176 node-frames with
0 violations and 0 ties**; agreement **0** for the same operation without the
recolouring; **0.428446** for each half alone, with the full three-relabelling
rows; **0.521233** for Triskele's own relation and **0.711619** for the field's
sixfold relation; the **exhaustive 30 108 672-combination search** finding
exactly the three symmetries listed above, and the **independent Fourier search**
finding the same three and, with them, every "at best" figure in the symmetry
table — 0.566197, 0.896316, 0.969654 and the mirrors' 0.476974 — with the
correlation spot-checked against the direct count; exactly 139 392 node-frames
per colour and per-frame shares in [0.312443, 0.350551]; the colour at `p`
stepping back one place every T/3; the law off the nodes through the CPU
reconstruction (worst discrepancy ~10⁻¹⁶); the texture channels; the picture's
boundary density, lone nodes, changes per node, decisiveness and disagreement
with Triskele's colouring, on the lattice's own edges; the governor giving up the
shutter before the resolution and settling rather than oscillating, over a
simulated five minutes of a GPU that cannot hold the cadence; and the shutter —
sub-samples centred and tiling, every layer bit-identical to the plain frame at
its sub-phase, the law holding per sub-sample, the view-step arithmetic and the
two thresholds that switch the integration on and cap its width, and the proof
that averaging the colours blends while averaging the field does not.

The **browser test** (Chromium and WebKit, local and live) checks the rendered
pixels: colour areas near a third; the law on screen — a third of a period turns
the picture a third of a turn **clockwise** with the colours stepped back one,
99.87 % of the compared pixels; and, as *negative* tests that matter as much as
the positive one, the turn alone (≤ 41 %), the wait alone (≤ 42 %), the turn and
wait without the recolouring, and the turn the other way, each far from a
symmetry. It then checks the pixel-exact form (`?angle=120` against
`?phase=1/3`), the colour at the middle pixel over twelve phases, and the
shader's output against an **independent CPU reconstruction** of the rule —
mapping each device pixel back through the screen → plane → lattice chain at
three framings, about 200 000 pixels, all agreeing. That last check has teeth
where the symmetry checks do not, since a systematic error is itself symmetric.
The same rendered frames were also compared against the standalone numpy
reference implementation used to design the rule: agreement **1.000000** over
414 000 sampled pixels across five framings. Beyond that: retina rendering, fixed
scale, seamless tiling, the mobile layout, drag panning with inertia, wheel and
pinch zoom, the two-finger turn snapping to 60°, the four Safari gesture-event
patterns each ending at 1.4× **and** 30°, the neutral returns, the two *combined*
returns through neutral that used to collapse the view, the diagnostics, the Mac
key and Option-wheel fallbacks, the shutter (still frames identical with
`?taa=0/3/5`, a moving frame equal to the mean of its sub-samples, the gate
leaving the home framing alone, still off at 2400 px per repeat and engaging at
3000, `?shutter=0`
costing one layer, the governor dropping the shutter before the resolution, and a
12 px-a-frame pan whose colour flips fall from 13.6 % of the screen to 11.9 % at
the shipped 0.3 shutter and to 5.0 % at a full frame),
the momentum (a
pinch that keeps zooming and settles inside the limits, a thrown turn landing on
a sixth, the elastic peak and its exact return to 8000, a glide cut short inside
the excursion resting on the limit, the wheel burst and the trackpad throw),
reset, stats, pause/play, idle controls, GPU recovery and reduced motion.

One gap is not closed by either test: headless WebKit cannot construct a real
`GestureEvent`, so the trackpad path is exercised with synthetic events carrying
the same fields (the test reports which it got). Only a manual pass in Safari on
a Mac trackpad covers the real thing — which is what the **S** diagnostic above
is for.

The browser check requires Playwright with Chrome installed; `BROWSER=webkit`
runs the same checks in Playwright's WebKit (Safari's engine). Set
`PLAYWRIGHT_MODULE` and `PNGJS_MODULE` if those packages are outside the bundled
Codex runtime, and `SHOT_DIR` to choose where the screenshots land.

## Deploy

```sh
export CLOUDFLARE_ACCOUNT_ID=e1e1985643cc8491f400c94ffc9f399a
npx wrangler@latest pages deploy docs/scott-gray/gyre --project-name gyre-wave --branch main --commit-dirty=true
```

Live at <https://gyre-wave.pages.dev/>.
