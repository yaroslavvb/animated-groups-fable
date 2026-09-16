# Plume Monochrome

Plume in black and white only. Same verified orbit, same WebGL 2 viewer with
endless finger panning, pinch and scroll zoom, adaptive resolution and frame
statistics, same framing and eight-second loop as `../plume/` (see its README
for the data provenance, interpolation and controls); `app.mjs`,
`renderer.mjs` and `field.f32` are byte-identical copies, and `index.html`
selects the style with `data-style="monochrome"` on the canvas.

Instead of colouring U, the page draws the sign of

    w(x, t) = U(x, t) − U(−x, t),

white where the pattern exceeds its own half-turn image and black where it
falls short, with the zero contour anti-aliased over one device pixel. The
half-turn is taken about the lattice origin, which the home view places at
the screen centre (and, one repeat away, at the corners of the source page's
2 L × 2 L window).

The saved orbit satisfies U(−x, t) = U(x, t + T/2) and U(Rx, t + T/4) = U(x, t)
for the quarter turn R (both hold exactly on the saved samples; see the tests).
Therefore the monochrome animation

- is reproduced exactly by a quarter turn together with a quarter-period shift;
- has black and white swapped exactly by a half turn, by a half-period shift,
  by a quarter turn with a three-quarter-period shift, or by a three-quarter
  turn with a quarter-period shift.

That is: rotate it, shift it in time, and reverse its colours, and you see the
same animation. These are the colour-reversing (antisymmetry) operations of a
two-colour spacetime group; the plain colour-preserving ones are the quarter
turn with quarter-period shift and its powers.

Regenerate the social assets while the local server is running:

```sh
node tools/export_ember_social.mjs http://localhost:8934/scott-gray/plume-monochrome/ docs/scott-gray/plume-monochrome 1 plume-monochrome-preview.mp4
```

Validation and deployment from the repository root:

```sh
node --test docs/scott-gray/tests/plume-monochrome.test.mjs
node docs/scott-gray/tests/plume.browser.mjs http://localhost:8934/scott-gray/plume-monochrome/
npx wrangler pages deploy docs/scott-gray/plume-monochrome --project-name plume-monochrome --branch main
```
