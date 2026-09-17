# Trefoil

Three colours whose symmetry group is **S₃** — not a cycle. Two different things
map this animation to itself, and they are of completely different character.

**The cheap one: slide it.** Move the whole picture by one motif and the shapes
land exactly on shapes, with every colour stepped back one place: terracotta
becomes sand, sand becomes teal, teal becomes terracotta. **No waiting is
involved** — you can check it in a screenshot.

**The entangled one: turn it, wait, and swap two colours.** Turn the picture a
half-turn about the middle of the screen, run it forward exactly half a period,
and **exchange teal and sand while leaving terracotta where it is**. The picture
is identical, everywhere, exactly. Take away any one of the three and it is not:
the half-turn alone, at any centre and with any recolouring you like, reaches
49 %; half a period alone, with any translation and any recolouring, the same
49 %; the half-turn *and* half a period with the colours left alone, 33 % — pure
chance; and with either of the *other* two swaps, 0 %.

And the entanglement is not a stray fact about this one wave either. §1 proves
that in **any** three-coloured film whose colour group is `S₃` the 3-cycles are
always free — they can always be had with no time shift — and that the swaps are
**all or nothing**: either every swap can be had without a time shift, or no swap
can. Which of the two holds is a fact about the particular wave, and the
measurement settles it for this one at the strongest strength available: over all
12 point operations of the lattice, all 4 356 node translations and every time
shift the colour-preserving subgroup could absorb, **nothing realises a swap
better than 54 %.** So here it is the second case, and by the theorem all three
swaps are entangled together.

The sibling pages `../gyre/` and `../triskele/` paint the very same field, byte
for byte, with rules whose colour group is the cyclic `ℤ₃`: on Triskele the
symmetry **splits** (the turn alone recolours, the wait alone recolours), on Gyre
it is **fully entangled** (nothing at all is visible in a single frame). This
page is the third possibility, and the most entangled one a non-cyclic colour
group permits: **half entangled, and provably maximally so** — a non-cyclic
colour group could also have landed in the un-entangled case, with every swap
free as well, and this wave does not. Serve this folder as
static files; no build, dependencies, remote data or server computation are
required.

## 1. The theorem: what a colour group can and cannot be

A **coloured film** is a map `c : ℝ² × ℝ → C` with `|C| = n` colours, and its
**polar spacetime group** is

    G′ = { (g, θ, σ) : g ∈ Isom(ℝ²), θ ∈ ℝ, σ ∈ Sym(C),
                       c(g x, t + θ) = σ(c(x, t)) for all x, t }.

"Polar" = no time reversal: time enters only as a shift, never as `t ↦ −t`
(the site's standing convention — see `wallpaper-groups.json`'s
`timeReversalExclusion`). Write `π(g, θ, σ) = σ` for the recolouring,
`Θ(g, θ, σ) = θ` for the time shift, `Π = im π` for the **colour group** and
`H = ker π` for the **colour-preserving subgroup**, so `Π ≅ G′/H`.

**In two sentences.** Because there is no time reversal, `Θ` is a homomorphism
into the abelian group `(ℝ, +)`, so it descends to `θ̄ : Π → ℝ/Γ` with
`Γ = Θ(H)`, whose kernel is *exactly* the set of recolourings realisable with no
time shift. A discrete film has `Γ = (T/m)ℤ`, making `ℝ/Γ` a circle, so
`Π / ker θ̄` — a finite subgroup of a circle — **is cyclic**.

Three consequences:

- **A.** If *every* non-identity recolouring needs a time shift then `ker θ̄ = 1`,
  so **`Π` is cyclic**. Total entanglement is only possible for `ℤₙ`.
- **B.** Contrapositive: if `Π` is **non-cyclic**, some non-identity recolouring
  is realised by a *purely spatial* operation. Part of a non-cyclic colour group
  is always free.
- **C.** For `Π = S₃`: `[S₃, S₃] = A₃ ⊆ ker θ̄`, so **the 3-cycles are always
  spatial**, and `S₃/ker θ̄` is cyclic of order 1 or 2 — a **dichotomy**, and the
  theorem does not choose between them. Order 1 says every swap is spatial too
  (a real possibility: colour any `L`-periodic wave that is even in `x` at every
  instant by the rule of §3, and the half-turn delivers a swap with no time
  shift). Order 2 says *every* transposition carries a time shift outside `Γ`
  and no amount of cleverness can remove it; the theorem's force is that it is
  all three swaps or none, since `ker θ̄` is a subgroup. Which case a film is in
  is measured, not proved — and §4 measures **order 2** for this one, at 54 %
  for the best swap without a genuine time shift. **That is this page.**

There is a dual statement for the other axis, and it is why nothing here can be
had by waiting alone: the pure time shifts form a normal abelian subgroup, so
the recolourings achievable by waiting are a **cyclic normal** subgroup of `Π`.
For `S₃` that is `1` or `A₃`; here it is `1`.

| page | `Π` | `Γ = Θ(H)` | spatial recolourings | by waiting | reading |
| --- | --- | --- | --- | --- | --- |
| `../triskele/` | `ℤ₃` | `(T/3)ℤ` | **`ℤ₃`** | **`ℤ₃`** | **split**: every frame is a threefold rosette |
| `../gyre/` | `ℤ₃` | `T·ℤ` | **`1`** | `1` | **fully entangled** — allowed only because `ℤ₃` is cyclic (A) |
| **Trefoil** | **`S₃`** | `(T/3)ℤ` | **`A₃`** | `1` | **half entangled, maximally**: `A₃` is forced by (C), and the swaps are measured entangled |

Here `θ̄` sends every transposition to `T/2 mod (T/3) = T/6`, the unique element
of order 2 in `ℝ/Γ` — exactly as Corollary C predicts, and measured in §4.

## 2. The orbit

`field.f32` is byte-identical to the verified orbit
`../p6/data/orbits/g247-diversity-q1-mixed-L512-F00406-F0p00406000-k0p02000000-L512-N66-M96.f32`,
catalogued as `wallpaper:g225:8fcde9bc1178d93d` (also listed as
`wallpaper:g247:8fcde9bc1178d93d`) and named **"Interwoven sixth-cycle wave"** —
and byte-identical to `../gyre/field.f32` and `../triskele/field.f32`, which the
node test asserts.

| | |
| --- | --- |
| SHA-256 | `8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c` |
| Bytes | 3 345 408 — 96 frames × 2 channels × 66 × 66 nodes × float32 little-endian, planar U then V, x fastest |
| Model | Gray–Scott, `F 0.00406`, `k 0.02`, `Du 0.16`, `Dv 0.08` |
| Lattice | triangular (`stencil: triangular-six`), basis a₁ = (1, 0), a₂ = (−1/2, −√3/2) in the renderer's screen-y-down plane coordinates, box L = 512, dx = 7.7576 |
| Period | T = 333.9869 time units, sampled at M = 96 frames, so T/6 is exactly 16 frames |
| Value range | U ∈ [0.11683, 0.24075] with sd 0.032308 |
| Group of the field | p6 (`g247`, orbifold `632`, signature ⁶6³3²2) — mirror-free |

The wave carries a **sixfold screw**, and on the saved samples it is bit-exact —
`max|diff| = 0`, which the node test recomputes:

    U(R₆₀ x, t + 5T/6) = U(R₁₂₀ x, t + 2T/3) = U(R₁₈₀ x, t + T/2)
                       = U(R₂₄₀ x, t + T/3)  = U(R₃₀₀ x, t + T/6) = U(x, t)

The half-turn member of that family is the engine of everything below. The
renderer reads only the U channel; the V plane is fetched and discarded, as on
the sibling viewers, so that the shipped file stays the atlas file.

## 3. The colouring

Let

    b = (1/3) a₁ + (2/3) a₂     in lattice coordinates,

the step from one class of threefold centres of the lattice `L` to the next.
`3b = a₁ + 2a₂` lies in `L`, so `L′ = L + ℤb` is the index-3 triangular
superlattice of *all* threefold centres: `1/√3` as long as `L`, turned 30°.
Paint each point by whichever of its three `L′`-translates leads, **all at the
same instant**:

> ### colour(x, t) = argmax over k ∈ {0, 1, 2} of U(x + k b, t)

Three positions, one channel, **one phase** — the samples carry no time offsets
at all, where `../gyre/` reads three *different* phases. Because 66 is divisible
by 3, `b` is a whole **(22, 44) nodes**, so every claim below is checked in exact
integer arithmetic on the raw samples with no interpolation anywhere.

### Why this is S₃, in one line each

The colours are indexed by `L′/L ≅ ℤ₃`, and the symmetries act on that index
through

- **translations**, which act by *addition* (`x ↦ x + b` shifts the index by 1)
  → the subgroup `A₃`;
- **rotations**, which act by `±1` according to how they move `b` modulo `L`:

      R₆₀ b ≡ −b,  R₁₂₀ b ≡ +b,  R₁₈₀ b = −b,  R₂₄₀ b ≡ +b,  R₃₀₀ b ≡ −b.

So the colour group is the affine group of `ℤ₃`, `ℤ₃ ⋊ {±1} = AGL(1,3) = S₃`.

**The four laws.**

- **Translation by `b`** (no time shift): the three compared numbers are the same
  list rotated one place, since `3b ∈ L`. Hence
  **`colour(x + b, t) = colour(x, t) − 1`**, exactly, for any field and any
  reconstruction filter. *Purely spatial — as Corollary C forces.*
- **Half-turn about the origin with `T/2`**: `U(−x + k b, t + T/2) = U(x − k b, t)`,
  so the list is **reversed**, giving
  **`colour(−x, t + T/2) = −colour(x, t)`** — the transposition that fixes colour
  0 and exchanges 1 and 2. **This is the entangled one.**
- **`R₁₂₀` with `2T/3`**: `R₁₂₀ b ≡ b`, so the list is unchanged and the
  **colours are preserved**.
- **`R₆₀` with `5T/6`** (and `R₃₀₀` with `T/6`): `R₆₀ b ≡ −b`, list reversed →
  the same transposition again.

**Why `b = (1/3, 2/3)` and not another third.** There are exactly four index-3
superlattices `L + ℤb`, represented by `(1/3, 0)`, `(0, 1/3)`, `(1/3, 1/3)` and
`(1/3, 2/3)`. `R₁₂₀` fixes only the last and permutes the other three
cyclically, so this is the only choice for which the threefold structure
survives: the others still give colour group `S₃` (the half-turn law only needs
`R₁₈₀ b = −b`, which is automatic) but their colour-preserving subgroup collapses
to `p1`, they lose the `C₆` point group, and their regions are visibly banded.

## 4. The symmetry table

Generators of the symmetry group of the **coloured picture**. "Colour" is the
permutation of (0 terracotta, 1 teal, 2 sand) the generator induces; "Time" is
the shift it carries. The rows marked *not a symmetry* carry the measured
agreement over all 96 × 4 356 = 418 176 saved node-frames, where chance is 1/3
and a symmetry is 1.

| Generator | Colour | Time | Agreement |
| --- | --- | --- | --- |
| translation by a lattice vector a₁ or a₂ | none | 0 | **1** |
| **translation by `b`** | **−1** | **0** | **1** |
| translation by `2b` | +1 | 0 | **1** |
| **half-turn about the origin** | **swap (1 2)** | **T/2** | **1** |
| `R₆₀` about the origin | swap (1 2) | 5T/6 | **1** |
| `R₃₀₀` about the origin | swap (1 2) | T/6 | **1** |
| `R₁₂₀` about the origin | none | 2T/3 | **1** |
| `R₂₄₀` about the origin | none | T/3 | **1** |
| the half-turn **alone**, any node or half-node centre, any recolouring | — | — | *not a symmetry*: **0.494447** at best |
| **T/2 alone**, any translation, any recolouring | — | — | *not a symmetry*: **0.494447** at best |
| the half-turn with T/2 but **no recolouring** | — | — | *not a symmetry*: **0.333333** — chance exactly |
| the half-turn with T/2 and a **3-cycle** instead of the swap | — | — | *not a symmetry*: **0.333333** |
| the half-turn with T/2 and either **other** swap | — | — | *not a symmetry*: **0.000000** — it agrees nowhere |
| any point op, any node or half-node centre, any node translation, **no time shift**, any **transposition** | — | — | *not a symmetry*: **0.540375** at best |
| the same, with the time shift anywhere in `Γ = (T/3)ℤ` | — | — | *not a symmetry*: **0.540375** at best |
| any **pure time shift** ≠ 0, any recolouring | — | — | *not a symmetry*: T/6 **0.5404**, T/3 **0.4154**, T/2 **0.4944** |
| the half-turn with T/2 about a centre **half a node** away | — | — | *not a symmetry*: **0.898703** |
| any of the **six mirrors**, at any centre, shift and recolouring | — | — | *not a symmetry*: **0.477531** at best |
| the identity **one saved frame** off | — | — | *not a symmetry*: **0.969310** — the nearest miss of all |

Every number in the table is recomputed by `../tests/trefoil.test.mjs` on every
run. Three of them deserve a word.

**The two 0.494447 rows are equal**, and necessarily so: `colour(−x, t) =
−colour(x, t − T/2)` puts the two statistics in bijection, so the two halves of
the entangled law stand or fall together — and both fall. (The same argument
that governs `../gyre/`'s two halves.)

**0.540375 is the theorem, measured.** It is also the field's own `T/6` relation
seen sideways: `colour(R₆₀ x, t) = −colour(x, t + T/6)`, so "a sixth-turn with a
swap and no time shift" and "a pure `T/6` shift with the colours kept" are the
same statistic, and the test asserts they agree to the last digit.

**0.969310 is why the table tests exactness and never agreement.** One saved
frame out of 96 changes the picture by 3 %, so *any* exact symmetry composed with
a one-frame shift keeps 97 %. A symmetry either returns the picture or it does
not, and only 18 operations of the 30 108 672 do.

### The exhaustive search

All 12 point operations of the triangular lattice × all 4 356 node
translations — by (i/66) a₁ + (j/66) a₂, not by whole lattice vectors, which act
trivially — × all 96 time shifts × all 6 colour permutations = **30 108 672
combinations**. Two independent sweeps run on every test run: a brute-force one
that tests each combination for exactness and abandons it at its first
disagreeing node, and a Fourier one that computes the full agreement of every
combination at once (one 96 × 66 × 66 cyclic correlation per point operation,
using `[c′ = π(c)] = ⅓ Σⱼ ωʲ⁽ᶜ′⁻π⁽ᶜ⁾⁾` to fold all six colour permutations into
two complex correlations). They share nothing but the colours themselves, and
they agree: **exactly 18**, and they are precisely 6 rotations × 3 translation
cosets.

| point op | translation | time | colour |
| --- | --- | --- | --- |
| `1` | `0`, `b`, `2b` | 0 | identity, −1, +1 |
| `R₃₀₀` | `0`, `b`, `2b` | T/6 | (1 2), (0 2), (0 1) |
| `R₂₄₀` | `0`, `b`, `2b` | T/3 | identity, −1, +1 |
| `R₁₈₀` | `0`, `b`, `2b` | T/2 | (1 2), (0 2), (0 1) |
| `R₁₂₀` | `0`, `b`, `2b` | 2T/3 | identity, −1, +1 |
| `R₆₀` | `0`, `b`, `2b` | 5T/6 | (1 2), (0 2), (0 1) |

- **All six** colour permutations occur, so the colour group is `S₃`, complete.
- The **colour-preserving subgroup** is exactly `{1 @ 0, R₂₄₀ @ T/3, R₁₂₀ @ 2T/3}`
  together with the coarse lattice `L` — **`g225`**, p3, orbifold `333`, the p3
  entry whose threefold turn carries a third of a period — the same catalogue
  entry as `../gyre/`'s own film group, though about a different centre: Gyre's
  threefold screw turns about p = (1/18, 1/9), this one about the lattice origin.
- The **full film group** is **`g247`**, p6, orbifold `632`, the sixfold screw —
  on the **finer** lattice `L′ = L + ℤb`, with basis `(b, R₁₂₀ b)`. The index is
  **6 = 2 (point) × 3 (translation)**, so only one sixth of the group leaves the
  colours where they are.
- A pleasing coincidence worth saying: **`g247` is also the catalogue entry of
  the underlying wave.** The colouring keeps the wave's own sixfold screw and
  *adds* the translations by `b` and `2b`, which the wave does not have — and
  pays for all of it in colour.
- **No mirror survives** anywhere, at any centre, shift or relabelling (best
  0.477531): the field is chiral, and this construction cannot manufacture a
  mirror.
- `Γ = Θ(H) = (T/3)ℤ`; every transposition sits at `T/6 mod (T/3)`, the order-2
  element of `ℝ/Γ`. **`θ̄` is onto `ℤ₂` with kernel `A₃`** — the theorem's
  picture, realised exactly.

### Read as something to do with your hands

**Play it and the picture turns steadily clockwise, one full turn per
eight-second loop**, the shapes gliding through one another. Stop it anywhere and
slide the view by one motif: the shapes match, but the colours have stepped
round. Stop it, turn the screen upside down, and it does *not* match — until you
also run the clock forward four seconds *and* trade the teal for the sand.

The on-screen sense (clockwise) is measured from the rendered pixels, not read
off the algebra: the browser test asserts, pixel for pixel, that the frame at
`5T/6` is the home frame turned 60° **anticlockwise** with teal and sand
exchanged — equivalently, that every sixth of a period turns the picture 60°
clockwise and swaps two colours, so six of them make one full clockwise turn and
the identity.

### How this differs from its two siblings

On **Triskele** the colour group splits: every frame is by itself a threefold
rosette, and time merely renames the colours in place. On **Gyre** nothing at all
is visible in a single frame; the whole colour group is welded to a motion in
space *and* time, which §1 permits only because Gyre's colour group is the cyclic
`ℤ₃`. Here the colour group is bigger — `S₃`, not cyclic and not even abelian —
and the price of that is exactly one free generator. What you get for the price
is a new *kind* of symmetry the site has not shown before: an operation of
**order two** in the colours. Gyre can only ever cycle its colours forward or
back; this page can **swap two and fix the third** — and the only way to do it is
to turn, wait and swap, all three at once.

The best agreement between this colouring and the siblings' colourings of the
same field, over all six relabellings, is **0.5691** (Gyre) and **0.5273**
(Triskele): a genuinely different picture on the same wave, not a recolouring of
either.

### The centre of the half-turn

The half-turn fixes the lattice origin, which sits under the middle of the
screen, so there the law has nothing left to say but

    colour(0, t + T/2) = −colour(0, t).

Colour 0 is the *fixed point* of that swap, so if the origin were ever terracotta
it would have to be terracotta for ever — and it never is. It alternates teal and
sand **three times a loop** — six changes, one every `T/6` — with
`c(0, t + T/3) = c(0, t)` at all 96 saved frames and at all 48 sampled phases.

Being honest about what that looks like: the three points sampled at the origin
are the wave's own three threefold centres, where U sits within `2.3 × 10⁻⁴` of
one value, so **all three colours meet within a pixel or two of the screen centre** —
the fixed point of the law is drawn as a triple junction, and *which* of teal and
sand holds the exact centre is decided by a margin of `10⁻⁶`. The node test
checks the alternation on the reconstruction; the browser test checks the
junction. **Unlike `../gyre/`, there is no degenerate neighbourhood anywhere
else**: the three samples stay `|b| = 1/√3` apart everywhere in the plane, so
nothing collapses and no disc of the picture moves faster than the rest.

## 5. Rendering

WebGL 2, one full-screen triangle, no per-pixel work beyond the sampling.

- The texture is 66 × 66 **single-channel float** (`R32F`), one layer per shutter
  sub-sample. The rule reads **one instant**, so one number per node is the whole
  of what the shader needs — where `../gyre/` must carry three phases in three
  channels, this page uploads a quarter as many bytes. Each layer is blended from
  the four nearest saved frames with periodic Catmull–Rom weights.
- The shader reads the same channel at **three positions**:

      q0 = q,  q1 = q0 + b,  q2 = q1 + b,   value_k = field(q_k)

  (three bicubic fetches: nine bilinear taps each where `OES_texture_float_linear`
  is present, sixteen point fetches otherwise). The positions are built one from
  the last rather than from closed forms, so both sides of the translation law
  evaluate the same float expressions.
- **No symmetrised kernel is needed for the two laws the page is about.** `b` is
  a whole number of nodes, so plain Catmull–Rom is translation-exact; the kernel
  is even in each coordinate, so it is point-reflection-exact too. Checked at
  2 400 random off-node points over six phases: worst discrepancy `1.1 × 10⁻¹⁵`
  for the 3-cycle and `1.3 × 10⁻¹⁵` for the swap, with **zero** colour
  violations. The two *threefold* laws are exact on the saved nodes but off by
  `1.8 × 10⁻⁴` between them — 0.55 % of the field's standard deviation, about a
  fifth of one 8-bit level, a fraction of a device pixel of boundary — because a
  tensor-product kernel is not invariant under a 120° turn. Paying three times
  the fetches for a symmetrised kernel (as `../triskele/` does) to fix that would
  be a poor trade, and the page does not.
- The winner is drawn with an antialiased argmax: each colour's weight is a
  `smoothstep` of how far it leads the better of the other two, over about one
  device pixel of the same margin. It is symmetric in the three values, so it
  carries every colour law exactly.
- The palette is terracotta `#c9563e`, teal `#57979a`, sand `#e2be68` — the same
  three as the siblings, so that the pages read as *same wave, same colours,
  different rule*. Every pair stays at least 24 CIELAB units apart in normal
  vision and in simulated protanopia, deuteranopia and tritanopia, with
  L\* = 51 / 59 / 79. None may read as a background: each owns exactly a third of
  every frame.
- Adaptive resolution, shared with `../gyre/`: when continuous frames arrive
  later than the display's cadence the shutter goes first, then the render
  resolution a step at a time, each step kept only if the cadence actually
  improves. Neither climbs back into a level already measured as too slow until
  its cooling-off expires. `?dpr=1` (or any ratio) pins the resolution and turns
  all of this off.

Spatial and temporal interpolation improve display quality; they do not claim a
higher-resolution PDE solution.

### How the colours share the plane

Each colour claims **exactly one third of every single frame** — 139 392 of the
418 176 saved node-frames each over the loop, and a per-frame share whose range
is `[0.333333333333, 0.333333333333]`. That exactness is a direct dividend of the
theorem: translation by `b` is an area-preserving bijection of the plane *at a
fixed instant* carrying each colour's region onto the next, and it is precisely
the purely spatial 3-cycle that a non-cyclic colour group forces on us. (On
`../gyre/`, where nothing is spatial, the per-frame shares range over
`[0.3124, 0.3506]`.) In the rendered 2880 × 2000 screenshot the shares measure
0.341 / 0.325 / 0.334 — a screenful is not a whole number of cells.

Other measures of the picture, all recomputed by the node test on the lattice's
own edges — the six nearest neighbours are ±a₁, ±a₂ and ±(a₁ + a₂), so the three
directions that cover every edge exactly once are (1, 0), (0, 1) and (1, 1);
(1, −1) is √3 as far and is a *second* neighbour, not an edge:

| | Trefoil | Gyre, same field | Triskele, same field |
| --- | --- | --- | --- |
| boundary density (share of lattice edges between two colours) | **0.1013** | 0.1037 | 0.1076 |
| lone nodes (colour differing from all six neighbours) | 8.6 × 10⁻⁵ | 7.9 × 10⁻⁵ | 1.3 × 10⁻⁴ |
| colour changes per node per period | 2.946 | 2.913 | 3.000 |

So this page paints the chunkiest of the three colourings of the same wave.
Decisiveness — the mean winner-minus-runner-up over the field's standard
deviation — is **0.973**, so boundaries are sharp rather than marginal. The first
and third rows together are also the *speed* of the picture: 2.946 crossings a
period over 66 × 0.1013 = 6.69 boundaries per lattice length is **0.441 lattice
lengths per period**, which is the constant the renderer turns into an on-screen
speed when deciding whether the shutter below is worth paying for.

## 6. Temporal anti-aliasing: the shutter

A display holds each frame for a whole frame interval, but a drawn frame is one
instant. When something crosses several pixels between one frame and the next,
that arrives as a row of hard steps instead of a smear — sample-and-hold judder,
which is what "jumpiness when things are moving fast" looks like. The
one-pixel-wide spatial antialiasing (`fwidth`) cannot cover it.

So each displayed frame is **integrated over a shutter**: `TAA_LAYERS = 3`
equally spaced sub-samples filling `SHUTTER = 0.3` of a frame interval centred on
the frame's own instant (`?shutter=1` is the full box filter, `?shutter=0.5` the
180° film convention). Each sub-sample carries **its own phase and its own
view** — the phase in its own layer of one `TEXTURE_2D_ARRAY`, the view (centre,
scale and turn) interpolated across the same three instants from the step the
view actually took since the last frame — so the animation, a drag, a glide, a
pinch and a two-finger turn are all integrated by the same three taps. The
fragment shader averages the **colours** of the sub-samples, never the field:
averaging the field would leave one hard boundary, only displaced, while
averaging the colours carries the boundary across every pixel it swept, which is
what a camera records. The node test proves that distinction pixel by pixel.

Four properties make it safe here:

- **The symmetry is untouched.** Every sub-sample runs the identical kernel, so
  *both* laws hold per sub-sample, exactly. The shutter blends three pictures
  each of which obeys them.
- **A still picture is bit-identical to one drawn without it**, so `?taa=0`,
  `?taa=3` and `?taa=5` give the same paused frame to the last bit — which is
  what lets the pixel comparisons in the browser test be exact.
- **It is spent only where it can do something.** The gate is on the *smear* the
  shutter would draw, not on the travel: a picture moving `travel` CSS px a frame
  is smeared over `travel × SHUTTER` of them, and under `MOTION_PIXELS = 0.75` px
  of smear there is nothing worth three taps. At the shipped 0.3 shutter that
  asks for **2.5 CSS px of travel a frame** — which the pattern's own boundaries
  reach at about **2730 CSS px per lattice length** (1575 px per motif), and
  `?shutter=1` brings forward to 818 px per lattice length, its value on the
  sibling pages before the shutter was narrowed. At the home framing the pattern
  moves 0.60 px a frame, so **the home view pays nothing** — and at ordinary
  framings what engages the shutter is the *view's* motion: a drag, a glide, a
  pinch, the moment it passes 2.5 px a frame. Press **S** and the overlay says
  which is in force.
- **Frame rate is never traded for it.** The shutter is the governor's *first*
  rung, above the resolution ladder: a GPU that cannot hold the cadence loses the
  motion blur first and pixels only if that was not enough, with a retry wait that
  doubles each time so that it settles instead of flickering. The node test runs
  that simulation over five simulated minutes.

Measured in the browser test: two consecutive displayed frames with the view
panning 12 CSS px between them make a full colour flip on **7.37 %** of pixels
without the shutter and **2.67 %** with it.

| parameter | meaning |
| --- | --- |
| `?taa=0` or `?taa=1` | shutter off — the un-integrated picture the pixel comparisons need |
| `?taa=2…5` | sub-samples per displayed frame (default 3; 5 is a soft ceiling) |
| `?shutter=0…2` | the shutter's width as a share of a frame interval (default 0.3; `0.5` is the film convention, `1` the full box filter; `0` collapses it to one sub-sample, so it draws *and costs* exactly what `?taa=1` does) |
| `?motion=…` | how wide the smear must be, in CSS pixels, before the shutter is worth paying for — so the picture must move `motion / shutter` px a frame, 2.5 px at the defaults (default 0.75; `0` keeps it on whenever anything moves at all) |

Press **S** and the stats overlay reads, for example,
`60 fps · 2880×1800 px · quality 1.00 · 3000 px per repeat · 81 taps · display 60 Hz · shutter 3×0.30 frame`
— or, at the home framing where nothing needs integrating,
`… · 658 px per repeat · 27 taps · display 60 Hz · shutter off (of 3)`. The taps
count is per pixel and includes the shutter, so it is the honest measure of what
a frame costs.

## 7. Framing and controls

The home view puts the **lattice origin** at the screen centre — a threefold
centre of the wave, a threefold centre of the picture, *and* the half-turn centre
of the entangled law. `scale` counts CSS pixels per lattice length of the coarse
lattice `L`, as on every sibling page, but what the eye reads as the motif is the
*finer* lattice `L′`, which is `1/√3` as long: the home framing is
**380 · √3 ≈ 658 CSS pixels per lattice length**, so one motif measures the same
380 px the siblings use. Screens whose shorter side is under 760 CSS pixels keep
two motifs across that side instead. The loop takes eight seconds and begins at
phase 0; screens with reduced motion enabled start paused.

The pattern is endless: drag it with a finger or the mouse. Two fingers pan, zoom
and turn it at once about their midpoint, and a turn that ends within 4° of **a
sixth of a turn** snaps to it — and here a sixth is the picture's own symmetry
and not merely the lattice's, since all six rotations about the origin are
symmetries, three keeping the colours and three swapping a pair. Zooming out
stops where one node of the 66-node lattice spans one device pixel; zooming in
stops at 8000 CSS pixels per lattice length.

### Momentum

**Everything a gesture can move keeps moving when you let go**, not just the
pan: throw a pinch and the picture goes on growing for a moment, throw a turn and
it goes on turning, and a two-finger gesture that did all three carries on doing
all three as one glide. `momentum.mjs` holds the whole of it, with no DOM, no
clock and no animation frame in it, which is what lets the node test check the
behaviour rather than the wiring.

The release velocity is the mean over the gesture's **last 100 ms** — first
sample to last, divided by the time from the first sample to the release, so that
a hesitation before letting go damps the throw. Then each of the three channels
is floored and capped on its own:

| | decay τ | thrown above | never above | so a glide adds at most |
| --- | --- | --- | --- | --- |
| pan | 0.35 s | 60 px/s | 6000 px/s | 2100 CSS px |
| zoom | 0.22 s | ×1.35 a second | ×6 a second | **×1.49** |
| turn | 0.25 s | 17°/s | 200°/s | **50°** |

The pan's numbers are the ones the sibling pages always had, to the last digit —
a node test asserts the one-finger fling is *bit-identical* to the code that
shipped before momentum, velocity and displacement, on every frame of the glide.
The zoom is integrated **multiplicatively** — a glide adds a *factor*, so it
feels the same at every framing — and the turn is measured the short way round
the circle, so two fingers crossing the atan2 seam do not read as a whole turn a
frame.

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
in the browser test: a glide into the 8000 ceiling peaks at 8317 px per lattice
length, 4.0 % past, and comes to rest at exactly 8000 — and so does the same
glide interrupted at its peak, and the same at the floor.

**A thrown turn is aimed at a sixth of a turn.** When the glide starts, the angle
it is heading for is worked out — `angle + rate × τ` — and the nearest sixth to
*that* becomes the target, reached by moving the decay's own asymptote onto it,
so the turn eases onto the sixth with the same exponential rather than being
corrected at the end. Two guards keep it honest: the correction is never more
than half a sixth (30°, the most it could ever be) and never more than the throw
itself, so a small nudge is left exactly where it was thrown, and the target is
never a sixth *behind* where the fingers let go. A turn that is not caught — a
short flick between two sixths — still eases onto a sixth if it happens to stop
within 4° of one, over 130 ms, which is the snap the fingers get. All six
rotations are symmetries of this picture, so a flick landing on one is the page
agreeing with itself.

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
rotation zeroed, and a rotate event carrying a rotation with a neutral scale.
Applying both fields of every event lets the two streams cancel — a pinch that
keeps snapping back to no turn, and a turn that keeps snapping back to no zoom —
which is why they only ever worked one at a time. This viewer keeps **two
independent accumulators**, taking each quantity only from an event that actually
carries it, and pins the view with both every time.

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
  away and collapse the view mid-gesture. The `gestureend` event is treated the
  same way, so a gesture that ends neutral cannot jump the view home as the
  fingers lift.

iPhone and iPad are untouched: the handler bails out while any pointer is down,
so the two-finger pointer path keeps doing pan, zoom and turn together.

Two fallbacks for a mouse, or a trackpad whose rotate gesture never arrives:
**Option (Alt) + wheel turns** about the pointer while the wheel alone zooms, and
the turn and zoom keys **repeat while held** (3° and 1.05× a repeat, against 15°
and 1.25× for a single press), so one hand can hold `]` while the other pinches.
Every control that moves the view re-bases a trackpad gesture in progress, and
restarts the sample history the release velocity is read from, so a key press
mid-gesture is not mistaken for 900°/s of finger.

**The diagnostic.** Once a gesture has happened, the stats overlay (press **S**)
gains, for example:

    · gesture raw 1.000/30.000 · flat 2s 2r both 0 of 4 · kept 1.400×/30.0°

`raw` is the last event's own `scale`/`rotation` (`—` for a non-finite field);
`flat Ns Mr` counts the events since `gesturestart` that named no scale and no
rotation, `both K` those that named both, out of the total; `held K` appears when
an ambiguous event had to be kept out; `kept` is where the two accumulators
stand. `flat 2s 2r both 0 of 4` is the split Mac stream; `flat 0s 1r both 3 of 4`
is a Safari that accumulates both. **That line is what to read off after one
pinch-and-turn on a real Mac.**

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
`?dpr=` and `?stats=1` behave as on `../gyre/`, alongside `?taa=`, `?shutter=`
and `?motion=` above; a finite value outside the allowed range is clamped to the
nearest one it may take, so a hand-edited link still does what it asks for.
Controls and cursor hide after inactivity; GPU context restoration resumes the
pattern; hidden tabs suspend rendering. Inside a frame that is not allowed to go
fullscreen, the button instead reads "Open full page" and opens the viewer in its
own tab.

Three share links worth knowing, each of which the browser test asserts against
the home frame:

- `?angle=180&phase=0.5` — the home frame with teal and sand exchanged. **Pixel
  for pixel**, at any framing and with any filter: a half-turn permutes the pixel
  grid exactly and the kernel is even in each coordinate, so nothing is resampled.
- `?x=0.3333333333333333&y=0.6666666666666666` — the home frame with every colour
  stepped back one place, with no time shift at all. **Pixel for pixel** too, for
  the same reason: `b` is a whole number of nodes.
- `?angle=120&phase=0.6666666666666666` — the home frame, colours and all. This
  one is exact **on the nodes** and off by `1.8 × 10⁻⁴` between them (§5), so the
  test asserts it on every pixel the page draws without antialiasing *at the home
  framing*, where the difference hides inside the antialiased band. Zoom to the
  top of the range and a few hundred boundary pixels of the two do differ.

## 8. Social assets

Twitter/X sharing uses `social-preview.jpg` (1200 × 630) with large-summary and
Open Graph metadata, rendered straight from the WebGL viewer at
`?play=0&phase=0.31&scale=572` with the controls hidden.

## 9. Validation

From the repository root (Node 20+), with the static server serving `docs/`:

```sh
node --test docs/scott-gray/tests/trefoil.test.mjs
node docs/scott-gray/tests/trefoil.browser.mjs http://localhost:8934/scott-gray/trefoil/
BROWSER=webkit node docs/scott-gray/tests/trefoil.browser.mjs http://localhost:8934/scott-gray/trefoil/
node docs/scott-gray/tests/trefoil.browser.mjs https://trefoil-wave.pages.dev/ live
```

The **node test** (34 tests, about seven seconds) works on the saved samples in
exact integer arithmetic: the field's SHA-256 and byte identity with the atlas
orbit and with both sibling pages; the field's own sixfold screw, bit-exact; that
`b` is a whole (22, 44) nodes, that `3b ∈ L`, that `|b| = 1/√3` and how each turn
moves `b` modulo `L`; that `b = (1/3, 2/3)` is the only index-3 offset `R₁₂₀`
fixes; **both laws at all 418 176 node-frames with 0 violations and 0 ties**; all
six relabellings of the entangled law (1, three thirds and two zeros); 0.494447
for each half alone with the full six-relabelling rows; the pure time shifts;
that the 3-cycle is realised with no time shift at all; the **exhaustive
30 108 672-combination brute-force search** finding exactly the 18 symmetries
listed above, realising all six colour permutations, with the colour-preserving
subgroup `{1 @ 0, R₂₄₀ @ T/3, R₁₂₀ @ 2T/3}` and no mirror; the **independent
Fourier search** finding the same 18 and, with them, **0.540375** for a
transposition without a genuine time shift (the theorem, measured), 0.477531 for
the mirrors, 0.898703 half a node off the centre and 0.969310 one frame off,
spot-checked against the direct count; exactly 139 392 node-frames per colour and
exactly 1/3 in **every** frame; the colour at the origin over 48 phases; both
laws off the nodes through the CPU reconstruction (`10⁻¹⁵`) and the threefold
law's `1.8 × 10⁻⁴`; the texture as one instant per node, and that half a period
turns it over bit-exactly; the picture's boundary density, lone nodes, changes
per node, decisiveness and disagreement with both siblings' colourings, on the
lattice's own edges; the governor giving up the shutter before the resolution and
settling rather than oscillating; the shutter's sub-samples and thresholds; the
home framing; and the whole of the momentum module — the window, the floors, the
caps and the guards, the bit-identical one-finger fling, a glide worth rate × τ
that is the same however the frames fall, the scale-invariant zoom, the elastic
that never passes the give and ends on the limit exactly, the turn easing onto a
sixth only from inside the 4° tolerance, and the aiming of a thrown turn — that
it lands on a sixth, that a nudge smaller than the correction is left where it
was thrown, and that nothing is ever pulled back to a sixth behind the fingers.

The **browser test** (Chromium and WebKit, local and live) checks the rendered
pixels. The headline: **the frame at T/2, turned half a turn about the screen
centre with teal and sand exchanged, equals the home frame at agreement
`1.000000` — exactly, with nothing resampled**, since a half turn permutes the
pixel grid. So does `?angle=180&phase=0.5` against the home frame, and so does
the free 3-cycle: `?x=1/3&y=2/3` is the home frame with every colour stepped back
one. As *negative* tests, which matter as much: the half-turn alone (≤ 55 %), half
a period alone (≤ 56 %), the two together without the swap, the two together with
either other swap (0 %), and the turn and the swap without the wait (< 5 %). Then
the threefold and sixfold laws pixel for pixel at the home framing — those two
are exact on the nodes and `1.8 × 10⁻⁴` off between them, unlike the two laws
above, which are exact at every framing — the triple junction at the
half-turn centre, the three colour areas within a percent of a third, and the
shader's output against an **independent CPU reconstruction** of the rule —
mapping each device pixel back through the screen → plane → lattice chain at
three framings, about 200 000 pixels, all agreeing. That last check has teeth
where the symmetry checks do not, since a systematic error is itself symmetric.
The **no-float-filter fallback** — sixteen point fetches per position, for a GPU
without `OES_texture_float_linear` — is run explicitly with the extension hidden:
48 taps instead of 27, and not one pixel of 60 000 differs by more than 8/255.
The same rendered frames were also compared against the standalone numpy
reference implementation used to design the rule: agreement **1.000000** over
282 749 and 281 841 pixels at two phases.

Beyond that: retina rendering, fixed scale, seamless tiling, the mobile layout,
drag panning with inertia, wheel and pinch zoom, the two-finger turn snapping to
60°, the four Safari gesture-event patterns each ending at 1.4× **and** 30°, the
neutral returns and the two *combined* returns through neutral that used to
collapse the view, the diagnostics, the Mac key and Option-wheel fallbacks, the
shutter (still frames identical with `?taa=0/3/5`, a moving frame equal to the
mean of its sub-samples, the gate leaving the home framing alone, still off at
2400 px per repeat and on at 3000 with the shipped 0.3 shutter, and engaging at
2400 with `?shutter=1` — the full box filter, whose 0.75 px of travel the
narrower default reaches only at 2730 — `?shutter=0` costing one layer, the
governor dropping the shutter before the resolution, and a 12 px-a-frame pan
whose colour flips fall from 7.4 % to 2.7 % of the screen), the momentum (a
thrown pinch still growing three frames after the release and settled inside the
limits within a second; the same pinch dispatched in one instant, and one
released after a pause, throwing nothing; a thrown turn coming to rest **on a
sixth**; the elastic at the ceiling, and a glide interrupted in the middle of its
excursion — at the ceiling and at the floor — still resting on the limit exactly;
a tap stopping the glide where it is; a wheel burst adding a fifth and one notch
adding nothing; the Mac trackpad throwing its pinch, its turn and both
interleaved, and throwing nothing when the stream stopped before it ended;
reduced motion throwing nothing at all; and the one-finger pan fling unchanged), reset, stats, pause/play, idle controls, GPU
recovery and reduced motion.

One gap is not closed by either test: headless WebKit cannot construct a real
`GestureEvent`, so the trackpad path — including its momentum, which the browser
test now drives with 16 ms between the events, as a trackpad does — is exercised
with synthetic events carrying the same fields (the test reports which it got). Only a manual pass in Safari on
a Mac trackpad covers the real thing — which is what the **S** diagnostic above
is for.

The browser check requires Playwright with Chrome installed; `BROWSER=webkit`
runs the same checks in Playwright's WebKit (Safari's engine). Set
`PLAYWRIGHT_MODULE` and `PNGJS_MODULE` if those packages are outside the bundled
Codex runtime, and `SHOT_DIR` to choose where the screenshots land.

## 10. Deploy

```sh
export CLOUDFLARE_ACCOUNT_ID=e1e1985643cc8491f400c94ffc9f399a
npx wrangler@latest pages deploy docs/scott-gray/trefoil --project-name trefoil-wave --branch main --commit-dirty=true
npx --yes spacesheep deploy docs/scott-gray/trefoil --title Trefoil --slug trefoil --emoji 🍀 \
  --description "Three colours whose swaps need a turn and a wait" --visibility public -m v1 --json
```

Live at <https://trefoil-wave.pages.dev/> and
<https://spacesheep.dev/@yaroslavvb/trefoil>.

## 11. The name

The trefoil knot is the (2, 3) torus knot, whose knot group is the smallest one
that surjects onto **`S₃`** — and three-colourability of the trefoil is *the*
textbook first example of exactly this group acting on exactly three colours,
with the 3-cycle and the transposition doing different jobs. This page is that
fact, animated. Three leaves for the three colours, next to Triskele's threefold
spiral, does no harm either.
