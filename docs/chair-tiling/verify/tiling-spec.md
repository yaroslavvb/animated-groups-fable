# The marked 3-D chair: a computer-checked reconstruction of CGS's construction

Working code: this directory (`verify/`, pure python3, no dependencies).
Machine-readable output: `verify/marking.json`.
Full log of one complete run: `verify/runall.log`.

> **One-line summary.** The three-arrow marking that Chaim Goodman-Strauss drew
> on 2026-09-17 can be pinned down exactly. Completed by the two properties he
> stated out loud, it is the **unique** marking (out of 1 679 616 candidates) that
> matches every symbol readable in the photograph; its contact atlas is
> **literally identical** to Tsiokos's certified 44-contact atlas `A44`, its
> three symbols correspond **panel for panel** to Tsiokos's three D4 motif classes,
> and it reproduces his census numbers 2388 → 44, 22, 33, 30 exactly.

> **Chirality — correction of 2026-09-17.** The marked tile is *chiral*: a
> marking and its mirror image are different objects and no rotation carries one
> to the other, so the drawing, and only the drawing, says which one CGS meant.
> The first transcription of the photograph interchanged `x` and `y`, and the
> first version of this document therefore named the **mirror image** of the
> right answer. The evidence tables in `classes.py` have been re-read against the
> axes CGS wrote on the photograph himself — **`+x` to the lower left, `+y` to
> the right**, `z` upright — and `M24` below is the corrected marking. Every
> structural statement in this document survived the correction unchanged: the
> mirror satisfies (a), (b) and (c) too, has the same 44/16 contact atlas and the
> same panel correspondence, and the two are separated by the drawing alone. What
> changed is which of the two is drawn, plus the `F`/`H` labels of §2.1, §6 and
> §7.1. The cleanest single item of evidence is the notch of the single-tile
> figure: the **open purple V is on the screen-left wall (`+y`)** and the **solid
> head on the screen-right wall (`+x`)**.

---

## 0. What is claimed, and what is not

**Verified by computation** (every number below is produced by a script in
`spec/`, re-runnable with `./runall.sh`):

| | claim | status |
|---|---|---|
| (a) | substitution consistency at levels 1, 2, 3 | **holds**, 0 violations in 12 000 contacts |
| (b) | self-similarity: the supertile read at double scale reproduces the marking | **holds exactly**, levels 1 and 2 |
| (c) | dent/back complementarity ("shift the tile forward") | **holds**, and is what forces the three marks the drawing omits |
| (d) | forcing | **partial** — the local grouping theorem is proved exhaustively (§7); the induction to aperiodicity is *not* |

**Not claimed.** I have **not** proved that the marked tile is aperiodic. §7.5
states precisely which finite steps are done and which are missing. The marking
also does **not** by itself exclude reflected copies; that has to be imposed by
fiat (§8.2), whereas in Tsiokos's bumps-and-dents realization it is a theorem.

Everything is at the level of **registered** placements: integer translations and
cubic frames. Tsiokos *proves* registration from the pyramid geometry; here it is
an assumption (§8.1).

---

## 1. Conventions

* An integer triple `c` denotes the closed unit cube `[c, c+1]`.
* **The chair** is
  `C = [0,2]³ \ [1,2]³`, the 7 cells `K = {0,1}³ \ {(1,1,1)}`.
  This is exactly Tsiokos's carrier `P` and exactly the `n = 3` case of
  Goodman-Strauss's n-dimensional L-tile (1999).
  * **far corner** `F = (0,0,0)` — the corner of the bounding cube diagonally
    opposite the notch;
  * **notch cell** `[1,2]³`; **concave corner** `N = (1,1,1)`.
* **Facets.** `∂C` is 24 unit squares. A facet is written `(c, d)` with `c ∈ K`,
  `d` a unit axis vector and `c + d ∉ K`. Of the 24, **21 are outer**
  (`4+4+4+3+3+3` over the six outer faces: three full 2×2 "back" faces and three
  L-faces of three unit squares) and **3 are notch facets** (those with
  `c + d = (1,1,1)`).
* **Sites.** Each facet is assigned one of its four corners:

  ```
  site(c,d) = (1,1,1)   if c + d = (1,1,1)     (the three notch facets)
            = 2·c       otherwise
  ```

  There are exactly **8 sites** and exactly **3 facets at each**. The 8 sites are
  the seven corners `2a` (`a ∈ K`) of the bounding cube other than `(2,2,2)`,
  together with the concave corner `(1,1,1)`. This is the combinatorial heart of
  the whole construction: *the 8 sites are in bijection with the 8 children of
  the substitution.*
* **Poses.** `(L, t)` with `L` a signed permutation, `(L v)_i = s_i v_{p_i}`,
  and `t ∈ Z³`. The 48 signed permutations split 24 proper / 24 improper.
  The bare chair has symmetry group `S₃` of order 6 (the three coordinate
  permutations and their products), of which 3 are proper.

**Reflections.** Goodman-Strauss 1999 allows all 48 (his L-tile has `2ⁿ = 8`
distinct orientations because the shape is `S₃`-symmetric). Tsiokos allows
reflections in the hypotheses and *proves* every tiling homochiral (0 improper
contacts in `A44`). Here we **restrict to the 24 proper frames by fiat**;
§8.2 measures exactly what that costs.

---

## 2. The marking M

Each of the 24 facets carries **exactly one mark**, drawn in the quarter of the
facet at its site and pointing at that site. A mark has one of three types:

| symbol | CGS's drawing | plain name |
|---|---|---|
| **F** | solid filled triangular arrowhead, purple | *full purple* |
| **H** | open hook / two-stroke V, purple | *empty purple* |
| **B** | pale-blue arrow | *blue* |

Because exactly three facets meet at each site, the marking is 8 **stars**, one
per site, and (this is CGS's "every single corner has this arrangement of
markings at it") **each star is a bijection `{x,y,z} → {F,H,B}`**.

### 2.1 The table

`M24`, the reconstruction. Rows are the 8 sites; the entry in column *i* is the
symbol on the facet at that site whose outward normal is along axis *i*.

| site key | site (vertex) | facet ⊥ x | facet ⊥ y | facet ⊥ z | what it is |
|---|---|---|---|---|---|
| `000` | (0,0,0) | **H** | **F** | **B** | the far corner — *not drawn in the photograph* (§3) |
| `100` | (2,0,0) | **B** | **F** | **H** | equatorial corner |
| `010` | (0,2,0) | **H** | **B** | **F** | equatorial corner |
| `001` | (0,0,2) | **F** | **H** | **B** | equatorial corner |
| `110` | (2,2,0) | **H** | **F** | **B** | equatorial corner |
| `101` | (2,0,2) | **F** | **B** | **H** | equatorial corner |
| `011` | (0,2,2) | **B** | **H** | **F** | equatorial corner |
| `dent` | (1,1,1) | **F** | **H** | **B** | the concave corner |

Census: **8 F, 8 H, 8 B**.
Symmetry group of (chair + marking): **trivial** (order 1), against order 6 for
the bare chair — verified by exhaustive search over all 48 frames.

The full facet-by-facet table (24 rows: cell, outward normal, kind, symbol, site)
is printed by `verify.py` step 0 and is in `marking.json` under `facets`.

### 2.2 How it is drawn

Each mark is an arrow **along the diagonal of its own unit facet**, tail at the
corner opposite the site, head at the site. On a 2×2 back face this reproduces
CGS's drawing exactly: the quarters at the two "side" corners give one arrow each,
head at `S₁` and head at `S₂`, sharing a tail at the centre of the 2×2 face —
i.e. **one purple bar across the face diagonal with a solid head at one end and a
hollow head at the other**; and the quarter at `D` gives the **short blue arrow
pointing at `D`**. `marking.json` carries `arrow_tail` / `arrow_head` per facet.

### 2.3 The matching rule

> Two chairs may share a unit facet only if the two marks on that square
> **point at the same corner** and their types are **complementary**:
> `F ↔ H`, `B ↔ B`.

(`comp(F)=H, comp(H)=F, comp(B)=B`.) That is exactly CGS at 07:08:33 —
*"the two purple markings match, so you have to have the empty purple marking with
the full purple marking … and the blue marking matches itself."*

No other condition is imposed: no face-to-face hypothesis beyond registration, no
common-orientation hypothesis, no connectivity condition.

---

## 3. The one place the drawing is silent, and why the answer is forced

The photograph shows **21 marks**, not 24: on each 2×2 back face the quarter at
the far corner `F` is blank (it is where the big yellow dot is painted), and the
same for the three sub-chair back faces in the supertile drawing. Call that
literal reading **M21**.

**M21 cannot be right**, and the reason is one of CGS's own two spoken claims.
Run `python3 m21.py`:

```
M21: 21 marked facets, 3 blank (the three at the far corner (0,0,0))
  (c) translation by (1,1,1): legal=False (blank_ok=False), shared facets=1
  (c) translation by (1,1,1): legal=False (blank_ok=True),  shared facets=1
  (b) coarse read: 21 of the 24 parent marks are missing
```

* **(c)** *"if you took a tile and you shifted it forward, the markings would
  match"*: the copy `C + (1,1,1)` plugs the notch, and the three shared facets are
  precisely the notch walls of `C` against the three **far-corner** facets of the
  shifted copy. If those are blank there is nothing for the notch marks to meet.
  Matching them forces `star(dent) = comp(star(far))` entrywise — and
  `comp(H,F,B) = (F,H,B)`, which is exactly the notch triple the photograph shows
  most clearly.
* **(b)** *"when you make the bigger tile, the markings on the corners are
  necessarily the markings from the inside one in the middle"*: the parent's mark
  on a double-facet is read off the unit facet at the parent's own site corner.
  For the seven corner children that unit facet **is** a far-corner facet
  (7 × 3 = 21 of the 24 parent marks); only the remaining 3 come from the central
  child's notch walls. With M21 the coarse reading supplies 3 marks out of 24.

So the three far-corner marks are not optional decoration: they are 21 of the 24
marks the parent tile needs. CGS simply did not draw them (he also drew the
central child's notch rhombi empty in the supertile figure, for the same
clutter reason).

**M24 = M21 + the three far-corner marks**, and those three are determined up to
a cyclic relabelling by (c); the photograph's notch reading `(F, H, B)` — solid
on the `+x` wall, open V on `+y`, blue on `+z` — fixes the cycle. §6 shows this is the unique choice consistent with everything.

---

## 4. The substitution, and why the eight frames are forced

`S = [0,4]³ \ [2,4]³` is the chair at scale 2 and is partitioned by eight chairs:
seven "corner children", one in each octant of `[0,4]³` except `[2,4]³`, each the
octant minus the sub-cell nearest the centre; plus one **central child**
`[1,3]³ \ [2,3]³`, whose seven cells are exactly the seven holes.

Requiring only that the supertile, coarse-read, carries `M24` again **determines
all eight frames uniquely** (`child_frames()` in `chair.py` solves for them; it is
three linear conditions per child). The answer:

| slot | perm | signs | translation | det |
|---|---|---|---|---|
| `000` | (0,1,2) | (+,+,+) | (0,0,0) | +1 |
| `001` | (1,0,2) | (+,+,−) | (0,0,4) | +1 |
| `010` | (0,2,1) | (+,−,+) | (0,4,0) | +1 |
| `011` | (2,0,1) | (+,−,−) | (0,4,4) | +1 |
| `100` | (2,1,0) | (−,+,+) | (4,0,0) | +1 |
| `101` | (1,2,0) | (−,+,−) | (4,0,4) | +1 |
| `110` | (0,1,2) | (−,−,+) | (4,4,0) | +1 |
| `dent` | (0,1,2) | (+,+,+) | (1,1,1) | +1 |

**All eight are proper rotations** — that is an output of the computation, not an
input. (`child_frames` is run with `allow_improper=True`.) Slot `dent` coming out
as the pure translation by `(1,1,1)` is again CGS's "shift it forward".

This table is the `n = 3` case of Goodman-Strauss's `2ⁿ`-chair substitution and,
as a set of poses, agrees with Table 1 of Tsiokos v2 (p. 13) after the change of
frame recorded in `tiling-sources.md`.

---

## 5. Verification (a), (b), (c)

```
$ cd verify && python3 verify.py
```

**(a) substitution consistency** — every interior facet contact of the level-n
supertile satisfies the matching rule:

| level | chairs | cells | partition of 2ⁿ·C | directed interior contacts | violations |
|---|---|---|---|---|---|
| 1 | 8 | 56 | ✓ | 96 | **0** |
| 2 | 64 | 448 | ✓ | 1 152 | **0** |
| 3 | 512 | 3 584 | ✓ | 10 752 | **0** |

**(b) self-similarity of the exterior.** The precise coarse-graining statement:

> For each of the 24 facets `(c,d)` of the chair, let `v = site(c,d)` and
> `V = 2ⁿ·v`. Inside the level-n supertile, the unit facet with outward normal `d`
> that lies in the double-facet `(c,d)` and has `V` as a corner carries the
> symbol `M(c,d)`.

Verified at levels 1 and 2: the coarse reading equals `M24` **on all 24 facets**,
no mismatches. In particular the central child's notch star at `(2,2,2)` is
`{x:F, y:H, z:B}`, which is the parent's notch star — CGS's *"the markings on the
corners are necessarily the markings from the inside one in the middle."*

**(c) dent/back complementarity.** `C` and `C + (1,1,1)` are legal; they share
exactly 3 facets, and the three pairs are `F/H`, `B/B`, `H/F`, all at the corner
`(1,1,1)`. The notch cell is covered. The only two entries of the whole 44-contact
atlas with the identity frame are the translations by `±(1,1,1)`.

---

## 6. Is M24 the only possible marking? An exhaustive search

`python3 search.py` enumerates **all `6⁸ = 1 679 616`** ways of assigning a
bijection `{x,y,z} → {F,H,B}` to each of the 8 sites, and tests (a) + (b) + (c):

```
tested 1679616 markings, 18 satisfy (a)+(b)+(c) at level 1   (84.0 s)
of those, 18 also satisfy (a)+(b) at level 2
of those, 12 have all eight child frames orientation-preserving
equivalence classes under (6 chair symmetries) x (6 symbol relabellings): 3, sizes 6/6/6
M24 is among the solutions: True
```

`python3 classes.py` then scores each of the 18 against **33 individual symbols
read off the photograph** (the 18 purple heads and 9 blue arrows of the nine 2×2
rhombi in the supertile drawing, plus the 3 notch marks and the 3 `z=2` L-face
marks of the single-tile drawing — the items tabulated in `tiling-sketch.md`
§2.2, §3.1 and §3.2), each weighted 3/2/1 by the sketch agent's stated confidence:

| # | proper frames | proper atlas | improper atlas | `== A44` | sketch agreement |
|---|---|---|---|---|---|
| **7 = M24** | yes | **44** | 16 | **yes** | **33/33 (89/89)** |
| 3 | yes | 44 | 16 | no | 30/33 (80/89) |
| 15 | yes | 44 | 16 | no | 30/33 (80/89) |
| 1 | yes | 44 | 16 | **yes** | 11/33 (33/89) |
| 11, 12 | yes | 44 | 16 | no | 11/33 (33/89) |
| 2,5,6,9,14,16 | yes | 62 | 48 | no | ≤ 13/33 |
| 0,4,8,10,13,17 | **no** | 40 | 40 | no | ≤ 13/33 |

* **`M24` is the unique solution that agrees with every readable symbol**, where
  *solution* means one of these 18. Agreement with the drawing was never
  evaluated on the other 1 679 598 markings; they were eliminated by (a)+(b)+(c),
  not by the photograph.
* Solutions 3 and 15 differ from `M24` **only** in the far-corner star and the
  notch star, by a cyclic relabelling — they are exactly the freedom that §3 left
  open, and the photograph's notch reading `(F, H, B)` (the largest and cleanest
  marks in the whole image) removes it. They are the 3 points of the 33.
* **Solution 1 is the mirror image of `M24`.** It reproduces `A44` and satisfies
  everything in §5 and §7, and the drawing's chirality is the only thing that
  separates them — which is why the axis labels CGS wrote on the photograph
  matter. Solution 1 is what the first version of this document called `M24`;
  see the correction note at the head of the file.
* Six of the 18 need **improper** child frames and are discarded on that ground
  alone (GS 1999 and Tsiokos both use proper ones).

---

## 7. (d) Forcing

### 7.1 The contact atlas, and the identity with Tsiokos

```
$ python3 verify.py      # step 6
legal neighbour poses (48 frames, |t| <= 4): 60
  proper (rotation) neighbours   : 44
  improper (reflected) neighbours: 16
  neighbours with the IDENTITY frame: (-1,-1,-1) and (1,1,1)
```

Over all 48 signed frames with `|t| ≤ 4` there are **2 388** ways a second *bare*
chair can sit face-adjacent to a given one without overlapping — 1 194 of them in
a proper frame and 1 194 reflected. (2 388 is also Tsiokos's own denominator;
`verify.py` does not print it, and it is recomputed in one line from `chair.py`.)

**Theorem A (exhaustive).** Of the **1 194** proper face-adjacent placements,
**exactly 44 satisfy the matching rule**; over all 2 388 placements in all 48
frames, exactly **60** do (44 proper, 16 reflected). And

> **that set of 44 poses is *identical*, pose for pose, to the 44-pose contact
> atlas `A44` reported for Tsiokos's `Chair44`** (checked against
> `tiling-matching-system.json → contact_atlas_A44.contacts`, shipped beside
> these scripts).

2 388 and 44 are also Tsiokos's own two numbers. `python3 panelmap.py` goes
further and maps his 24 panel IDs onto our 24 facets:

```
cross-tabulation Tsiokos class x our symbol: {('A','H'): 8, ('B','F'): 8, ('C','B'): 8}
the two 3-class partitions coincide exactly: True
```

So CGS's claim that the 21/24-panel bump-and-dent alphabet "reduces to just these
markings" is **literally true**: his *empty purple* is Tsiokos's motif class A
(all bumps, magnitudes 1–8), his *full purple* is class B (all dents), his *blue*
is class C (magnitudes 9–12, mixed polarity, self-complementary under the panel
diagonal). Which of `F` and `H` goes with which of A and B is exactly what the
chirality correction swapped; that the two 3-class partitions coincide at all is
the substantive statement, and it is unaffected.

Both comparisons are against `tiling-matching-system.json`, a transcription of
the Zenodo paper made for this reconstruction — not against the paper itself. The
44 poses were checked against that file and against an independent recomputation
from `chair.py`; the last link, from the file to Tsiokos's text, is a reading.

### 7.2 The first shell

```
$ python3 force.py
shell cells (face-adjacent, outside): 22
complete legal first shells: 33          (49 if reflected copies are allowed)
```

22 and 33 are again Tsiokos's numbers (his "22 shell cells" and "33 first shells").

### 7.3 The notch filler

**Theorem B (exhaustive).** Exactly **7** of the 44 atlas poses cover the notch
cell `(1,1,1)`, and they are **precisely** the seven relative poses
`child_a⁻¹ ∘ central` of the substitution, one for each slot `a ∈ K`:

| relative pose of the notch filler | slot |
|---|---|
| `((0,1,2),(+,+,+)), (1,1,1)` | `000` |
| `((2,1,0),(+,+,−)), (1,1,3)` | `100` |
| `((0,2,1),(+,+,−)), (1,1,3)` | `010` |
| `((1,0,2),(+,+,−)), (1,1,3)` | `001` |
| `((0,1,2),(−,−,+)), (3,3,1)` | `110` |
| `((2,0,1),(−,−,+)), (3,3,1)` | `101` |
| `((1,2,0),(−,−,+)), (3,3,1)` | `011` |

(The bare shape allows 60 notch fillers; the marking cuts that to 7.)

**Corollary (consistency is automatic).** The supertile in which `Y` is the
central child is a function of `Y`'s pose alone:
`S = (L_Y, t_Y − L_Y(1,1,1))`. Hence **any two chairs with the same notch filler
are assigned the same parent, in the same slot, with no further checking.**
Tsiokos's "28 pairs of competing groups" census and yamaton's `parent_map_unique`
are, in the arrow formulation, a triviality.

### 7.4 The grouping theorem

For a chair `X` write `ν(X)` for the chair covering its notch cell and
`pre(X) = {Z : ν(Z) = X}`. Both are read off `X`'s first shell.

**Theorem C (exhaustive, `force3.py`).** Over all **33** complete legal first
shells, `|pre(X)| ∈ {0, 1, 7}` — never 2…6:

| chairs in the shell | slot of ν(X) | \|pre(X)\| | number of shells |
|---|---|---|---|
| 7 | each of the 7 slots | 0 | 16 |
| 8 | each of the 7 slots | 1 | 16 |
| 8 | `000` | **7** | **1** |

and **in that one shell `{X} ∪ pre(X)` is exactly an 8-chair supertile**, with `X`
central. Call `X` a *centre* when `|pre(X)| = 7`; the criterion is decidable from
the first shell alone.

**Check on the substitution tiling (`force2.py`).** On the level-4 supertile
(4 096 chairs) the ν-preimage histogram is

```
0 -> 3073,  1 -> 511,  7 -> 512
{chairs with 7 preimages} == {the 512 central children}:  True
```

512 = the number of level-1 supertiles in the patch; every centre is found and
nothing else is.

**Theorem D (exhaustive, `force4.py`) — the coarsening identity.** The level-1
supertile is itself a marked chair at scale 2 (§5b). Enumerating **every** pose of
a second supertile that is legal at the *fine* level (8 + 8 chairs, all 64 pairs
checked):

```
legal supertile neighbours: 44
   with ODD translation: 0
   halved poses: 44 distinct
   halved atlas == A44 : True
```

i.e. **`½ · (supertile atlas) = A44`** — the exact analogue of Tsiokos's
"decisive finite identity" `½(admitted parent atlas) = A44` (v2 §3.2, p. 14),
now for the arrow marking. In particular no two supertiles can meet at an odd
offset, so the hierarchy cannot slip a half-step.

### 7.5 What is *not* proved

This is the honest boundary.

1. **Aperiodicity is not proved.** The induction "a period would have to halve at
   every level, hence vanish" needs, at each level, that the grouping of §7.4
   applies to *all* chairs of an arbitrary legal tiling and that the induced
   parent tiling is legal. I verified the two finite ingredients (Theorems C and
   D) but did not formalise the induction.
2. **A gap at four chairs.** `force3.py` §4 enumerates all 2 156 configurations
   `(X, ν(X), X′, ν(X′))` with `X′` a legal neighbour of `X`. 207 are legal
   4-chair patches; 18 give the same parent, 189 give cell-disjoint parents, and
   of those **54** have a parent-to-parent relative pose that is *not* in `A44`
   after halving. Theorem D says such a pair of parents cannot both be fully
   present, so these configurations do not extend — but the argument needs the
   parents to be complete, which is the induction step of point 1. Reported, not
   swept under the rug.
3. **Bounded box.** All atlas searches use `|t| ≤ 4` for chairs and `|t| ≤ 9` for
   supertiles. Beyond that range the two tiles cannot be face-adjacent given their
   diameters, so the bound is not a restriction — but it is an unproved
   (if obvious) geometric remark, not a checked one.
4. **Registration is assumed**, not proved (§8.1).
5. No search for periodic tilings was attempted. Tsiokos ran a 108 682-second SAT
   search over 43 981 sublattices of index ≤ 40 and found none; that is *evidence*
   in his paper too, not proof.

---

## 8. Caveats and differences from the two published systems

### 8.1 Registration

Everything here is about **registered** placements: integer translations, cubic
frames, facets that either coincide or are disjoint. Tsiokos devotes his §4–§5 to
*deriving* registration from the dihedral angles of the little pyramids. In the
arrow picture there is no geometry to derive it from — arrows on facets only make
sense once facets align. This is the single biggest logical difference between
CGS's picture and the paper it summarises.

### 8.2 The arrow alphabet is coarser than the bump alphabet, by exactly a factor 2

A facet's arrow label is `(type, corner)` — 3 × 4 = **12** labels, and each is
invariant under the diagonal reflection of the square through the marked corner.
Tsiokos's panel label is a word of 8 signed heights whose D4-orbit has size 8, so
his alphabet is **24** labels with trivial stabiliser. Consequence, measured:

| | proper contacts | improper contacts |
|---|---|---|
| arrow marking `M24` | **44** (= `A44`) | **16** |
| Tsiokos `Chair44` | 44 | **0** |

The arrow system therefore admits 16 reflected contacts that the bumps exclude,
and with reflections allowed the complete-first-shell count rises from 33 to 49.
**Homochirality has to be imposed** in the arrow model. One extra bit per mark
(orienting the arrow off the facet diagonal, so that the diagonal reflection acts
non-trivially) would restore the factor 2; nothing in the photograph shows such a
bit, so I did not invent one. Note that CGS's *purple bar* does carry orientation
information of a kind — it joins two marks on two different unit facets of one
2×2 face — but that is a relation between facets, not a label on one, and it has
no force when the neighbour's 2×2 face is not aligned.

### 8.3 Naming

CGS's *"all those crazy 21 markings"* is matched, in `tiling-sources.md`, to the
21 **outer panels** of Tsiokos's Figure 3. Note that the drawing independently
shows 21 **drawn marks** (24 facets minus the 3 blank far-corner quarters). Both
readings are available; the reconstruction here needs all 24.

### 8.4 Relation to Goodman-Strauss 1999

The chair, the eight-child substitution and the central-recognition argument are
all in Goodman-Strauss, *An aperiodic pair of tiles in Eⁿ for all n ≥ 3*, EJC 20
(1999) 385–395 (preprint: <https://strauss.hosted.uark.edu/papers/Newpaper.pdf>),
whose §4 recognition proposition is the ancestor of §7.4 above. Tsiokos does not
cite it. The preprint also anticipates VB's meeting remark verbatim: *"It is not
difficult to modify our construction to use 'bumps' and 'nicks' instead of
markings."*

---

## 9. Reproducing

```
cd verify
./runall.sh                      # 3 min 29 s wall clock, python3 only, no dependencies

python3 verify.py    # conventions; (a) (b) (c); the 60-pose atlas
python3 force.py     # 22 shell cells, 33 complete first shells, 7 notch fillers
python3 force.py --allow-reflections     # 60-pose atlas, 49 shells
python3 force2.py    # competing groups, nu-map on 4096 chairs, coarse atlas
python3 force3.py    # the grouping theorem from the 33 shells
python3 force4.py    # (1/2)(supertile atlas) = A44
python3 m21.py       # why the literal 21-mark reading fails
python3 search.py    # exhaustive over all 6^8 markings              (~85 s)
python3 classes.py   # the 18 solutions scored against the drawing   (~40 s)
python3 panelmap.py  # Tsiokos's 24 panels -> our 24 facets
python3 export.py    # rewrites marking.json in this directory
```

Files: `chair.py` (150 lines of model), the scripts above, `runall.log`,
`marking.json`, and `tiling-matching-system.json` — the transcription of
Tsiokos's paper that `classes.py`, `panelmap.py` and `export.py` compare
against. Note that `export.py` **overwrites** `marking.json` in place.

### `marking.json` for the page builder

| key | contents |
|---|---|
| `conventions` | cells, chair, facets, sites, pose format |
| `symbols` | `F`/`H`/`B` with glyph descriptions and the complement map |
| `matching_rule` | the one-sentence rule and `comp` |
| `stars` | the 8 stars of §2.1 |
| `facets` | 24 entries: `cell`, `outward_normal`, `axis`, `is_notch_facet`, the 4 `corners`, and `mark` = `{type, name, site, arrow_tail, arrow_head}` — the arrow runs along the facet diagonal, tail at the corner opposite the site, head at the site |
| `substitution` | the 8 child frames of §4 |
| `contact_atlas` | the 44 proper poses (= `A44`) and the 16 improper ones |
| `notch_fillers` | the 7 poses of §7.3 with their slots |
| `tsiokos_panel_map` | Tsiokos's 24 `Chair44` panel IDs mapped onto these 24 facets, with his motif class and our symbol side by side (`A→H`, `B→F`, `C→B`) |
| `verification` | the raw output of every script above |
