# Spiral Lattice Monochrome

Plume Monochrome's fullscreen viewer (`docs/scott-gray/plume-monochrome/`) ported to the
g227 Brusselator oscillatory spiral lattice (`equation:brusselator:g227:e47c12f9099fb9d2`,
36×36 triangular lattice, 48 frames). `app.mjs` differs from Plume's only in the home centre,
the zoom floor and 60° keyboard turns; `renderer.mjs` adds the triangular lattice map,
snaps turns to sixths, and draws w(x, t) = U(x, t) − U(x, t + T/2) > 0.426, the
catalog's half-period rule (`mono:half-period:daf4fcffba1a:T2`) cut at 30.1% of max|w|
instead of zero: at zero the inks trade blob/network roles six times a period, while at
this level the white islands neither merge nor split (checked at 768 instants). The
exact half-period colour swap is given up for that.

Deploy: `npx wrangler deploy` here → https://brusselator-p3-spiral-mono.mathornament.workers.dev/
