# Spacetime Groups — the crystallography of looping animations

A catalog and tutorial for the **spacetime groups** of 2+1 dimensions: the
crystallographic symmetry groups of animations that loop in time and tile the
plane, after T. J. Fletcher's forgotten 1956 article *Film Groups* and the
classification of Xu–Wu (PRL 120, 096401, 2018;
arXiv:1703.03388), whose appendix C enumerates the 275.

**Site**: https://yaroslavvb.github.io/animated-groups-fable/

Every animation starts paused on a frozen frame: click it to play or pause
(space does the same once it has focus), or point at it and step through the
loop with ← → (shift for finer steps).

- **Tutorial** — animations as spacetime crystals; the 13 strip ("chronofrieze")
  groups live; the operation bestiary (time screw, time glide, time centring,
  glide time-reversal); the classification theorem.
- **Catalog** — all 275 groups of 2+1D, each with a live canvas animation,
  explicit generators, an orbifold symbol and Xu–Wu-style operation
  names; filterable by crystal system, spatial base, time structure,
  (non)symmorphic, product/non-product.
- **Gallery** — featured groups that are *not* products of a plane group with
  a time group, with downloadable looping GIFs.
- **Notation** — "clockwork orbifold" notation: Conway orbifold symbols with
  gyration subscripts (time screws), tilde-marked mirrors (time glides),
  stacking prefixes (time-centred lattices) and a prime clause (time
  reversal); equivalently, Seifert-fibration data of the quotient 3-orbifold.
- **Patterns** — all 609 perfect k-colour pattern types for k ≤ 6,
  recomputed from scratch: colour group + the based seat of the motif (a
  Chaim colour signature with one symbol marked), one plate each with
  presentation and colour permutations, crops of both books where they
  exist. Beyond the book: the exact enumeration gives 64 three-colour
  types where G&S's Figs 8.2.3/8.3.6 show 59, and the previously
  untabulated 186 + 37 + 182 for four, five and six colours. (The earlier
  **Two-Color Patterns** page remains as the detailed k = 2 study.)
- **History** — Fletcher 1956 (zero citations; his counts 7 and 194 vs the
  modern 13 and 275, explained), Shubnikov/Zamorzaev antisymmetry,
  Janssen–Janner–Ascher, choreographic crystals, the H/K theorem.
- **Scott–Gray** (`docs/scott-gray/`) — a Gray–Scott laboratory for the six
  forward 442 groups g94–g99: a real spiral-wave trajectory, exact time-symmetry
  previews, an adapted Bulatov U-skate seed, live PDE evolution, and a projected
  periodic-orbit solver with independent forward validation. All six symmetry
  classes are compatible; the initial patterned searches remain unverified.
  See [feasibility](docs/scott-gray-feasibility.md) and
  [solver and reproduction](docs/scott-gray/SOLVER.md).

## The computation (`enumerate/`)

The classification is recomputed from scratch in exact rational arithmetic
(pure Python, no dependencies):

- `exact.py` — Smith normal form with transforms; linear congruence solvers.
- `stcore.py` — Zassenhaus cocycle formalism for Galilean spacetime
  crystallography: arithmetic classes (magnetic point group + spacetime
  lattice), H¹(P, ℝⁿ/L) with coboundary quotient, and the normaliser action
  (lattice re-basings, Galilean boosts, combined orientation flips) as a
  pruned integer conjugation search.
- `validate_2d.py` — anchor: reproduces the 17 wallpaper groups.
- `enumerate_1p1.py` — anchor: reproduces the 13 spacetime groups of 1+1D
  with Xu–Wu's names.
- `enumerate_2p1.py` — the 2+1D enumeration (275 groups; per-system totals
  match Xu–Wu Table II).
- `enumerate_colored.py` — the coloured 2D crystals (269 colour groups,
  k ≤ 6; Table 8.2.1 of Grünbaum & Shephard).
- `enumerate_patterns.py` — the 88 two-colour pattern types as orbits of
  (orbifold stratum, index-2 subgroup) pairs under the affine normaliser;
  Chaim's generators and presentations verified exactly; emits
  `docs/data/two-color-patterns.json`.
- `enumerate_patterns_k.py` — the 609 k-colour pattern types (k ≤ 6) as
  orbits of *based* chains S(M) ≤ H ≤ Γ: for non-normal H the admissibility
  of a seat depends on the point of the stratum, so seats are enumerated
  modulo the translations normalising H and orbits taken under Schreier
  generators of the stabiliser of H in the affine normaliser; anchored to
  the 52/88 counts and G&S's three-colour figures (which the computation
  exceeds by five types); emits `docs/data/patterns.json`.
- `correspondence_symbols.py` — the crystallographic generator symbols on
  the correspondence pages (International Tables projection symbols: lens,
  triangle, diamond, hexagon and edge-prolonging screw tails, each one
  filled outline); rewrites the snapshot `correspondence-source.html` in
  place, `--check` verifies it is current.
- `split_correspondence.py` — cuts that snapshot into the served pages:
  `docs/correspondence.html` (the index with one card per wallpaper group)
  and `docs/correspondence-<hm>.html`, one page per wallpaper group (17);
  old `correspondence.html#g244` links are redirected by the index.
- `sync_crops.py` — copies the MathWorld thumbnails and the book crops for
  the three-colour types from the sibling repo, matching crops by the
  audited labels printed in their highlight boxes (several source files are
  misnamed); emits `docs/data/crops.json`.
- `export.py` — feature extraction (rotation centres with phases, mirror/glide
  line classes, reversal cosets), clockwork symbols, catalog JSON.
- `optimize_bases.py` — picks each spec's motif base point to maximise the
  minimum distance between orbit points (the renderer sizes motifs by it).
- `optimize_aspect.py` — picks each cell's aspect ratio, a free modulus of an
  oblique or rectangular lattice, so the orbit is isotropic on screen; only
  where every operation provably stays an isometry.
- `gifs.py` — renders the featured groups to looping GIFs (PIL), mirroring
  `docs/js/renderer.js` motif for motif.
- `verify_animations.py` — group axioms, layout and pixel-level invariance for
  every spec; run before every deploy.

Run order:

```bash
python3 exact.py && python3 validate_2d.py && python3 enumerate_1p1.py
python3 enumerate_2p1.py -v
python3 export.py && python3 optimize_bases.py && python3 optimize_aspect.py
python3 verify_animations.py
```

## Mathematica port (`wolfram/`)

The full catalog as a Wolfram Language package: `FilmGroupAnimation[95]`
gives an interactive `Manipulate` of any of the 275 groups,
`FilmGroupBrowser[]` steps through the whole catalog, and the group data is
stored exactly and re-verified against the group axioms in exact arithmetic.
See [wolfram/README.md](wolfram/README.md) and the guide notebook
`wolfram/FilmGroupsGuide.nb`.

## References

- T. J. Fletcher, "Film Groups", *Math. Gazette* **40** (1956) 15–19.
  [doi:10.2307/3610262](https://doi.org/10.2307/3610262)
- S. Xu, C. Wu, "Space-Time Crystal and Space-Time Group", *PRL* **120**,
  096401 (2018). [arXiv:1703.03388](https://arxiv.org/abs/1703.03388)
- C. Ke, C. Wu, "Two-Dimensional Space-Time Groups: Classification and
  Applications" (2026). [arXiv:2604.05619](https://arxiv.org/abs/2604.05619)
- Conway, Delgado Friedrichs, Huson, Thurston, "On Three-dimensional Space
  Groups". [arXiv:math/9911185](https://arxiv.org/abs/math/9911185)
- Conway, Burgiel, Goodman-Strauss, *The Symmetries of Things* (2008).
- Grünbaum, Shephard, *Tilings and Patterns* (1987), Chapters 5 and 8.

Built with Claude Code (Fable 5).
