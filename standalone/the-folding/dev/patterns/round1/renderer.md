# The first run's report: renderer:mode3 (13 Nov 2026, cut-off run; claims to check, not facts)

**Renderer job (key: renderer) — the third print mode is in, proven on a GPU, whole suite green.**

## What changed in `src/render3d.js`
- **API:** `R.setStyle({ print: { mode: 3, L, A, I, O, tex } })`. Modes 0, 1, 2 and the palette path are untouched.
- **New uniform:** `uniform highp sampler2D uPatT` on unit 0. Reused: `uPat` (= 3), `uPatI` (rows of `[e1 e2]^-1`), `uPatO` (origin.x, origin.y, range), `uPatF0/F1/B0/B1`. A 1×1 stand-in texture is bound whenever there is no shape print.
- **Shader, mode 3** — one texture read at continuous lattice coordinates, no `fract`:
  ```
  sd   = (texture(uPatT, st).r * 255.0 - 128.0) * (range / 127.0)
  w    = sdfFootprint(dFdx(vUV), dFdy(vUV), vec2(dFdx(sd), dFdy(sd)))
  tone = clamp(0.5 - sd / clamp(w, 1e-6 * range, 2.0 * range), 0.0, 1.0)
  ```
  - `w` is the pixel's footprint across the outline, `|Jᵀg| / |g|`. Only the gradient's direction is taken from the texture, so `w` stays between the pixel's short and long side.
  - Where the field is flat (`|g|` between 0.6 and 0.2) `w` fades to the rms over all directions.
  - From `w = 2·range` on, tone is linear in the texture: the plain mip-mapped mean.
  - Colours are mixed by the same line as modes 1 and 2.
- **Texture:** R8, `UNPACK_ALIGNMENT 1`, not flipped, `REPEAT`, `LINEAR_MIPMAP_LINEAR` / `LINEAR`, `generateMipmap`, anisotropy `min(16, GPU max)` when the extension exists.
- **Keeping and re-uploading:**
  - `tex.data` is kept by reference, never copied. It is uploaded in the next drawn frame only when the array object or `tex.size` differs from last time.
  - The previous texture is deleted on replacement, and the last one when the style's print is no longer mode 3.
  - `R.stats.printUploads` counts uploads. `setStyle` itself touches no GL.
- **Context loss:** the renderer already had full handling (preventDefault, message, rebuild on restore). The texture comes back the same way, re-uploaded once from the kept array.
- **JS twins (exported):** `sdfTone(sd, footprint, range)`, `sdfFootprint(ax, ay, bx, by, gx, gy)`, `sdfRead(tex, s, t)`.

## For the glue agent
- **Bake once per print and keep the array.** Upload is keyed on the `Uint8Array` object, so a `printUniforms` that bakes on every call would upload on every call. Never write into the array after handing it over.
- **Range:** `tex.range` decodes the texture; `O[2]` is used only when `tex` has none.
- **Refused** (sheet drawn plain, one `console.warn` per reason):
  - no `tex`;
  - `size` not an integer ≥ 1;
  - `data` not a `Uint8Array` / `Uint8ClampedArray`, or shorter than size² (longer is fine);
  - range not positive;
  - non-finite `A`, `I` or `O`;
  - size above the GPU's `MAX_TEXTURE_SIZE`.
- `L` is not looked at.
- **One texture at a time.** Switching back re-uploads: about 0.3 ms for 256², 0.5 ms for 1024², 2 ms for 2048² on the M4.
- **Size:** use a power of two.
  - With 256 the half-cell-shifted texture gives the same picture to 0.012 of a tone; with 200 the difference reaches 0.06 on a 40 px sheet.
  - Corners round off at about one texel. Outline position is good to about 0.01 texel rms.
  - My suggestion, by arithmetic and not measured in the app: 1024 for the 6- and 12-tile cells, 512 otherwise, narrowest gap at least 3 texels.
- **Range:** about 4 texels. Outline wobble at 16 device px per texel is 0.09 / 0.15 / 0.22 / 0.42 px rms for range 2 / 4 / 8 / 16. Ramp width at 4 texels per pixel is 1.75 / 1.23 / 1.09 / 1.02 px for range 2 / 3 / 4 / 8.
- **`bakeSDF` matches.** Its output is at most one byte level from the analytic texture of the proof, and it was run on the GPU as well. A 0/1 raster plus distance transform would be poor: 4.6 px ramp at 8 px per texel.

## Proof on the GPU
Chrome on the mini, ANGLE Metal on Apple M4, MSAA 4, anisotropy 16; 256² texture, range 4 texels, skew lattice; about 69 s per run. "z" is css px per texel.

| Check | Result |
|---|---|
| Pixels more than 2 px from an outline, z 0.5–8, face-on and tilted, dpr 1 and 2 | 99.9984–100 % of all (43,980–1,425,728 per view); 100 % of 2000 random in every view |
| Same on the back | 99.9999–100 %; front does not react to back colours |
| Ramp width, dpr 1 | face-on 1.001, 1.000, 1.001, 1.008, 1.019; tilted 1.000, 1.000, 0.999, 0.997, 1.002 |
| Ramp width, dpr 2 | face-on 0.999, 0.999, 1.007, 1.019, 1.063; tilted 0.999, 0.999, 1.001, 1.003, 1.012 |
| Ramp width, grazing (el 12) | 0.970–1.060 |
| Ramp position | within 0.014 px of the analytic outline |
| GPU tone against the JS twin | rms 0.0014–0.0053; ignoring outline direction fits 5.5–12× worse tilted, 5–14× grazing |
| Seam: plateau pixels on cell borders | deviation 0 in every required view |
| Seam: picture from a half-cell-shifted texture | ≤ 0.0115 of a tone on any border |
| Two triangles against a 24×24 grid | ≤ 3 levels of 255 inside the sheet |
| Small sheets (160–12 px, 13 frames 1° apart), flicker at el 55 | 0.064, 0.031, 0.016, 0.007, 0.004 (ideal filtered print 0.067–0.024; unfiltered 0.101–0.045) |
| Small sheets, mean tone | 0.227–0.245 (texture mean 0.233) |
| Small sheets at el 30 / 20 / 12 / 6 | flicker 0.21–0.99 of the ideal picture's in all 32 runs |
| `WEBGL_lose_context` and restore | one upload; picture identical (difference 0) |
| 104 `setStyle` calls with the same `tex` | 0 uploads after the first |
| Renderer before against now, 44 scenes of modes 0/1/2, tints, palette, dpr 1 and 2 | 0 differing colour values |

The few far pixels that miss (1, 1, 1 and 23 of them) all lie within 0.61 texel of a corner of the bar.

I looked at the PNGs: teal front, sand mirrored back, crisp outlines face-on, tilted and grazing, soft calm blobs when small, and a rolled-up sheet with the print continuous across the curved mesh.

## Tests
- `test/render3d.test.js` +5, `test/render3d-dom.test.js` +4; additions only.
- The GLSL text of `sdfTone` and `sdfFootprint` is run as JavaScript against the twins.
- 29 faults planted in a copy of the renderer are all caught.
- Whole suite, last lines: `# tests 854`, `# pass 852`, `# fail 0`, `# cancelled 0`, `# skipped 2`, `suite.sh: exit 0`.

## Not verified
- Only one GPU and browser. Not run: Windows/D3D, Intel/AMD, Android, Safari, Firefox, or a GPU without anisotropy (that path is only tested on the stand-in).
- No real design was on the sheet: the proof uses a synthetic print and `bakeSDF` on the same shapes.
- Context loss was provoked only through `WEBGL_lose_context`.
- Odd texture sizes were not measured properly, and marks thinner than 2.6 texels were not tried.
- At 16 device px per texel, corners are visibly cut over about one texel; only a larger texture helps.
- `SPEC.md` is not mine; the paragraph to paste is at the end of the notes.

## Files
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/src/render3d.js`
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/test/render3d.test.js`
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/test/render3d-dom.test.js`
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/dev/patterns/tex-demo.html`
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/dev/patterns/tex-demo.mjs`
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/notes/patterns-renderer.md`
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/dev/patterns/scratch-renderer/` — `compare.mjs`, `mutants.mjs`, `mut-run.sh`, `bake-check.mjs`, `tiny-grazing.mjs`, and the pre-change copy `render3d.before.js.txt`
- `/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/renderer/` — `tex-demo.txt`, `tex-demo.json`, `tex-dpr1-contact.png`, `tex-dpr2-contact.png` and the single pictures
