# Rotating wave (p2 ember)

A self-contained WebGL 2 viewer for `wallpaper:g6:731aa45654d4d690`, the
"Rotating wave · F 0.00395 · k 0.02" Gray–Scott orbit shown on the 2222 (p2)
page with the ember palette (`framing=simulation&tiles=2&speed=1`). Serve this
folder as static files. No build, dependencies, remote data, or server
computation are required. Cloudflare Pages can deploy the folder directly.

`field.f32` is byte-identical to the verified orbit
`../data/orbits/g96-F0p00395000-k0p02000000-N48-M128.f32`: 128 frames of a
48×48 periodic lattice, planar U then V, x fastest, float32 little-endian
(2,359,296 bytes). Its SHA-256 is
`731aa45654d4d690f202dc48818e47c8fe023bfd5462284a8601f4bed6563483`.

Rendering, compared with the source page's bilinear playback of linearly
blended frames:

- On load, every frame's U channel is doubled to 96×96 by exact trigonometric
  (Dirichlet-kernel) interpolation, the band-limited reconstruction of the
  periodic samples. The saved samples are kept unchanged.
- The GPU holds all 128 upsampled frames in one float 3D texture and
  reconstructs each device pixel with periodic Catmull–Rom interpolation in x,
  y and time, across repeat boundaries and across the end of the period.
- Against the exact band-limited reconstruction of the saved samples, the
  displayed value differs by under 0.4 of one 8-bit colour level (the source
  page: up to 9 levels). Temporal Catmull–Rom at half the saved frame rate
  differs from the skipped frames by under 0.2 of a level.
- The original ember colour stops and the orbit's `ranges.u` normalisation are
  applied continuously, at native device pixels, with sub-byte dithering.

Spatial and temporal interpolation improve display quality; they do not claim
a higher-resolution PDE solution.

The source desktop view is 760 CSS pixels across 2 lattice lengths. Each repeat
stays 380 CSS pixels wide when resizing or entering fullscreen, centred at
lattice coordinates (1, 1). Screens whose shorter side is under 760 CSS pixels
keep two repeats across that side instead. `?scale=<CSS pixels per lattice
length>` fixes the scale. The loop takes eight seconds (the source's speed=1)
and begins at phase 0. Screens with reduced-motion enabled start paused.
Optional `?play=0&phase=0.25` parameters support reproducible still views.

Click Fullscreen, double-click the pattern, or press F. Space plays/pauses.
Controls and cursor hide after inactivity. GPU context restoration resumes the
pattern; hidden tabs suspend rendering. Fullscreen playback requests a screen
wake lock where supported.

Twitter/X sharing uses `social-preview.jpg` (1200×630) with large-summary and
Open Graph metadata. `rotating-wave-preview.mp4` is an eight-second,
1080×1080, 30fps H.264 upload of one seamless loop with no controls or audio.
Both come directly from the actual WebGL renderer. Regenerate them while the
local server is running:

```sh
node tools/export_ember_social.mjs http://localhost:8934/scott-gray/p2-ember/ docs/scott-gray/p2-ember 1 rotating-wave-preview.mp4
```

The exporter evaluates exact animation phases, avoiding realtime capture jitter.

Validation from the repository root (Node 20+):

```sh
node --test docs/scott-gray/tests/p2-ember.test.mjs
node docs/scott-gray/tests/p2-ember.browser.mjs http://localhost:8934/scott-gray/p2-ember/
```

The browser check requires Playwright with Chrome installed. Set
`PLAYWRIGHT_MODULE` and `PNGJS_MODULE` if those packages are outside the bundled
Codex runtime. Deploy with Wrangler using your authenticated personal account:

```sh
npx wrangler pages deploy docs/scott-gray/p2-ember --project-name p2-ember --branch main
```
