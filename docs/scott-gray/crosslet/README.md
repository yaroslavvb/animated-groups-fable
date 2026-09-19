# Crosslet

Plus-shaped pieces in three colours, on a complex Ginzburg–Landau wave, cycled
only by doing three things at once: **turn the picture a third of a turn about
one particular point, run it forward a third of a period, and step every colour
back one place.** Drop any one of the three and the picture does not come back.

A single frame has no symmetry at all beyond its translations — no rotation
centre, no mirror, nothing — and yet the animation has a threefold colour
symmetry welded to a motion in space *and* in time. The catalog's word for that
is **fully entangled**: the colour-preserving subgroup is exactly the lattice, so
freezing the film leaves nothing behind.

This page is the standalone form of one entry of the colour catalog. The
explorer link it was lifted from is

    /colour/gyre/#g225?v=1&sub=all&model=ginzburg-landau
      &pattern=colour%3Agyre%3Aa767fbcc68c0&framing=endless&tiles=2&palette=colour
      &speed=1&marks=0&notation=0&phase=0.0&play=1&x=0.314815&y=0.324074&scale=380.000

and everything in it — the entry, the framing, the phase, the palette, the marks
switched off — is the opening state here. Serve this folder as static files; no
build, dependencies, remote data or server computation are required.

Live: <https://yaroslavvb.github.io/animated-groups-fable/scott-gray/crosslet/>

The sibling page `../gyre/` paints a Gray–Scott field with the identical rule.
Everything below that is about the *rule* is true of both; everything about the
*numbers* is this entry's own, and they are strikingly different — see
§"How this differs from Gyre".

## The orbit

`field.f32` is byte-identical to the verified catalog orbit
`../../colour/data/orbits/a767fbcc68c06cba12987745386ff07a2980e94406ecde19db5de7f5a6784db1.f32`,
carried in `../../colour/data/colour-atlas.json` as the colouring
**`colour:gyre:a767fbcc68c0`**. The node test asserts the byte identity and the
SHA-256, and re-reads the atlas record to check that the numbers below are still
the ones the catalog carries.

| | |
| --- | --- |
| Catalog id | `colour:gyre:a767fbcc68c0` |
| SHA-256 | `a767fbcc68c06cba12987745386ff07a2980e94406ecde19db5de7f5a6784db1` |
| Bytes | 995 328 — 96 frames × 2 channels × 36 × 36 nodes × float32 little-endian, planar u then v, x fastest |
| Model | complex Ginzburg–Landau, `α −0.75`, `β 0.55`, `D 1` (the catalog's `cgl-d` parameters) |
| Lattice | triangular (`stencil: triangular-six`), basis a₁ = (1, 0), a₂ = (−1/2, −√3/2), box L = 64, dx = 1.77777778 |
| Period | T = 11.3163803 time units, sampled at M = 96 frames, so T/3 is exactly 32 frames |
| Value range | u ∈ [−1.00130308, 1.00130308]; the v channel is fetched and discarded |
| Film group of the field | p3 — the catalogue's `g225`, orbifold `333`, signature ³3³3³3: a third-turn welded to a third of the period |
| Provenance | equation search, relative equilibrium, job `g225-ginzburglandau-cgl-d-L64-N36-s2-phase`, batch `long`, seed 2 |

### The record's certificate

The orbit is a **gated** record, not a picture someone liked. The catalog stores
its certificate beside it:

| | |
| --- | --- |
| Gate | `colour-offline-v1`, **passed** |
| Certificate schema | `equation-orbit-certificate-v1` |
| Trajectory RMS | 1.957 × 10⁻⁸ — how far the saved frames are from solving the equation |
| Symmetry limit | 2 × 10⁻⁷ — the tolerance the claimed `g225` symmetry was verified to |
| Verification code | SHA-256 `632fb512173f42bb2840dd5a7d5fda3cb6e0fc35d48d93de1059161a9e112c89` |

The catalog names its orbit files by the SHA-256 of their bytes, so the file name
*is* the certificate: this page ships the very bytes the record was gated on, and
`../tests/crosslet.test.mjs` recomputes the digest on every run.

The renderer reads only the u channel; the v plane is fetched and discarded, as
on the sibling viewers, so that the shipped file stays the catalog file and the
test can assert byte identity against the source orbit.

## The colouring

Let **g** be the third-turn of the plane about the point

    p = (17/54, 35/108) = (0.314814814…, 0.324074074…)

in lattice coordinates — `x=0.314815&y=0.324074` in the explorer link. **p is not
a symmetry centre of the wave**: it sits 0.319545 lattice lengths from the
nearest threefold centre of the field, which is a third of the way across a cell.
Nothing in a still frame marks it.

In lattice coordinates,

    g(q) = S q + w,     S(u, v) = (v − u, −u),     w = (11/36, 23/36) = (I − S) p

with S³ = I and I + S + S² = 0, so g³ = 1 exactly and g fixes p. The three points
q, g q, g² q are one orbit of the turn about p. Paint each point by whichever
member of that orbit leads, each read at its own third of the cycle:

    colour(x, t) = argmax over k in {0, 1, 2} of U(g^k x, t + k T/3)

with 0 = terracotta, 1 = teal, 2 = sand.

`w` is a whole **(11, 23) of the 36 nodes**, so g carries saved nodes to saved
nodes and every claim in the table below is exact integer arithmetic on the saved
samples — no interpolation, no tolerance.

### The law

The list compared at (g x, t + T/3) is the list compared at (x, t) shifted one
place along —

    U(g^k(g x), t + (k+1)T/3) = U(g^(k+1) x, t + (k+1)T/3)

— so, exactly, for **any** field, any centre and any reconstruction filter,

    colour(g x, t + T/3) = colour(x, t) − 1   (mod 3)

The law is a property of the *construction*, not of this particular wave. What
this particular wave supplies is the other half of the page: that nothing weaker
is true, that no other operation of the lattice is a symmetry either, and that
the picture is worth looking at.

Measured over all **96 × 36 × 36 = 124 416** saved node-frames: **0 violations**
and **0 ties** in the argmax, so the labelling is never ambiguous.

## The symmetry table

Generators of the symmetry group of the **coloured picture**. "Colour" is the
cyclic permutation of terracotta → teal → sand → terracotta the generator
induces; "Time" is the shift it carries. The rows marked *not a symmetry* carry
the measured agreement over all 124 416 saved node-frames, where chance is 1/3
and a symmetry is 1.

| Operation | Colour | Time | Agreement |
| --- | --- | --- | --- |
| translation by a lattice vector a₁ or a₂ | none | 0 | **1** |
| third-turn `g` about `p`, i.e. `R240` with v = (11, 23) nodes | **−1** | **T/3** | **1** |
| two-thirds turn `g²` about the same `p`, `R120` with v = (23, 12) | **+1** | **2T/3** | **1** |
| `g` alone, no time shift | — | — | *not a symmetry*: **0.929229** at best over the three relabellings |
| a T/3 shift alone, no turn | — | — | *not a symmetry*: **0.929229** at best |
| `g` with T/3 but **no recolouring** | — | — | *not a symmetry*: **0.000000** — it agrees nowhere |
| `g` with T/3 and the colours stepped the other way | — | — | *not a symmetry*: **0.000000** |
| the **field's** own p3 relation — `R240` about the lattice origin with T/3, colours untouched | — | — | *not a symmetry*: **0.921007** |
| `g` with its translation v moved one node — its centre 1/(36√3) = 0.0160 of a lattice length off `p` | — | — | *not a symmetry*: **0.928586** |
| `g` about a centre a whole node (1/36 of a lattice length) off `p`, i.e. v = (13, 24) | — | — | *not a symmetry*: **0.876005** |
| `g` itself, one saved frame off T/3 | −1 | T/3 ± T/96 | *not a symmetry*: **0.968750** |
| the best mirror: `Mb`, `Mc` or `Md` at three particular centres, no shift, colours untouched | — | — | *not a symmetry*: **0.939686** |
| the half-turn `R180`, at its best centre, shift and relabelling | — | — | *not a symmetry*: **0.378456** — barely above the 1/3 of pure chance |

The half-turn is not quite the worst the lattice can do: swept over every centre,
every one of the 96 shifts and all six relabellings, the twelve point operations
top out at **1** (the identity, `R120`, `R240`), **0.939686** (`Mb`, `Mc`, `Md`),
**0.378456** (`R60`, `R180`, `R300`) and **0.371544** (`Ma`, `Me`, `Mf`) — so
three of the mirrors come closer to chance than `R180` does, and `R60` and `R300`
tie with it. Each of those five ceilings is re-measured by the node test at the
combination that attains it, alongside the rows above.

Every number in that table is recomputed by `../tests/crosslet.test.mjs` on every
run, at the exact combination that attains it. The claim that each is the
*maximum* of its family comes from an offline sweep of all twelve point
operations × all 1 296 translations × **all 96 time shifts** × all six
relabellings — the same 8 957 952 combinations the exactness sweep below covers,
scored by agreement instead of stopped at the first disagreement, which is why it
is done offline (by FFT cross-correlation) and not on every run. The claim that
none of them is a **symmetry** comes from that exhaustive sweep, which does run
on every run.

### This entry's near misses are near

On `../gyre/` the two halves of the law fail at 42.8 %, barely above chance.
Here they fail at **92.9 %**, and that is the characteristic fact about this
colouring. The reason is visible in the picture: **every node changes colour
exactly three times a period**, and over more than nine tenths of the plane it
simply steps on one place every third of a period wherever you stand. The 7 %
that does not is the whole picture.

A symmetry has to hold *everywhere*, so 92.9 % buys nothing at all — but it does
mean the table's test must be **exactness** and never agreement. Two of the rows
say so from the other side:

* `g` jogged by one saved frame keeps **0.968750** — and so does the plain
  identity jogged by one saved frame, to the last digit. One frame in 96 changes
  the picture by about 3 %, so *any* exact symmetry composed with a one-frame
  shift keeps 97 %. The ridge is the law's own graph seen from slightly off, and
  the test asserts that the two numbers are equal.
* `g` with its translation v jogged by one node keeps **0.928586**: the same near
  miss the turn alone reaches, because that moves the centre by only
  (I − S)⁻¹ of a node — 1/(36√3) = 0.0160 of a lattice length, well under one
  node — and it is a small perturbation of a relation that was 93 % true anyway.
  Move the centre by a *whole* node (which takes v two nodes and one, to
  (13, 24)) and it falls to **0.876005**: the near miss decays sharply with the
  centre, which is the other half of why only exactness settles anything.

### The search that settles it

All 12 point operations of the triangular lattice × all 1 296 lattice
translations × all 96 time shifts × all 6 colour permutations =
**8 957 952 combinations** — that is, every operation carrying the 36 × 36 saved
grid and the 96 saved frames to themselves. Each is tested for **exactness** and
abandoned at its first disagreeing node, which is what makes the sweep cheap
enough to run on every test (it takes about 0.4 s). Exactly three survive:

| point op | translation | time | colour |
| --- | --- | --- | --- |
| identity | (0, 0) | 0 | identity |
| `R240` = `S` | (11, 23) nodes = `w` | 32/96 = T/3 | **−1** (cycle `(021)`) |
| `R120` = `S²` | (23, 12) nodes | 64/96 = 2T/3 | **+1** (cycle `(012)`) |

So the colour-preserving subgroup is exactly the lattice translations — **p1**,
the catalogue's `g1` — and the group of the coloured picture is **p3**, the
catalogue's `g225` (orbifold `333`), the same group the *field* has, moved to a
different centre. The homomorphism onto ℤ₃ has the translations as its whole
kernel, so in this group the three colours are only ever *cycled*: a
transposition would need a mirror or an odd turn, and neither survives.

Algebraically:

    colour(g x, t + T/3)  = colour(x, t) − 1   (mod 3)      exactly, everywhere
    colour(g² x, t + 2T/3) = colour(x, t) + 1  (mod 3)      exactly, everywhere
    colour(x + a, t)      = colour(x, t)                    for every lattice vector a

Read as something to do with your hands: **wait a third of a period and the whole
picture has turned a third of a turn clockwise about the point under the middle
of the screen, with every region taking the previous colour.** Over one
eight-second loop the pattern makes one full turn about a point that is the
centre of nothing. The on-screen sense (clockwise) is measured from the rendered
pixels in the browser test, not read off the algebra.

### The turn centre is a free demonstration of the law

g fixes p, so at that one point the law loses its spatial half and says only

    colour(p, t + T/3) = colour(p, t) − 1

The colour under the middle of the screen steps back one place three times a
loop, for ever, with nothing turning. The three sampled positions collapse onto p
there, so the colouring is flat in a disc around it — but a small and a breathing
one. Measured on the continuum the shader draws, the constant-colour radius
around p (in the plane, where a lattice length is 380 CSS pixels at the home
framing) collapses to a whisker at the instants the colour under p changes and
opens to **0.044 of a lattice length** at its widest — about three nodes, 33 CSS
pixels across — running 0.012 to 0.044 (9 to 33 px across) over the twelve phases
the node test walks. What the node test *asserts* is smaller: the innermost 0.01
of a lattice length, under four CSS pixels of radius, at the one phase 0.1 —
where it then bisects the true radius and finds 0.019, and at 0.26 finds the
0.044 quoted above. Either way it is invisible unless you go looking. Both tests
check the centre: the node test walks twelve phases through `colourAt`, and the
browser test reads the single middle pixel of twelve rendered frames.

### How this differs from Gyre

Same rule, different field, and the numbers are not close.

| | Crosslet (this page) | `../gyre/` |
| --- | --- | --- |
| Field | complex Ginzburg–Landau, `cgl-d` | Gray–Scott, `F 0.00406`, `k 0.02` |
| Grid | 36 × 36 × 96 | 66 × 66 × 96 |
| Turn centre | (17/54, 35/108), 0.3195 from a threefold centre of the field | (1/18, 1/9), about 0.09 from one |
| Boundary density | 0.0714 — large, plus-shaped pieces | 0.1037 |
| Speckle | **0** nodes disagree with all six neighbours | 7.9 × 10⁻⁵ |
| Colour changes per node per period | exactly **3** | 2.91 |
| Boundary speed | 1.167 lattice lengths per period | 0.426 |
| The parts of the law, at best | **0.929229** | 0.428446 |
| Best mirror near miss | 0.939686 | 0.476974 |

Crosslet's pieces are bigger, cleaner and faster on screen; its near misses are
much nearer. The exact statement is the same on both pages, and on both it is the
only one there is.

## How the colours share the plane

Each colour holds exactly a third of space-time: **41 472** of the 124 416
node-frames each, on the nose. That is forced — the bijection (x, t) → (g x,
t + T/3) preserves measure and carries each colour's region onto the next one's,
so the three regions are images of one another over the loop.

A single *frame* is not forced to be balanced, because no symmetry of this
picture carries a time shift of zero. Measured, the worst any frame's share
strays from a third is **0.01466** — the catalog's `areaImbalance`. The browser
test measures the same thing on rendered pixels and finds 0.343 / 0.317 / 0.339.

The palette exists to make that meaningful: terracotta `#c9563e`, teal `#57979a`,
sand `#e2be68`. Every pair stays at least 24 CIELAB units apart in normal vision
and in simulated protanopia, deuteranopia and tritanopia, and the three carry
comparable weight — with each holding a third of the plane, no colour may read as
the background of the other two.

## The generator marks

Press **G**, tick **Generators** in the control bar, or open
`?generators=1`. They are **off by default**: a fresh visit is the picture alone,
as on every page on this site. A viewer who turns them on keeps them on (the
choice is remembered in `localStorage` under `crosslet:generators` and never
leaves the browser); `?generators=1` and `?generators=0` share a view with or
without them without changing what the viewer chose. `?marks=` is accepted too,
because that is the spelling the catalog's own explorers use.

The notation is the site's **clockwork-colour** symbol — see `../../notation.html`
and `../trefoil/` for the full account. Each mark is a **coin** (what the motion
is, and a violet clock dial for how long you wait) and a **chip** (three palette
dots for what becomes of the colours). This entry's symbol:

    3₁⁽⁰²¹⁾ 3₂⁽⁰¹²⁾ · τ₁ τ₂

| Generator | Rotation | Time | Colour |
| --- | --- | --- | --- |
| `g` = 3₁⁽⁰²¹⁾ | 240° ↺ about `p` | ⅓ T | each steps back one |
| `g²` = 3₂⁽⁰¹²⁾ | 120° ↺ about the same `p` | ⅔ T | each steps on one |
| `τ₁` | slide by a₁ | none | unchanged |
| `τ₂` | slide by a₂ | none | unchanged |

It is a **presentation**, not an orbifold symbol: the orbifold of the coloured
picture is `333`, and the first two symbols name **one centre written twice**,
once for each power of the third-turn about it. So the overlay draws them as two
coins either side of a small ring on the true centre, each tethered to it — the
treatment `../../colour/colour-generators.mjs` introduced for exactly this case,
with the shift widened here from 1.28 coin radii to 1.7 so that the two sense
arcs clear each other.

Two things about the placement are this page's own and worth recording:

* **The chips point away from the lattice node.** The only other anchor in a cell
  is the corner the two slides run out of, and it lies 208.6° round the mark's
  clock from `p` — which is where the catalog's default chip directions (210° and
  330°) would have put one of the chips exactly. They are 300° and 60° here, both
  more than 90° clear of it.
* **The crowding is measured by |p|, not by a sixth of a cell.** The shortest gap
  in the annotation is `p` to its cell corner, 0.319545 lattice lengths = 121.4
  CSS pixels at the home framing; that is the `spacing` the marks shrink and fade
  by, and the coverage constant is derived from it rather than assumed (with
  Trefoil's sixth the same formula returns Trefoil's shipped 0.178).

Zoom out and the labels thin first, then the layer fades and goes altogether at
about 113 CSS pixels per repeat — a third of the home framing — or sooner on a
very large window, where the ceiling on how many repeats may be drawn at once
takes over from the legibility floor. The two coins
never part company on the way down: they are one centre, drawn twice or not at
all. Zoom back in and everything returns.

Press **N** for the notation panel, which explains the artwork and closes on
**Esc** or a tap outside; the picture behind it stays live and keeps every
gesture, so the panel is a labelled region and not a dialog.

## Rendering

WebGL 2, one full-screen triangle, one fragment shader.

The texture is a `RGBA32F` 36 × 36 array, one layer per shutter sub-sample.
Channel k of a layer is the field at phase φ + k/3, blended from the four nearest
saved frames with periodic Catmull–Rom weights. The shader reads

    value_k(x) = field(g^k x)[k],      colour = argmax_k value_k

— three positions, one channel each. Because T/3 is a whole 32 saved frames, a
third of a period renames channel k as channel k + 1 *exactly*; and because
g^k(g x) = g^(k+1) x, the two sides of the law are literally the same texture
fetch. So the colour law survives the reconstruction filter with no symmetrised
kernel at all: the node test checks it off the nodes at 2 400 interpolated points
and finds the two sides agreeing to 10⁻¹² — double-precision round-off, not
interpolation error.

The three sampled positions are built one from the last in the shader —

    q1 = vec2(q.y - q.x + W.x, -q.x + W.y);
    q2 = vec2(q1.y - q1.x + W.x, -q1.x + W.y);

— rather than from closed forms, so that both sides of the law evaluate the
identical float expressions.

The argmax is anti-aliased: each colour's weight is how far it leads the better
of the other two, softened by `smoothstep` over about one device pixel of the
same margin, so a boundary is a one-pixel ramp rather than a staircase. Catmull–
Rom is nine bilinear fetches where `OES_texture_float_linear` is available and
sixteen point fetches otherwise.

Adaptive resolution: the renderer draws at native device pixels and a governor
watches the frame cadence, giving up the shutter first and the render resolution
second, never both at once, with cooling-off periods so a slow GPU settles rather
than flickering. `?dpr=` pins the ratio and turns the governor off.

## The shutter

A display shows a frame for a whole frame interval, but the drawn frame is one
instant, so anything moving several pixels per frame arrives as a row of hard
steps instead of a smear. Each displayed frame is therefore integrated over a
shutter of **0.3 × the frame interval**, as three equally spaced sub-samples
whose *colours* are averaged — never the field, which would only displace the
sharp boundary instead of carrying it across the pixels it swept.

Each sub-sample carries its own phase **and its own view**, so a pan, a zoom, a
turn and the animation are all integrated by the same three taps. Every
sub-sample runs the identical kernel, so each of them obeys the law exactly: the
shutter averages three symmetric pictures and cannot perturb the symmetry.

It is spent only where it can do something. The gate is on the *smear* — travel ×
shutter — so the picture must move 2.5 CSS px a frame at the shipped 0.3 shutter.
This pattern's own boundaries reach that at about **1 030 CSS px per lattice
length**, roughly 2.7× the home framing, where `../gyre/` needs 2 790: these
pieces are large and they move. At the home framing the pattern moves 0.93 px a
frame and the shutter stays off, so at ordinary framings it is there for the
view's motion — a drag, a glide, a pinch.

`?shutter=1` restores the full box filter (which engages at about 310 px per
lattice length), `?shutter=0` or `?taa=1` turns the integration off, `?taa=` sets
the sub-samples (up to 5) and `?motion=` dials the gate.

## Framing and controls

The home framing is **one lattice length across 380 CSS pixels, centred on the
turn centre p** — `scale=380.000&x=0.314815&y=0.324074`, exactly the explorer
link's. A window narrower or shorter than 760 px shows two repeats across
instead, so a phone opens on `195` px per lattice length.

One finger or a mouse pans; two fingers pan, zoom and turn about their midpoint,
and a turn that ends within 4° of a sixth of a turn snaps to it. A release keeps
all three gliding, with one piece of inertia shared by every input — fingers, the
wheel, a trackpad pinch, a two-finger turn — and an elastic give at the zoom
limits. The pattern is periodic, so panning is endless in every direction.

| Key | |
| --- | --- |
| `Space` | pause / play |
| `G` | the generator marks |
| `N` | the notation panel (`Esc` closes it) |
| `F`, double-click | fullscreen |
| `0`, `Home` | reset the view |
| `+` / `−` | zoom about the middle (hold to repeat) |
| `[` / `]` | turn (hold to repeat; `Shift` for 60°) |
| arrows | pan (`Shift` for a long step) |
| `S`, or a tap on the name | the frame-statistics overlay |

`Option`/`Alt` with the wheel turns instead of zooming, so a mouse and a trackpad
with no rotate gesture can still turn the pattern smoothly about the pointer. On
a Mac a trackpad pinch and a two-finger turn arrive as two separate event
streams; the viewer accumulates each on its own and latches which kind of stream
it is seeing, so pinching and turning at once works and neither cancels the
other. The `S` overlay prints what the last gesture event carried, which is how
that was diagnosed.

| Query | |
| --- | --- |
| `?phase=` | the opening phase, 0…1 |
| `?play=0` | open paused (also the default under `prefers-reduced-motion`) |
| `?scale=` | CSS pixels per lattice length |
| `?x=`, `?y=` | the lattice point at the screen centre |
| `?angle=` | degrees clockwise |
| `?generators=1`, `?marks=1` | open with the generator marks |
| `?stats=1` | open with the statistics overlay |
| `?taa=`, `?shutter=`, `?motion=`, `?dpr=` | the shutter and the resolution |

Reduced motion pauses the animation and takes the inertia off every gesture: a
release then stops where it was let go, with no glide and no spring. `?play=1`
overrides it.

## Social assets

`social-preview.jpg` is 1200 × 630, rendered from this very page with the shutter
off, the animation held at phase 0 and the canvas captured on its own (no
resize, so there is nothing for the shutter to smear across). `index.html`
carries Open Graph and Twitter card tags pointing at the GitHub Pages URL.

## Publishing it, and where it should be linked from

The page is self-contained and needs nothing but the push: it is served from
`docs/`, so committing `docs/scott-gray/crosslet/` and the two test files puts it
at <https://yaroslavvb.github.io/animated-groups-fable/scott-gray/crosslet/>,
which is what the `og:url`, `og:image` and `rel=canonical` tags already name.
Until that push those three tags resolve to 404 and a shared link previews as
broken — nothing in the folder can fix that from here.

Nothing links *to* it yet either, and the two natural referrers both belong to
other owners, so they are written out here rather than edited from this folder:

* `../../colour/gyre/index.html` — the explorer this page was lifted from. Its
  `page-links` row already carries “The standalone Gyre page”; the sibling is

      <a href="../../scott-gray/crosslet/">Crosslet (this entry, standalone)</a>

  and the same link belongs in that page's `noscript` sentence, which lists the
  standalone pages that each show one field.
* `../../colour/index.html` — the Colour directory, whose `family-grid` already
  links the standalone `../scott-gray/triskele/`. A matching card:

      <a class="family-card" href="../scott-gray/crosslet/" aria-label="Crosslet: one fully entangled Gyre entry, standalone">
        <img src="../scott-gray/crosslet/social-preview.jpg" width="320" height="168" loading="lazy" decoding="async" alt="">
        <span class="family-card-caption"><strong class="family-card-orbifold">Crosslet</strong><span class="family-card-hm">plus-shaped pieces, turned and recoloured</span></span>
        <span class="family-card-count">one Gyre entry</span>
        <span class="family-card-results"><span>Standalone viewer</span><small>one field, no catalog</small></span>
      </a>

The family pages under `../p3/`, `../p4/` and the rest are **generated** by
`../research/wallpaper/build_pages.py`, so a link added to one of them by hand is
lost at the next build; that file is the place to change if the link is wanted
there.

## Validation

    # the rule, the group, the marks and the page's own assets — 23 tests, ~1 s
    node --test docs/scott-gray/tests/crosslet.test.mjs

    # the same rule on the pixels a real engine draws, plus the viewer
    python3 -m http.server 8934 --directory docs     # or any static server
    node docs/scott-gray/tests/crosslet.browser.mjs
    BROWSER=webkit node docs/scott-gray/tests/crosslet.browser.mjs

What the node test establishes:

* `field.f32` is byte-identical to the catalog orbit, its SHA-256 is the record's,
  and the atlas still carries the entry with the parameters quoted above.
* g fixes `p`, g³ = 1, and `w` is a whole (11, 23) of the 36 nodes, so everything
  that follows is exact integer arithmetic.
* The law holds at all **124 416** node-frames with **0 violations** and **0
  ties**; every proper part of it fails, at the agreements tabulated above.
* The exhaustive sweep of **8 957 952** combinations finds exactly three
  symmetries — the identity and the two powers of g.
* Each colour holds exactly a third of space-time; the worst per-frame imbalance
  is the catalog's 0.01466; the boundary density, the speckle count (zero) and
  the churn (exactly 3 per node per period) are the catalog's.
* The four generator marks are symmetries at all 124 416 node-frames, every part
  of each is load-bearing, g² really is g twice in space, time *and* colour, and
  g³ = 1 in all three; the master rule σ(c) = (−1)^m c − j reproduces every
  wait and every recolouring from the geometry.
* The marks are placed by the inverse of the viewer's own camera, and the overlay
  thins and fades as designed — including that no device's home framing ever
  opens on a faded layer.
* Every label on the artwork is built from real tspans, with no character from
  the Unicode superscripts-and-subscripts block, which WebKit has no glyph for.
* The shutter, the governor, the momentum and the framing behave as documented,
  and `momentum.mjs` is byte-identical to `../gyre/` and `../trefoil/`.

What the browser test establishes, in **both Chromium and WebKit**:

* Native retina rendering, balanced three-colour areas, no console errors and no
  failed requests.
* The entangled law on rendered pixels — the turn, the wait and the recolouring
  together at **99.90 %** of the picture, with every proper part of it stuck at a
  near miss of at most **92.08 %**.
* The shader against an independent CPU reconstruction of the same rule, mapping
  each device pixel back through the documented screen → plane → lattice chain:
  **0** disagreements out of ~204 000 pixels, at three different framings.
* The colour under the turn centre stepping back one place every third of a
  period, read from the middle pixel of twelve rendered frames.
* Seamless periodic tiling, the mobile layout, drag panning to the pixel, wheel
  and keyboard zoom, turning, and the shutter engaging only when the picture
  actually moves.
* The generator marks **absent by default**, present on the checkbox, on `G`, on
  `?generators=1` and on `?marks=1`, remembered across a reload, taken out of the
  document when off, never intercepting a pointer, glued to the pattern under a
  pan and a turn, and always two coins on one centre or none at all.
* The notation panel: the symbol as real markup, one row per generator, `Esc` and
  a tap outside, and a phone layout that clears the control bar.
* Pause, play, idle controls, fullscreen, GPU context loss and recovery, and
  reduced motion.

## Files

| | |
| --- | --- |
| `index.html` | the page: canvas, control bar, generator checkbox, notation panel |
| `renderer.mjs` | the rule, the shader, the view, the shutter and the governor |
| `generators.mjs` | this entry's four generators and the clockwork-colour artwork |
| `app.mjs` | gestures, keys, playback, the overlay and the panel |
| `momentum.mjs` | the shared glide — byte-identical to `../gyre/` and `../trefoil/` |
| `style.css` | the control bar, the notation panel and the responsive layout |
| `field.f32` | the catalog orbit, byte for byte |
| `social-preview.jpg` | the card, rendered from this page |
| `manifest.webmanifest` | standalone display on a phone home screen |

This page is GitHub Pages only. It is not deployed to Cloudflare Pages or
anywhere else.
