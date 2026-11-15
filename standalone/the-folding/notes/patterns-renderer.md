# The renderer's third print mode: a signed-distance texture — 13 Nov 2026

The pattern round (the owner: *"come up with some patterns which are more like a comma but they fill more of the space,
and they reuse the idea of the checkerboard by giving different tints to the two sides"*) needs the 3D sheet to carry
ANY two-tone pattern of a lattice: the orbit of a motif of polygons (`src/shapes.js`), baked into the signed distance
to its outlines over one lattice cell (`src/sdf.js`). `src/render3d.js` now prints such a texture: mode 3, beside the
linear forms (mode 1) and the rings (mode 2). This note is what was built, how to feed it, and what was measured on a GPU.

Files of this job: `src/render3d.js`, additions to `test/render3d.test.js` and `test/render3d-dom.test.js`,
`dev/patterns/tex-demo.html`, `dev/patterns/tex-demo.mjs`, this note, `dev/patterns/scratch-renderer/`.

## How to feed it (for the glue)

```js
R.setSurface({ positions, indices, uv });            // uv: every vertex's point of the paper, as for modes 1 and 2
R.setStyle({ print: { mode: 3, L, A, I, O, tex }, printFront, printBack, opacity });
//   I    Float32Array(4): the rows of [e1 e2]^-1;  (s, t) = (I.xy . (p - origin), I.zw . (p - origin))
//   O    Float32Array(3): (origin.x, origin.y, range)
//   A    Float32Array(4): (e1, e2). Checked (4 finite numbers), not used by the shader.     L: not looked at.
//   tex  { size, data: Uint8Array(size * size), range }   what src/sdf.js bakeSDF returns, with its size and range
```

- **The texture is kept by reference and keyed on the array.** It is uploaded when `tex.data` (the array object) or
  `tex.size` is another one than at the last frame, and never otherwise: hand the same `tex` over on every colour
  change of a fold, in a fresh wrapper or not, at no cost (104 `setStyle` calls with a print in the proof below: one
  upload). So: **bake once per print and keep the array** (a cache on the print object); a `printUniforms` that bakes
  on every call would upload on every call. Do not write into a data array after handing it over: a lost context is
  restored from it. `R.stats.printUploads` counts the uploads (a test can assert on it).
- **One texture at a time.** The one before is deleted when another field comes, and the last one when the style's
  print is no longer mode 3 (a checkerboard, `null`). Going back uploads again: about 0.3 ms for 256², 0.5 ms for
  1024², 2 ms for 2048² on the mini's M4 (the frame it happens in, less a frame without).
- **The range** that decodes the texture is `tex.range`; `O[2]` is used where the tex has none. They are the same
  number in a correct caller.
- **What is refused** (the sheet is then drawn without a print, in its plain front and back colours, and
  `console.warn` says why, once per reason): no `tex`; a `size` that is no whole number ≥ 1; `data` that is no
  `Uint8Array` (or `Uint8ClampedArray`) or holds fewer than size² values (more is fine); a range that is not
  positive; a non-finite number in `A`, `I` or `O`; a size beyond the GPU's `MAX_TEXTURE_SIZE` (16384 on the M4;
  2048 is what WebGL2 guarantees). A surface without `uv` carries no print, as before.
- **`setStyle` itself touches no GL**, as before: it can be called while the context is lost; the upload happens in
  the next drawn frame.

## What the shader does

One texture read per pixel, at the CONTINUOUS lattice coordinates (never `fract()`ed: the mip level is chosen from
their derivatives, which would jump along the borders of the cells); `R8`, `UNPACK_ALIGNMENT 1`, wrap `REPEAT`, min
`LINEAR_MIPMAP_LINEAR`, mag `LINEAR`, `generateMipmap`, anisotropic filtering up to 16 where
`EXT_texture_filter_anisotropic` exists; a `highp` sampler (the interpolated distance needs more than a byte).

```
sd   = (texture(uPatT, st).r * 255 - 128) / 127 * range              negative inside the dark tone
w    = the pixel's footprint ACROSS the outline, in paper units      sdfFootprint
tone = clamp(0.5 - sd / clamp(w, 1e-6 range, 2 range), 0, 1)         sdfTone;   0 light .. 1 dark
```

then the colours exactly as modes 1 and 2 (`mix(uPatF0, uPatF1, tone)` on the front, `uPatB0`, `uPatB1` on the back;
ghost and fill after; the lab's palette, tint ≥ 4, overrides as before).

- **The footprint is taken across the outline.** With J = [dFdx(uv) dFdy(uv)] (the paper under a pixel step right /
  up) and g the unit gradient of sd on the paper, w = |Jᵀg|. On a tilted sheet it is small for an outline that runs
  away from the eye and large for one that lies across, so both are one pixel wide. The gradient's DIRECTION is read
  off the screen derivatives of the sampled sd (`(dFdx(sd), dFdy(sd))` = Jᵀ∇sd, no extra texture read); its LENGTH is
  never trusted (a texture's field is flatter than a true distance near a thin mark and in the coarse mip levels), so
  w always lies between the pixel's short and long side. Where the field is flat (|∇sd| under 0.6, fading out to 0.2)
  the direction means little and w goes over to the root mean square over all directions.
- **Small on the screen it is the plain mean.** From a footprint of 2·range on, tone = 0.5 − sd / (2·range): LINEAR
  in the texture's value, so what is drawn is the mip-mapped mean of the print (the mean of a mip level is the tone
  of the mean). Nothing thresholds a noisy average, so nothing can sparkle. Between range and 2·range the ramp widens
  from one pixel to that.
- uniforms: `uPat` (3), `uPatI`, `uPatO` (origin, range), `uPatT` (the sampler, unit 0), `uPatF0/F1/B0/B1` as before.
  While there is no shape print a 1 × 1 stand-in texture is bound, so the sampler always has a complete texture.
- JavaScript twins, exported from `src/render3d.js`: `sdfTone(sd, footprint, range)`,
  `sdfFootprint(ax, ay, bx, by, gx, gy)` (J and the gradient on the paper), `sdfRead(tex, s, t)` (the texture read as
  the magnified GPU reads it; the same number as `sdfDistance(sdfSample(...))` of `src/sdf.js`). The tone the shader
  draws at a paper point, for a test without a GPU: `sdfTone(sdfRead(tex, s, t), footprint, tex.range)`.
  `test/render3d.test.js` RUNS the GLSL text of `sdfTone` and `sdfFootprint` as JavaScript against these twins.

**Lost context.** The renderer already handled it (SPEC 8, C4): `webglcontextlost` is answered with
`preventDefault`, everything GL is dropped and a one-line message shown; `webglcontextrestored` builds programs and
buffers again and marks every upload dirty. The print's texture comes back the same way: the GL state is new, so the
next frame uploads it again from the array the style still holds. Measured with `WEBGL_lose_context`: one upload,
and the picture after is the picture before, pixel for pixel.

**Modes 0, 1, 2 and the palette path** are the text they were (a test compares their GLSL verbatim); `lab22x` uses
the renderer unchanged.

## Advice on the texture (measured, see below)

- **size: a power of two.** Then the texture of the cell that begins half a cell further on gives the same picture
  to 0.012 of a tone at every zoom: the mip levels nest and repeat exactly. With 200 the coarse levels do not: up to
  0.06 of a tone on a sheet 40 px across. An odd size was not measured properly (half a cell is no whole number of
  its texels). Nothing is refused.
- **size: by how big a cell gets on the screen.** Corners are rounded off at the scale of one texel (seen: the bar's
  corners at 8 and 16 device px a texel), the outline's position is good to about 0.01 texel (rms, measured), and a
  mark or gap thinner than about two texels cannot be held faithfully by samples a texel apart (the proof's bar, 2.6
  texels wide in the 64² texture, was still drawn; thinner ones were not tried). At 2 device px a texel none of this
  shows; at 8 a sharp tip is blunted by about a texel, i.e. several pixels; at 16 an outline wobbles by 0.15 px rms. A cell of a group with 6 or 12 tiles is 3 to 4 tiles across — roughly 2500 device px at zoom 1 on a retina
  laptop, by my arithmetic, not measured in the app: 1024 for those, 512 for the groups whose cell is one or two
  tiles. The narrowest gap of a design (`GAP_MIN` = 0.02 tile sizes) should be 3 texels or more.
- **range: about 4 texels of the longer basis vector** (`4 * max(|e1|, |e2|) / size`). The byte stores the distance in
  steps of range / 127, so a long range makes the outline wobble when magnified (16 device px a texel: 0.09 px rms at
  range 2, 0.15 at 4, 0.22 at 8, 0.42 at 16), and a short one gives way to the plain mean sooner when minified (4
  texels a pixel: the ramp is 1.02 px wide at range 8, 1.09 at 4, 1.23 at 3, 1.75 at 2; at range 1 it is 1.7 px wide
  at 2 texels a pixel already). Magnified, even a range of 1 texel draws a good outline (0.08 px rms at 16 px a texel).
- **The field must be the true distance at the texel centre** (which `bakeSDF` gives: its texture is the same, to one
  level of the byte, as the analytic one of the proof, and it was run on the GPU too). The easy way — the print as
  dark and light texels, then a distance transform — is good to half a texel only: at 8 px a texel the ramp is 4.6 px
  wide and the outline 1 px rms off (the control row of the proof).

## Measured on a GPU

`FOLDING_BROWSER=mini node dev/patterns/tex-demo.mjs` — Chrome (headless) on the mini, **ANGLE Metal on an Apple M4**,
MSAA 4, anisotropic ×16; about a minute. Numbers: `~/drive.unsynced/artifacts/the-folding-patterns/renderer/`
`tex-demo.txt` (the table) and `tex-demo.json`; pictures: `tex-dpr{1,2}-*.png` there (`…-contact.png` is all of them
on one sheet).

The scene: a flat square sheet (uv = xy; a 24 × 24 grid, and two triangles) with a synthetic print whose exact signed
distance is known — per cell of a SKEW lattice (e1 = (0.8, 0), e2 = (0.28, 0.64)) a disc, a ring, a thin bar and a
small disc, the ring across one border of the cell, the bar across another, the small disc over a corner. Texture
256², range 4 texels. The tone of a pixel is read from three pictures of the same view (the print, all light, all
dark): the colour is exactly `mix(light, dark, tone)` whatever the lighting. The paper point under a pixel and the
paper under a pixel step come from the camera's matrices (they agree with `R.project` to 2e-16). Zoom z = css px per
texel (device px per texel = z × dpr).

| what | bound | measured |
|---|---|---|
| pixels more than 2 px from every outline: the tone is the analytic one (within 0.05) | ≥ 99.5 % | z 0.5 … 8, face-on and tilted (el 35), dpr 1 and 2: **99.9984 % … 100 %** of all of them (43 980 … 1 425 728 a view), **100 %** of 2000 drawn at random, in every view. The pixels that are off (1, 1, 1 and 23 of them, at 5.6, 8, 8 and 16 device px a texel) all lie within 0.61 texel of a corner of the bar: the corner, rounded off. |
| the same on the BACK (el −90, el −35; only the back's two colours changed between the three pictures) | ≥ 99.5 % | **99.9999 % … 100 %**; 0 pixels of the back do not answer to the back's colours; 0 pixels of the front do |
| the ramp across an outline (10 % to 90 %, ÷ 0.8) | ≤ 1.5 px | dpr 1: face-on 1.001, 1.000, 1.001, 1.008, 1.019 (z 0.5, 1, 2, 4, 8); tilted 1.000, 1.000, 0.999, 0.997, 1.002. dpr 2: face-on 0.999, 0.999, 1.007, 1.019, 1.063; tilted 0.999, 0.999, 1.001, 1.003, 1.012. Grazing (el 12): 0.970 … 1.060. Back: 0.998 … 1.020 |
| where the ramp sits | — | within 0.014 px of the analytic outline (grazing 0.035) |
| the GPU's tone against the twin `sdfTone(sdfRead(tex), footprint)`, within 2 px of an outline | — | rms 0.0014 … 0.0053 face-on and tilted, at 1 device px a texel and more. With the outline's direction ignored the same twin fits the tilted views 5.5 to 12 times worse and the grazing ones 5 to 14 (face-on it is the same twin): the footprint is taken across the outline |
| no seam, 1: pixels on a border of a cell, on plateaus | 0 | largest deviation **0** in every required view (577 … 9878 such pixels a view) |
| no seam, 2: the same picture from a texture whose cells begin half a cell further on | the same | largest difference of the tone on a border of either texture **≤ 0.0115** (about 3 colour levels of 300), 21 zoom views and 4 small sheets, both dpr; anywhere ≤ 0.047 (tilted z 8 at dpr 2: the GPU's sub-texel precision on an outline, not on a border) |
| two triangles against the grid | the same | ≤ 1 level of 255 (dpr 1), ≤ 3 (dpr 2: one pixel of 894 847 over 2), inside the sheet. On the sheet's own rim 57: the multisample coverage of one long edge against 24 short ones, not the print |
| small on the screen (sheet 160, 80, 40, 20, 12 px; 13 frames, 1° apart, el 55 and el 90) | calm | mean tone 0.227 … 0.245 (the texture's mean: 0.233), wandering by ≤ 0.0025 down to 40 px, 0.010 at 20 px, 0.020 at 12 px (the ideal picture's own: up to 0.003, 0.010, 0.029). Flicker (mean \|T(k−1) − 2T(k) + T(k+1)\| per pixel) at el 55: **0.064, 0.031, 0.016, 0.007, 0.004**; the ideal box-filtered print: 0.067, 0.044, 0.025, 0.030, 0.024; the print without any filtering (the control): 0.101, 0.098, 0.084, 0.079, 0.045 |
| `WEBGL_lose_context`, then restore | the print is back | lost: the message is shown; restored: one upload; the picture after against before: largest difference **0** of 255 |
| the same `tex` handed over again | no upload | 104 `setStyle` calls with the print (a new wrapper each time) and new colours: **0** uploads after the first |
| the texture of `src/sdf.js` (the same shapes as polygons) | as above | far 100 % (99.9999 % at 8 px a texel: one pixel, at a corner), ramp 0.999 … 1.092 px, offset ≤ 0.012 px, front and back |

Outside the required zooms: at z 0.125 and dpr 1 (8 texels a pixel, a footprint of 2·range) the ramp is 1.81 px wide
— the mean, as designed; the grazing views with 4 and more texels a pixel: 1.3 … 1.5 px. In the grazing views four
single pixels more than 2 px from an outline are off by 0.05 … 0.2 without being at a corner (the soft end of the
ramp, where the footprint across an outline nears the range).

The small sheet at low elevations, where the footprint is long and thin (el 30, 20, 12 and 6; sheets of 320 … 40 px;
13 frames 1° apart; `dev/patterns/scratch-renderer/tiny-grazing.mjs`): the flicker is 0.21 … 0.99 of the ideal
picture's in every one of the 32 runs, and the mean tone within 0.002 of the ideal picture's.

Looked at (`tex-dpr2-contact.png` and the single pictures): the front teal, the back sand and mirrored, as paper is;
outlines crisp face-on, tilted and at el 12, near and far; at 16 device px a texel the bar's corners are cut off over
about one texel and its long edges are very slightly uneven (the byte); small sheets are soft blobs that do not
crawl; the same paper rolled up (`tex-dpr2-roll*.png`) carries the print over the curved mesh without a break, teal
outside, sand inside.

## Tests

- `test/render3d.test.js` (+5): the ramp and its linear end; the footprint between the pixel's short and long side
  and equal to it face-on; **the shader's own GLSL text of `sdfTone` and `sdfFootprint` run as JavaScript against the
  twins**, no `fract` in mode 3, the decode, one texture read, a `highp` sampler, modes 1 and 2 verbatim; `sdfRead`
  against the contract's layout (texel centres, rows, sign, range, repeating) and against a real field on a skew
  lattice; `setStyle`'s check of a shape print.
- `test/render3d-dom.test.js` (+4, on a stand-in WebGL2 that keeps its textures): the upload as it must be (R8,
  alignment 1, not flipped, REPEAT, trilinear, anisotropy, mip levels, bound at unit 0 when the sheet is drawn);
  30 colour changes with the same field: one upload; another field: the old texture deleted; mode 1 / 2 / null: the
  texture let go and the stand-in bound; a lost context: uploaded again once, also for a print set while lost; a field
  the GPU cannot hold, seven malformed prints, a sheet without uv: no print and one warning; `dispose` leaves nothing.
- 29 faults planted one at a time into a COPY of the renderer (`dev/patterns/scratch-renderer/mutants.mjs`,
  `mut-run.sh`): every one fails at least one of these tests; the copy without a fault passes.
- `dev/patterns/scratch-renderer/bake-check.mjs` (node, a second): `bakeSDF` against the analytic texture of the
  proof, texel by texel (at most one level of the byte apart, no texel of the wrong tone; sizes 64, 200, 256; ranges
  2, 4, 8 texels), and `sdfRead` against `src/sdf.js`'s own reader (1e-17).
- **The other modes are the pictures they were**: `dev/patterns/scratch-renderer/compare.mjs` (Chrome on the mini)
  draws 44 scenes with the renderer as it was before this job (a copy) and with the renderer now — the checkerboard
  and the rings of five groups from four sides (the back and a grazing view among them), the ghost and fill tints
  under a print, a translucent sheet without a print, the lab's palette, the palette over a print — at dpr 1 and 2:
  not one colour value differs.
- The whole suite (`bash dev/patterns/suite.sh`), with the other agents' work as it stood: see the report of the round.

## Not verified, and limits

- **One GPU.** Everything above is Chrome on Apple silicon (ANGLE on Metal). Not run: Intel / AMD, Windows (ANGLE on
  D3D), Android, Safari, Firefox; a GPU without anisotropic filtering (that path is tested on the stand-in only).
  The shader takes derivatives inside a branch on a uniform, as modes 1 and 2 already do.
- **The real designs were not on this sheet.** The proof uses a synthetic print and `bakeSDF` on the same shapes; a
  design's motif through `shapes.js` → `bakeSDF` → the app is the glue's and the integrator's to look at.
- **Corners and thin marks**: a single distance channel rounds a sharp corner off at the scale of a texel and cannot
  hold a mark thinner than about two; the plane pane (canvas paths) draws the same motif exactly, so at high zoom the
  tip of a comma is blunter in 3D than in the plane. Only a larger texture helps.
- **8 bits**: see the range above. **Sizes that are no power of two** work, with a faint mismatch when small on the
  screen.
- **A lost context** was provoked with `WEBGL_lose_context` only (not a real GPU reset).

## For SPEC 10 (a C4 addition; SPEC.md is not this job's file)

> **Renderer, shape prints** (`src/render3d.js`): `setStyle({ print: { mode: 3, A, I, O, tex } })` prints a
> signed-distance texture of one lattice cell (`tex = { size, data: Uint8Array(size²), range }`, texel (i, j) at the
> lattice coordinates ((i + ½) / size, (j + ½) / size), value v ↦ sd = (v − 128) / 127 · range in paper units, negative
> in the dark tone; `I` = rows of [e1 e2]⁻¹, `O` = (origin, range)). One read per pixel at continuous lattice
> coordinates (R8, REPEAT, trilinear, anisotropic); tone = clamp(½ − sd / clamp(w, 10⁻⁶·range, 2·range), 0, 1) with w
> the pixel's footprint across the outline in paper units; colours as modes 1 and 2. The data array is kept by
> reference and uploaded only when it (or the size) is another one; `R.stats.printUploads`. Exported twins: `sdfTone`,
> `sdfFootprint`, `sdfRead`. Proof on a GPU: `dev/patterns/tex-demo.mjs`; `notes/patterns-renderer.md`.
