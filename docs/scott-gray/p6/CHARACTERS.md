# Cyclic time characters of 632

`groups.json` copies the six forward cyclic colour actions, affine operations,
Chaim short forms, named generators, and generator glyph paths from the existing
[632 correspondence page](https://yaroslavvb.github.io/animated-groups-fable/correspondence-p6.html)
and `docs/data/clockwork-coloring-correspondence.json`. The data is a group
specification, not evidence that a Gray–Scott solution exists.

| ID | Chaim short form | α: +60° | β: +120° | γ: 180° | Fixed-phase kernel |
| --- | --- | --- | --- | --- | --- |
| g243 | 632 | 0 | 0 | 0 | p6 / 632 |
| g244 | ³6³3¹2 | +T/3 | +2T/3 | 0 | p2 / 2222 |
| g245 | ³6³3¹2 | +2T/3 | +T/3 | 0 | p2 / 2222 |
| g246 | ²6¹3²2 | +T/2 | 0 | +T/2 | p3 / 333 |
| g247 | ⁶6³3²2 | +5T/6 | +2T/3 | +T/2 | p1 / ◦ |
| g248 | ⁶6³3²2 | +T/6 | +T/3 | +T/2 | p1 / ◦ |

The superscripts give **orders of colour permutations**, not their directed
phase increments. Thus g244/g245 and g247/g248 share short forms, but require
different time shifts. The C6 short forms are the correspondence's explicitly
labelled extension of Chaim's rule; the book does not enumerate those composite
colourings. g243 has no nonzero time offset.

## Coordinates and exact action

Use lattice coordinates ξ=(ξ₁,ξ₂), modulo integer translations. Physical points
are X=L(ξ₁−ξ₂/2, √3 ξ₂/2). The basis vectors have angle 120°, as on the source
page. In these coordinates a positive mathematical 60° rotation is

```
R = [[1, -1], [1, 0]],       R⁶ = I.
```

Every array operation in `render.ops` means

```
z(M ξ + v, t + τ T) = z(ξ, t),    z=(u,v),    τ modulo 1.
```

The operations use the original source ordering. A generator's
`operationIndex` identifies its representative; its `translation` also includes
the source plate's integer lattice shift. Named centres in `centre` are lattice
coordinates, while `cartesianCentre` records the source plate's Cartesian
coordinates in units of L:

| Generator | Matrix | Lattice translation | Lattice centre |
| --- | --- | --- | --- |
| α | R | (0,0) | (0,0) |
| β | R² | (−1,−1) | (−1/3,−2/3) |
| γ | R³=−I | (−1,−1) | (−1/2,−1/2) |

Applying α, then β, then γ gives the identity; each generator's own order also
gives the identity. In conventional function notation this is γ∘β∘α=I. The
source's presentation writes the applied sequence as αβγ=1. Composition in the
opposite convention can differ by a full lattice translation, which is the
identity on the periodic torus. Integer translations carry zero time shift.
Do not substitute source `cell_action_presentation`'s opposite-oriented
60° representative for Chaim's named α without also reversing its phase shift.

## Why there are six compatible characters

Write the wallpaper group as Z²⋊C6. A time character maps composition to
addition in R/Z. Conjugation by R must fix the translation character, so it
annihilates (R−I)Z². Since det(R−I)=1, it annihilates **all** translations.
The remaining generator has order six, so χ(R)=j/6 for j=0,…,5. These are exactly
the six rows above: no centred or phase-shifted translations are missing.

All six are algebraically compatible with an isotropic autonomous
reaction–diffusion equation. There is no time reversal. This compatibility
does not prove existence at any particular F, k, Du, Dv, or L. A failed search
does not prove impossibility. At a spatial point fixed by an operation, its
local trace must have the corresponding shorter temporal period; elsewhere the
orbit may retain its full period T.

For an explicit nonzero function with any character, choose a nonzero lattice
wave vector k and sum the six rotated modes

```
Σ[j=0…5] cos(2π (((Rᵀ)ʲ k)·ξ + t/T + j χ(R))).
```

It satisfies the character exactly but generally does **not** solve Gray–Scott.
It is a symmetry-compatible search seed, never a certified atlas entry.

## Triangular diffusion and sampling

An N×N array still represents a rhombic periodic domain, not a square physical
domain. With h=L/N the isotropic six-neighbour discretization is

```
Δh z[i,j] = 2/(3h²) * (
  z[i+1,j] + z[i-1,j] + z[i,j+1] + z[i,j-1]
  + z[i+1,j+1] + z[i-1,j-1] - 6*z[i,j]
).
```

The neighbour set is invariant under R. The continuum operator in lattice
coordinates is 4/(3L²)(∂₁₁+∂₁₂+∂₂₂); its Fourier eigenvalue is
−16π²/(3L²)(k₁²+k₁k₂+k₂²). A square five-point or nine-point Laplacian would
implement a different physical equation and break this rotational symmetry.
Integer spatial matrices act exactly on every N; choose a temporal frame count
divisible by six to make all six time shifts exact array permutations.

Numerical admission must independently check the actual triangular-domain PDE,
periodic closure under forward integration, every canonical space–time
operation, meaningful spatial and temporal variation, and a genuine effect for
each required nonzero offset. Constant, stationary, or falsely lengthened
periods must not fill the nontrivial groups. Cached metadata can only represent
the outcome of those offline checks on the exact saved field bytes.

Run the group specification checks from the repository root:

```
node --test docs/scott-gray/p6/tests/characters.test.mjs
```
