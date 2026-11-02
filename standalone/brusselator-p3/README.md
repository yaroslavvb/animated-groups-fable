# Spiral Lattice

The colour twin of `../brusselator-p3-mono/`: Plume's fullscreen viewer
(`docs/scott-gray/plume/`) on the Brusselator oscillatory spiral lattice
(`equation:brusselator:g227:e47c12f9099fb9d2`). `app.mjs`, `renderer.mjs` and `field.f32` are
byte-identical copies of the monochrome page's; without `data-style` on the canvas the renderer
draws U in the ember palette over `record.ranges.u`, and `style.css` is Plume's ember stylesheet.

The published Brusselator spiral lattice has clockwork symmetry r3₂∗3: every frame is
mirror-symmetric, and a third of a turn about a centre between the mirrors gives the film a third
or two thirds of a period later, depending on the direction of the turn. This film was found by a
search for r33₁3₂, which imposed nine symmetries, and it has more symmetry than that: eighteen,
which make it r3₂∗3, and its data file keeps the label g227 it was searched under. Its catalogue
entry is https://yaroslavvb.github.io/animated-groups-fable/correspondence-p31m.html#g234. The
page's texts say r3₂∗3 since Mon 2 Nov 2026 (week 45); the Worker and this folder keep `p3` in
their names, since renaming breaks shared links.

Deploy: `npx wrangler deploy` here → https://brusselator-p3-spiral.mathornament.workers.dev/
