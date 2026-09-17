# Plume

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

Rendering (WebGL 2), compared with the source page's bilinear playback of
linearly blended frames:

- On load, every frame's U channel is doubled to 96×96 by exact trigonometric
  (Dirichlet-kernel) interpolation, the band-limited reconstruction of the
  periodic samples. The saved samples are kept unchanged.
- Each displayed frame is blended on the CPU from the four nearest saved
  frames with periodic Catmull–Rom weights (37 thousand multiply-adds) into a
  96×96 float texture. The GPU then reconstructs every device pixel from that
  texture with periodic bicubic Catmull–Rom interpolation: nine bilinear
  fetches where float textures filter (`OES_texture_float_linear`), sixteen
  point fetches otherwise. That is the whole per-pixel cost, so phones can
  hold their display's refresh rate.
- Against the exact band-limited reconstruction of the saved samples, the
  displayed value differs by under 0.4 of one 8-bit colour level (the source
  page: up to 9 levels). Temporal Catmull–Rom at half the saved frame rate
  differs from the skipped frames by under 0.2 of a level.
- The original ember colour stops and the orbit's `ranges.u` normalisation are
  applied continuously, at native device pixels, with sub-byte dithering.
- Adaptive resolution: when continuous frames arrive later than the display's
  cadence (measured from idle animation frames while the pattern downloads),
  the render resolution is lowered a step at a time, each step kept only if
  the cadence actually improves, and raised again once frames stay on time.
  `?dpr=1` (or any ratio) pins the resolution and turns this off.

Spatial and temporal interpolation improve display quality; they do not claim
a higher-resolution PDE solution.

The source desktop view is 760 CSS pixels across 2 lattice lengths. Each repeat
stays 380 CSS pixels wide when resizing or entering fullscreen, centred at
lattice coordinates (1, 1). Screens whose shorter side is under 760 CSS pixels
keep two repeats across that side instead. `?scale=<CSS pixels per lattice
length>` fixes the scale. The loop takes eight seconds (the source's speed=1)
and begins at phase 0. Screens with reduced-motion enabled start paused.
Optional `?play=0&phase=0.25` parameters support reproducible still views.

The pattern is endless: drag it with a finger or the mouse (a quick release
keeps it gliding). Two fingers pan, zoom and turn it at once about their
midpoint; a turn that ends within 4° of a quarter turn snaps to it, since the
lattice is square. The wheel or a trackpad pinch zooms about the pointer, and
on a Mac trackpad in Safari a two-finger turn turns the pattern too (Safari
reports trackpad pinches and turns as gesture events with a scale and a
rotation; the page uses them whenever no touch pointers are active, so
iPhone and iPad keep using the pointer events). On the keyboard the arrows
pan, + / − zoom, ] and [ turn by 15° (a quarter turn with Shift), and 0 or
the recentre button returns to the home view. Zooming
out stops where one texel of the 96-node grid spans one device pixel; zooming
in stops at 8000 CSS pixels per repeat. `?x=&y=` place a lattice point at the
screen centre and `?angle=` (degrees, clockwise) turns the home view.

Click Fullscreen, double-click the pattern, or press F. Space plays/pauses.
Controls and cursor hide after inactivity. Pressing S, or tapping the name in
the control bar, shows frame statistics: frames per second, render size,
quality factor, pixels per repeat, the turn, taps per pixel and the display
cadence.
GPU context restoration resumes the pattern; hidden tabs suspend rendering.
Fullscreen playback requests a screen wake lock where supported.

Twitter/X sharing uses `social-preview.jpg` (1200×630) with large-summary and
Open Graph metadata. `plume-preview.mp4` is an eight-second,
1080×1080, 30fps H.264 upload of one seamless loop with no controls or audio.
Both come directly from the actual WebGL renderer. Regenerate them while the
local server is running:

```sh
node tools/export_ember_social.mjs http://localhost:8934/scott-gray/plume/ docs/scott-gray/plume 1 plume-preview.mp4
```

The exporter evaluates exact animation phases, avoiding realtime capture jitter.

Validation from the repository root (Node 20+):

```sh
node --test docs/scott-gray/tests/plume.test.mjs
node docs/scott-gray/tests/plume.browser.mjs http://localhost:8934/scott-gray/plume/
BROWSER=webkit node docs/scott-gray/tests/plume.browser.mjs http://localhost:8934/scott-gray/plume/
```

The browser check requires Playwright with Chrome installed; `BROWSER=webkit`
runs the same checks in Playwright's WebKit (Safari's engine), with
multi-touch as synthetic pointer events and Safari's gesture events as
synthetic events. Set `PLAYWRIGHT_MODULE` and `PNGJS_MODULE` if those packages
are outside the bundled Codex runtime. Safari caps page rendering at 60
frames per second even on 120 Hz screens; Chrome on Android follows the
display's current refresh rate. Deploy with Wrangler using your authenticated personal account:

```sh
npx wrangler pages deploy docs/scott-gray/plume --project-name plume-wave --branch main
```
