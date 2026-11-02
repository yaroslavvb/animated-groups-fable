# Spiral Lattice Monochrome

The black-and-white rendering of the same film as `../brusselator-p3/` (the same `field.f32`):
Plume Monochrome's fullscreen viewer (`docs/scott-gray/plume-monochrome/`) ported to the
Brusselator oscillatory spiral lattice (`equation:brusselator:g227:e47c12f9099fb9d2`,
36×36 triangular lattice, 48 frames). `app.mjs` differs from Plume's only in the home centre,
the zoom floor and 60° keyboard turns; `renderer.mjs` adds the triangular lattice map,
snaps turns to sixths, and draws w(x, t) = U(x, t) − U(x, t + T/2) > 0.426, the
catalog's half-period rule (`mono:half-period:daf4fcffba1a:T2`) cut at 30.1% of max|w|
instead of zero: at zero the inks trade blob/network roles six times a period, while at
this level the white islands neither merge nor split (checked at 768 instants). The
exact half-period colour swap is given up for that.

The published Brusselator spiral lattice has clockwork symmetry r3₂∗3: every frame is
mirror-symmetric, and a third of a turn about a centre between the mirrors gives the film a third
or two thirds of a period later, depending on the direction of the turn. w takes U at one point at
two moments half a period apart, so this black-and-white picture keeps all 18 of the film's
operations; its own group was not measured, so the page names only the film's. This film was
found by a search for r33₁3₂, which imposed nine symmetries, and it has more symmetry than that:
eighteen, which make it r3₂∗3, and its data file keeps the label g227 it was searched under. The
page's texts name r3₂∗3 since Mon 2 Nov 2026 (week 45); the Worker and this folder keep `p3` in
their names, since renaming breaks shared links.

Deploy: `npx wrangler deploy` here → https://brusselator-p3-spiral-mono.mathornament.workers.dev/
