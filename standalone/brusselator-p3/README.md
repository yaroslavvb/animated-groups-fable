# Spiral Lattice

The colour twin of `../brusselator-p3-mono/`: Plume's fullscreen viewer
(`docs/scott-gray/plume/`) on the g227 Brusselator oscillatory spiral lattice
(`equation:brusselator:g227:e47c12f9099fb9d2`). `app.mjs`, `renderer.mjs` and `field.f32` are
byte-identical copies of the monochrome page's; without `data-style` on the canvas the renderer
draws U in the ember palette over `record.ranges.u`, and `style.css` is Plume's ember stylesheet.

Deploy: `npx wrangler deploy` here → https://brusselator-p3-spiral.mathornament.workers.dev/
