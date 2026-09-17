# Triskele

A three-colour companion to `../plume-monochrome/`. Plume Monochrome paints a
square-lattice orbit in two colours, swapped by a half turn or a half-period
shift. Triskele paints a **triangular**-lattice orbit in **three** colours,
cycled by a third of a turn or a third of a period, and left exactly alone when
both are done together. Serve this folder as static files; no build,
dependencies, remote data or server computation are required.

## The orbit

`field.f32` is byte-identical to the verified orbit
`../p6/data/orbits/g247-diversity-q1-mixed-L512-F00406-F0p00406000-k0p02000000-L512-N66-M96.f32`,
catalogued as `wallpaper:g225:8fcde9bc1178d93d` (the same field also appears as
`wallpaper:g247:8fcde9bc1178d93d`) and named **"Interwoven sixth-cycle wave"**.

| | |
| --- | --- |
| SHA-256 | `8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c` |
| Bytes | 3 345 408 — 96 frames × 2 channels × 66 × 66 nodes × float32 little-endian, planar U then V, x fastest |
| Model | Gray–Scott, `F 0.00406`, `k 0.02`, `Du 0.16`, `Dv 0.08` |
| Lattice | triangular (`stencil: triangular-six`), basis a₁ = (1, 0), a₂ = (−1/2, √3/2), box L = 512, dx = 7.7576 |
| Period | T = 333.9869 time units, sampled at M = 96 frames, so T/3 is exactly 32 frames |
| Value range | U ∈ [0.11683, 0.24075], V ∈ [0.10605, 0.18599] |
| Groups | p3 (`g225`, orbifold `333`, signature ³3³3³3) and p6 (`g247`, orbifold `632`, signature ⁶6³3²2) — both mirror-free |

The atlas certificate for this orbit reports `passed: true` with every phase
relation at maximum error `0.0`, spatial RMS 0.02704 and temporal RMS 0.02698.

The renderer reads only the U channel, so half of the 3.35 MB download — the V
plane, 1.67 MB — is fetched and discarded. That is deliberate, and the same
choice the sibling viewers make: shipping the atlas file unaltered lets the test
assert byte identity and the SHA-256 against the source orbit, which is the
whole provenance claim. (gzip recovers only 14 % of the file, so compression
would not have made the question moot either way.)

## The colouring

Write R for the 120° **anticlockwise** turn about the lattice origin, the map
that takes a₁ to a₂. In lattice coordinates it is the integer matrix

    R(u, v) = (−v, u − v),

so it carries every lattice grid, and every texture built on one, exactly onto
itself. Each point of the plane is painted by whichever of its three turned
copies is highest:

    colour(x, t) = argmax over k in {0, 1, 2} of U(R^k x, t).

That is the three-colour reading of Plume Monochrome's
`sign(U(x, t) − U(−x, t)) = argmax over {U(x, t), U(−x, t)}`: replace the
two-element orbit of the half turn by the three-element orbit of a third of a
turn. Boundaries are antialiased over about one device pixel.

The orbit is a **rotating wave**: on the saved samples it satisfies, bit for bit
in float32 and in both channels,

    U(R x, t + 2T/3) = U(x, t),

together with the whole sixfold family (60° with 5T/6, 180° with T/2, 240° with
T/3, 300° with T/6). Rearranged, a turn by R is nothing but a shift in time:

    U(R^k x, t) = U(x, t + k·T/3).

So the three numbers the colouring compares are one point of the plane read at
three instants a third of a period apart, and the three colours answer the
question *which third of the cycle does this point lead?*

## The symmetry table

Generators of the symmetry group of the **coloured picture**, and what each one
does to it. "Colour" is the cyclic permutation of terracotta → teal → sand →
terracotta that the generator induces; "Time" is the shift it carries. The last
column marks the rows that are also spacetime symmetries of the underlying field
U — the colouring is a derived quantity, so a map that cyclically permutes the
three compared values is a symmetry of the picture without being one of U.

| Generator | Colour | Time | Symmetry of U too? |
| --- | --- | --- | --- |
| translation by a lattice vector a₁ or a₂ | none | 0 | yes |
| turn by 120° about a threefold centre (R) | −1 | 0 | no |
| turn by 240° about a threefold centre (R²) | +1 | 0 | no |
| pure time shift | −1 | T/3 | no |
| pure time shift | +1 | 2T/3 | no |
| turn by 120° with its matching shift | **none** | 2T/3 | yes |
| turn by 240° with its matching shift | **none** | T/3 | yes |
| half turn about a lattice point | **none** | T/2 | yes |
| turn by 60° about a lattice point | **none** | 5T/6 | yes |

The spacetime group of U itself is exactly the six turns about the lattice
points, R60^k paired with (6 − k)/6 of a period, together with the lattice
translations: a complete search over every point-group element, every lattice
translation, every saved time shift and both directions of time finds those six
and nothing else. The four "no" rows move U by more than its own variation —
U(Rx, t) − U(x, t) has RMS 0.0558 against a field whose RMS about its mean is
0.0323 — yet they leave the picture's outlines exactly where they were, because
they permute the three values the argmax compares instead of changing them.

Read algebraically, with colours numbered 0 = terracotta, 1 = teal, 2 = sand:

    colour(R x, t)          = colour(x, t) − 1 (mod 3)
    colour(x,  t + T/3)     = colour(x, t) − 1 (mod 3)
    colour(R x, t + 2T/3)   = colour(x, t)
    colour(−x, t + T/2)     = colour(x, t)

Read as something to do with your hands: **turn the picture a third of a turn
clockwise about a threefold centre. Every outline falls back exactly on itself —
the three regions are permuted, so their common boundary is unmoved — and every
region takes the previous colour in the cycle. Wait a third of a period and the
same recolouring happens by itself, which is another way of saying that the
whole picture comes back turned a third of a turn clockwise. Turn it and wait,
and nothing has changed at all.** Anticlockwise runs the cycle the other way.
The on-screen directions here are measured from the rendered pixels in the
browser test, not read off the algebra.

Two rows of the table matter for the reason this page exists. The 60° turn is a
symmetry of the *orbit* but is **not** a colour permutation of a single frame:
5T/6 is not a multiple of T/3, so a sixth of a turn slides the whole movie by a
sixth of a period instead. The half turn, by contrast, needs no recolouring at
all once it is paired with T/2 — a colour-preserving operation sitting inside a
group whose threefold generator is colour-cycling.

## "A cyclic colour permutation attached to a generator"

The group of the coloured picture maps onto ℤ₃, each element going to the
permutation it induces on the three colours. Its kernel — the colour-preserving
subgroup — is exactly the spacetime group of U: the lattice translations, the
120° turn with 2T/3, the half turn with T/2, the 60° turn with 5T/6. The two
non-trivial cosets, which cycle the colours forwards and backwards, are what the
picture has and U does not; R alone generates them, and R³ is the identity, so
the picture's group is three times the size of U's and no larger.

Because the permutation is always a 3-cycle, never a transposition, the picture
could not be built from a mirror: a reflection acts on colours as a swap. This
orbit has no mirror to offer, and the search that establishes that has to cover
three things, not one.

- **Mirrors and glide reflections.** Searching all six reflections of the
  triangular point group over all 96 saved time shifts and all 4 356 lattice
  translations — so axes that miss the sixfold centres are included — the
  closest any of them comes leaves an RMS residual of **0.0367** against a field
  whose own RMS about its mean is only **0.0323**. The nearest mirror is worse
  than replacing the field by a constant.
- **Time reversal.** A rotating wave U(x, t) = V(R_ωt x) whose shape V had a
  mirror would satisfy U(Mx, −t + c) = U(x, t), and *that* map acts on the three
  colours as a transposition — exactly the non-cyclic permutation this section
  rules out. It is the one case the forward-time search would miss, so it is
  searched too: the closest time-reversed reflection leaves **0.0362**, no
  better. (`../wallpaper-groups.json` also carries a `timeReversalExclusion`
  argument that q(gx, −t + c) = q(x, t) forces a stationary solution for
  autonomous Gray–Scott, which excludes the case a priori.)
- **Everything at once.** The node test settles it exactly rather than by
  residual: over every element of the triangular point group, every one of the
  4 356 lattice translations, every saved time shift and both directions of
  time, the only exact symmetries of the saved orbit are the six turns about the
  lattice points. No reflection, no glide, no time reversal, no extra
  translation.

The pattern is genuinely chiral, which is also why it reads as a field of
three-armed spirals.

Every colour therefore covers exactly a third of the plane at every instant: the
three regions are images of one another under an area-preserving turn. On the
saved lattice this is exact — at each of the 96 frames, each colour claims
exactly 1 451 of the 4 353 nodes that R does not fix (R fixes just three nodes,
the threefold centres (0, 0), (1/3, 2/3) and (2/3, 1/3), where all three values
tie). In the rendered 2880 × 2000 screenshot the three shares measure
0.334 / 0.331 / 0.335.

## Rendering

WebGL 2, one full-screen triangle, no per-pixel work beyond the sampling.

- The texture is a 66 × 66 RGBA float `TEXTURE_2D_ARRAY`, one layer per shutter
  sub-sample (see below; a still frame uses one). Channel *k* of a layer holds
  the field at that layer's phase `p + k/3`, each blended from the four nearest
  saved frames with periodic Catmull–Rom weights. Because T/3 is exactly 32
  saved frames, the three channels share one set of weights, and advancing the
  phase by T/3 renames channel *k* as channel *k+1* **exactly**.
- The shader reconstructs the three values with a Catmull–Rom kernel
  **symmetrised over the three turns**:

      w_k(x) = (1/3) · sum over j of  field(R^(−j) x)[k + j]

  (three positions, nine bilinear fetches each where `OES_texture_float_linear`
  is present, sixteen point fetches otherwise). A plain tensor-product
  Catmull–Rom in lattice coordinates is not invariant under R, so a single
  reading would make the two identities hold only to interpolation accuracy.
  Averaging the three turned readings makes `w_k(R x) = w_(k+1)(x)` and the
  matching time identity hold pointwise, for the very numbers the shader
  compares — exactly in exact arithmetic, and to a few times 10⁻¹⁶ in double
  precision, against about 1.6 × 10⁻⁴ for the unsymmetrised kernel on the same
  points. Twelve orders of magnitude, and roughly 10⁻¹⁴ of a typical argmax lead
  of 3.5 × 10⁻², so the residual can never flip a colour.
- The winner is drawn with an antialiased argmax: each colour's weight is a
  `smoothstep` of how far it leads the better of the other two, over about one
  device pixel of the same margin, so two-colour borders and the threefold
  triple points both resolve cleanly.
- The palette is terracotta `#c9563e`, teal `#57979a`, sand `#e2be68`. Every
  pair stays at least 24 CIELAB units apart in normal vision and in simulated
  protanopia, deuteranopia and tritanopia (Viénot–Brettel–Mollon), with
  L\* = 51 / 59 / 79. None of the three may read as a background: the symmetry
  gives each exactly a third of the plane.
- Adaptive resolution, as on `../plume/`: when continuous frames arrive later
  than the display's cadence the render resolution drops a step at a time, each
  step kept only if the cadence actually improves, and climbs back once frames
  stay on time. `?dpr=1` (or any ratio) pins the resolution and turns this off.
  The shutter below is a rung of its own **above** that ladder: it is given up
  first, and the pixels only if that was not enough.
  Two things keep that ladder honest on the machines it is for. The display's
  cadence is measured from **idle** animation frames while the pattern
  downloads; on a warm cache there may be too few to measure, and the governor
  then assumes an ordinary 60 Hz screen rather than adopting the cadence of a
  page already struggling — a page drawing at 5 fps must not conclude that 5 Hz
  *is* the refresh rate, since it would then be on time by definition and would
  give up nothing. And a probe that did not pay for itself is believed: the
  cadence it measured becomes the display's, and the wait before trying the same
  thing again doubles, so a GPU sitting on the edge of a step settles instead of
  reallocating its canvas every few seconds. Measured on a software renderer
  (SwiftShader, 2560 × 1600): the page starts at 5 fps with the shutter on, drops
  the shutter at 8 s and then the resolution to 0.52, and holds 45 fps.

Spatial and temporal interpolation improve display quality; they do not claim a
higher-resolution PDE solution.

## Temporal anti-aliasing: the shutter

A display holds each frame for a whole frame interval, but a drawn frame is one
instant. When something crosses several pixels between one frame and the next,
that arrives as a row of hard steps instead of a smear — sample-and-hold judder,
which is what "jumpiness when things are moving fast" looks like. The
one-pixel-wide spatial antialiasing (`fwidth`) cannot cover it.

So each displayed frame is **integrated over a shutter**: `TAA_LAYERS = 3`
equally spaced sub-samples filling `SHUTTER = 0.3` of a frame interval centred
on the frame's own instant (the measurements below were made with the full-frame
filter, `?shutter=1`; the default was cut to 0.3 on 17 September 2026 at the
user's request, for a crisper picture). Each sub-sample carries **its own phase and its own view**:
the phase is blended on the CPU into its own layer of one `TEXTURE_2D_ARRAY`
(RGBA32F, wrapping on the two lattice axes), and the view — centre, scale and
turn — is interpolated across the same three instants from the step the view
actually took since the last frame. So the animation, a drag, an inertial glide,
a pinch and a two-finger turn are all integrated by the same three taps. The
fragment shader averages the **colours** of the sub-samples, never the field:
averaging the field would leave one hard boundary, only displaced, while
averaging the colours carries the boundary across every pixel it swept, which is
what a camera records. The node test proves that distinction point by point.

Four properties make it safe here:

- **The colouring is untouched.** The symmetrised three-turn Catmull–Rom kernel
  runs **per sub-sample** — three turned readings, nine bilinear fetches each,
  once per layer — so `w_k(R x) = w_(k+1)(x)` and the matching time identity hold
  exactly on every layer. The shutter blends three pictures each of which already
  obeys both laws; it never touches the rule that made them.
- **A still picture is bit-identical to one drawn without it.** With nothing
  moving there is nothing to integrate and the renderer uses a single layer, so
  `?taa=0`, `?taa=3` and `?taa=5` give the same paused frame to the last bit —
  and so does `?motion=0`, which asks for the shutter whenever anything moves
  and is therefore not satisfied by a picture that is not moving at all.
  The one-layer draw goes through **a shader of its own**, compiled without the
  sub-sample loop, so the gated-off page pays nothing for a feature it is not
  using: on a software GPU the same draw measured 14.2 ms through the looped
  shader and 12.3 ms through this one, against 12.0 ms for a viewer built with
  no shutter at all. Measured against the pre-shutter build of this page, at
  eight framings and phases (home, mid-phase, 1500, 2400 and 6000 px per repeat,
  the minimum scale, and turns of 60° and 31.5°) × `?taa=0`, the default,
  `?motion=0` and `?taa=5&shutter=2&motion=0`, in Chrome and in WebKit — 64
  comparisons: **100.0000 % of pixels identical, worst channel difference 0**.
- **It is spent only where it can do something.** Before each frame the renderer
  works out how far the picture will travel on screen while that frame is shown:
  the view's own step, plus the pattern's own boundaries at
  `BOUNDARY_SPEED = 0.42` lattice lengths a period (3.00 colour changes per node
  per period over 66 × 0.1076 = 7.10 boundary crossings per lattice length,
  measured on the saved nodes) times the framing. Under `MOTION_PIXELS = 0.75`
  CSS pixels a frame there is nothing to integrate and the shutter stays off. At
  the home framing the pattern moves 0.33 px a frame, so **the home view pays
  nothing**; the shutter switches itself on past about **857 px per repeat**, or
  the moment a finger or the wheel starts moving the view. Press **S** and the
  overlay says which is in force.
- **Frame rate is never traded for it.** The shutter is the governor's *first*
  rung, above the resolution ladder: a GPU that cannot hold the cadence loses the
  motion blur first, and pixels only if that was not enough. Hanging it on the
  quality factor instead would put a 2.5× cost step on the very value the
  governor moves up and down, and the governor would then cross that step for
  ever, changing render resolution and motion blur together. As a rung of its
  own, with a retry wait that doubles each time, a simulated GPU (27 ms a frame
  with the shutter, 10 ms without, on a 60 Hz screen) drops it a handful of times
  in five minutes and then leaves it alone — and its render resolution never
  moves at all. The node test runs that simulation. A real one runs on
  SwiftShader: a page that opens at 5 fps with the shutter engaged is at 45 fps
  within twenty seconds, having given up the blur first and the pixels after.

**A full frame interval is the filter the sampling asks for**, not a stylistic
choice: consecutive frames' sub-samples then tile the timeline with no gap and no
overlap, i.e. the animation is drawn at three times the frame rate and box
filtered down to it. Measured on this page, five phases, 640 × 400 at DPR 1, as
the share of pixels whose colour changes by more than T on some channel from one
60 Hz frame to the next. The palette's three pairs sit 104, 114 and 139 apart at
their furthest channel, so **T = 104 is a whole colour flip however the three are
arranged**, and T = 128 sees only teal ↔ sand:

| what is moving | shutter | > 104 (a colour flip) | > 128 | > 40 |
| --- | --- | --- | --- | --- |
| home framing, 380 px per repeat | off, by the gate | 0.000 → 0.000 % | 0.000 → 0.000 % | 0.262 → 0.262 % |
| 2400 px per repeat | on | **0.246 → 0.103 %** | 0.104 → 0.000 % | 0.733 → 0.824 % |
| 8000 px per repeat | on | **0.310 → 0.121 %** | 0.180 → 0.052 % | 0.656 → 0.791 % |
| a drag at 4 px a frame | on | **3.611 → 1.472 %** | 1.581 → 0.311 % | 8.521 → 9.901 % |
| a drag at 12 px a frame | on | **13.491 → 4.851 %** | 6.547 → 1.907 % | 23.534 → 27.914 % |
| a fling at 30 px a frame | on | **31.746 → 18.832 %** | 15.749 → 8.924 % | 50.619 → 55.393 % |

Two honest notes on that table. The `> 40` column **rises**, by a tenth to a
fifth: motion blur is exactly the trade of one hard step for three soft ones, so
the count of pixels making a *small* change goes up while the count making a full
colour flip falls by half or more. And the panning rows are the reason the
shutter integrates the view at all — a gentle drag throws up an order of
magnitude more judder than the animation ever does at the home framing.

At the other end, three sub-samples cannot reconstruct an arbitrarily long smear:
past about six pixels apart they read as three copies of the picture rather than
one blur. So the view's contribution is integrated over at most
`SMEAR_PIXELS × TAA_LAYERS` = 18 CSS pixels, and a hard fling keeps some of its
judder (which is why the 30 px row improves by two fifths rather than by two
thirds) instead of turning into a comb. The pattern's own motion never reaches
that width — 7 px a frame at the deepest zoom — so the cap bounds panning only.

The default shutter is now `0.3` of a frame, chosen for crispness; `?shutter=0.5`
is the 180° film convention and `?shutter=1` the full box filter the table was
measured with. Cost on an M5 Max (ANGLE Metal, headless Chrome), median draw including a
`readPixels` sync, at a framing where the shutter is engaged, over three runs
(the spread is ±0.1 ms): 2560 × 1440 1.1 → 2.8 ms, **2880 × 1800 1.4 → 3.8 ms**,
3840 × 2160 2.2 → 5.9 ms — 17 % / 23 % / 35 % of a 60 Hz frame, paid only while
something is moving that fast. With the shutter gated off the cost is the
pre-shutter cost, on this GPU and on a software one alike.

| parameter | meaning |
| --- | --- |
| `?taa=0` or `?taa=1` | shutter off — the un-integrated picture the pixel comparisons need |
| `?taa=2…5` | sub-samples per displayed frame (default 3; 5 is a soft ceiling) |
| `?shutter=0…2` | the shutter's width as a share of a frame interval (default 0.3; `0.5` is the film convention, `1` the full box filter; `0` collapses it to a single sub-sample, so it draws *and costs* exactly what `?taa=1` does) |
| `?motion=…` | how far the picture must move in a frame, in CSS pixels, before the shutter is worth paying for (default 0.75; `0` keeps it on whenever anything moves at all — a picture that is not moving at all is still drawn with one layer) |

Press **S** and the stats overlay reads, for example,
`60 fps · 2880×1800 px · quality 1.00 · 2400 px per repeat · 81 taps · display 60 Hz · shutter 3×1.00 frame`
— or, at the home framing where nothing needs integrating,
`… · 380 px per repeat · 27 taps · display 60 Hz · shutter off (of 3)`. The taps
count is per pixel and includes the shutter, so it is the honest measure of what
a frame costs.

## Framing and controls

The home view puts the lattice origin — a sixfold centre of the orbit and a
threefold colour-cycling centre of the picture — at the screen centre, with one
lattice length across 380 CSS pixels. Screens whose shorter side is under
760 CSS pixels keep two repeats across that side instead. The loop takes eight
seconds and begins at phase 0; screens with reduced motion enabled start paused.

The pattern is endless: drag it with a finger or the mouse (a quick release
keeps it gliding). Two fingers pan, zoom and turn it at once about their
midpoint, and a turn that ends within 4° of **a sixth of a turn** snaps to it,
since the lattice is triangular — even though the picture's own colour symmetry
is only a third of a turn. Zooming out stops where one node of the 66-node
lattice spans one device pixel; zooming in stops at 8000 CSS pixels per repeat.

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

- **two** events naming both mean this Safari accumulates both in every event,
  and from then on every field of every event is applied — except a neutral
  field arriving beside a moving one while that accumulator is not neutral,
  which is the split stream's own signature and is held rather than allowed to
  cancel the other quantity. Two events and not one: a single coalesced event
  that happened to name both must not be able to switch the handler into a mode
  where the next magnify event silently wipes a 21° turn;
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
the turn and zoom keys **repeat while held** (3° and 1.05× a repeat, against 15°
and 1.25× for a single press), so one hand can hold `]` while the other pinches.
Every control that *moves* the view — the zoom and turn keys, the arrows, the
wheel — re-bases a trackpad gesture in progress, so a key or wheel change is not
undone by the next gesture event. **Reset** is the exception and cancels the
gesture instead: going home in the middle of a pinch means home, not home plus
whatever the fingers have done so far, so the rest of that gesture is ignored
until they lift.

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
| two fingers | pan, zoom and turn together; a turn within 4° of a sixth snaps |
| trackpad pinch and two-finger turn (Safari) | zoom and turn, simultaneously |
| wheel / two-finger scroll | zoom about the pointer |
| Option + wheel | turn about the pointer |
| `+` `−` | zoom about the centre, 1.25× a press, 1.05× a repeat while held |
| `]` `[` | turn 15° a press, 60° with Shift, 3° a repeat while held |
| arrows | pan (240 px with Shift) |
| `0` / Home / the recentre button | back to the home view |
| Space, `F`, `S`, double-click | pause, fullscreen, stats, fullscreen |

`?scale=`, `?x=`, `?y=`, `?angle=` (degrees), `?phase=`, `?play=0`, `?dpr=` and
`?stats=1` behave as on `../plume/`, alongside `?taa=`, `?shutter=` and
`?motion=` above; a finite value outside the allowed range is clamped to the
nearest one it may take, so a hand-edited link still does what it asks for
instead of silently reverting to the home view. Controls and cursor hide after
inactivity; tapping the name in the control bar also shows frame statistics. GPU
context restoration resumes the pattern; hidden tabs suspend rendering. Inside a
frame that is not allowed to go fullscreen — the way a host page embeds the
viewer — the button instead reads "Open full page" and opens the viewer in its
own tab.

## Social assets

Twitter/X sharing uses `social-preview.jpg` (1200 × 630) with large-summary and
Open Graph metadata. `triskele-preview.mp4` is an eight-second, 1080 × 1080,
30 fps H.264 upload of one seamless loop with no controls or audio. Both come
directly from the actual WebGL renderer. Regenerate them while the local server
is running:

```sh
node tools/export_ember_social.mjs http://localhost:8934/scott-gray/triskele/ docs/scott-gray/triskele 1 triskele-preview.mp4
```

## Validation

From the repository root (Node 20+):

```sh
node --test docs/scott-gray/tests/triskele.test.mjs
node docs/scott-gray/tests/triskele.browser.mjs http://localhost:8934/scott-gray/triskele/
BROWSER=webkit node docs/scott-gray/tests/triskele.browser.mjs http://localhost:8934/scott-gray/triskele/
```

The node test proves on the saved samples that every turn about the origin is a
rotating wave with maximum absolute error `0`; that the 120° turn is exactly a
32-frame time shift; that the colour laws hold at every node R does not fix (the
two *cycling* laws are undefined at the three threefold centres, where all three
values tie bit for bit, and the test asserts that exactly three nodes per frame
tie; the two *combined* laws hold at all 96 × 4 356 nodes with no exceptions at
all, ties included); that each colour covers exactly a third of the nodes at
every frame; and that the only exact spacetime symmetries of the orbit are the
six turns about the lattice points — searched over every point-group element,
every lattice translation, every saved time shift and both directions of time,
so glide reflections and time reversal are covered, not assumed away.

It also covers the shutter: that the sub-phases of consecutive frames tile the
timeline evenly and average to the frame's own instant; that one sub-sample is
the plain frame, bit for bit, so `?taa=0` is the picture this page has always
drawn; that **both** colour identities hold at every sub-phase, so the shutter
only ever averages pictures that already obey the rule; that averaging the
colours blends where averaging the field would not; that the boundary speed
`BOUNDARY_SPEED = 0.42` is the one measured on the saved nodes (0.1076 boundary
density, 3.00 changes per node per period); and the governor simulations above —
the shutter goes first, the resolution is left alone, and the switching settles;
a display the page never got to measure is assumed to be an ordinary one, so a
simulated software renderer at 5 fps gives up the shutter and then the pixels
and ends inside a frame interval, and what it can really hold is learnt from
there; and a cadence no resolution can fix is probed a handful of times over
five minutes, each wait longer than the last, rather than every four seconds.

The browser test checks the rendered pixels: the colour areas, the two cycling
laws, and that a 120° turn with 2T/3, a 240° turn with T/3, a half turn with T/2
and a 60° turn with 5T/6 each leave the picture untouched — over 99.98 % of the
5.76-megapixel frame identical, the remainder single-level differences on colour
boundaries from rounding the cosine and sine of the view's turn. It also
compares the shader's own output against an independent CPU reconstruction,
mapping device pixels back through the screen → plane → lattice chain and
checking the painted colour against `colourAt`. About 200 000 pixels agree
exactly, and the check has teeth where the symmetry checks above do not, since a
systematic error is itself symmetric: seeding a half-texel offset into the
mapping puts 2 634 pixels wrong, a transposed lattice basis 45 000, a reversed
rotation sense all of them. The field it compares against is fetched from
whichever copy of the page is under test, so a live deployment is checked
against its own bytes. Beyond that: retina rendering, fixed scale, seamless
tiling, the mobile layout, drag panning with inertia, wheel and pinch zoom, the
two-finger turn snapping to 60°, reset, stats, pause/play, idle controls, GPU
recovery and reduced motion.

The trackpad path is driven with **four event patterns** — the split Mac stream,
the same with the platform's literal `0` scale, a Safari that accumulates both
quantities, and the two streams interleaved the other way round — and each must
end **both zoomed to 1.4× and turned 30°**. The ambiguous cases are checked too:
a pinch back through exactly 1× must not wipe the turn, a turn back through
exactly 0° must not wipe the zoom, the `held` counter must show it, and the next
event that does name something must land at once. So is the latch itself, from
both sides: one coalesced event naming both quantities in an otherwise split
stream must leave a 21° turn standing when the next magnify event arrives, and a
genuinely cumulative stream must still zoom while a lone `0°` beside a moving
scale is held. So are the fallbacks: a turn key pressed during a live pinch, the
next gesture event not undoing it, and Option + wheel turning without zooming.

The shutter is checked on the rendered pixels as well: a still frame is
**bit-identical** with the shutter available and with `?taa=0`, and stays so
under `?motion=0` and under the widest shutter this viewer offers
(`?taa=5&shutter=2&motion=0`), which is the claim that "integrate whenever
anything moves" does not mean "integrate when nothing does"; `?shutter=0`
draws *and costs* one layer; the integrated frame is the mean of the frames at
its own sub-phases to under a level out of 255; pixels no boundary crossed come
out unchanged while a fast boundary blends hundreds of pixels the plain frame
paints pure; the governor drops the shutter before the resolution and never pays
for both; and a 12 CSS px pan flips 12.4 % of pixels a frame without it against
4.4 % with it.

One gap is not closed by either test: headless WebKit cannot construct a real
`GestureEvent`, so the trackpad pinch-and-turn path is exercised with synthetic
events carrying the same fields (the test says which it got). Only a manual pass
in Safari on a Mac trackpad covers the real thing — and the diagnostic line
described above is what to read off when doing it.

The browser check requires Playwright with Chrome installed; `BROWSER=webkit`
runs the same checks in Playwright's WebKit (Safari's engine). Set
`PLAYWRIGHT_MODULE` and `PNGJS_MODULE` if those packages are outside the bundled
Codex runtime, and `SHOT_DIR` to choose where the screenshots land.

## Deploy

```sh
npx wrangler pages deploy docs/scott-gray/triskele --project-name triskele-wave --branch main
```

Live at <https://triskele-wave.pages.dev/>.
