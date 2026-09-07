# Ember

A self-contained WebGL 2 viewer for `equation:ginzburg-landau:g134:3ba87ed68bc2e4d1`.
Serve this folder as static files. No build, dependencies, remote data, or server
computation are required. Cloudflare Pages can deploy the folder directly.

`field.f32` is exactly the first 10,368 bytes of the original verified orbit at
`../data/equation-orbits/3ba87ed68bc2e4d16cd6.f32`: two planar 36×36 float32 little-endian
channels, Re B followed by Im B. The full source SHA-256 is
`3ba87ed68bc2e4d16cd689d679d041b50eedcf4d77ec6dc3caab6019c4bee818`.

The relative equilibrium is B(x,y) exp(−2πi phase), so a single uploaded texture
supports exact continuous temporal rotation. The renderer uses periodic
Catmull–Rom interpolation, the original ember color stops and normalization,
native device-pixel rendering, and sub-byte dithering. Spatial interpolation
improves display quality; it does not claim a higher-resolution PDE solution.

The source desktop view is 760 CSS pixels across 3 lattice lengths. Each repeat
stays 253⅓ CSS pixels wide when resizing or entering fullscreen, centered at
lattice coordinates (1.5, 1.5). The loop takes four seconds (the source's speed=2)
and begins at phase 0.552387499999992. Screens with reduced-motion enabled start
paused. Optional `?play=0&phase=0.25` parameters support reproducible still views.

Click Fullscreen, double-click the pattern, or press F. Space plays/pauses.
Controls and cursor hide after inactivity. GPU context restoration resumes the
pattern; hidden tabs suspend rendering. Fullscreen playback requests a screen
wake lock where supported.

Twitter/X sharing uses `social-preview.jpg` (1200×630) with large-summary and
Open Graph metadata. `ember-preview.mp4` is an eight-second, 1080×1080, 30fps
H.264 upload with two seamless loops and no controls or audio. Both come directly
from the actual WebGL renderer. Regenerate them while the local server is running:

```sh
node tools/export_ember_social.mjs
```

The exporter evaluates exact animation phases, avoiding realtime capture jitter.

Validation from the repository root (Node 20+):

```sh
node --test docs/scott-gray/tests/ember.test.mjs
node docs/scott-gray/tests/ember.browser.mjs http://localhost:8934/scott-gray/ember/
```

The browser check requires Playwright with Chrome installed. Set
`PLAYWRIGHT_MODULE` and `PNGJS_MODULE` if those packages are outside the bundled
Codex runtime. Deploy with Wrangler using your authenticated personal account:

```sh
wrangler pages deploy docs/scott-gray/ember --project-name p4g-ember --branch main
```
