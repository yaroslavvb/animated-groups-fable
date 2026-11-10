# Renderer notes (renderer agent, SPEC 5.8) — 2026-11-09

Files: `src/render3d.js`, `dev/render-demo.html`, plus `test/render3d.test.js` (the DOM-free parts: view quaternions,
camera fit, triangle sort, normals, layer probe, polyline packing), `dev/render-touch-check.mjs` (real touch input
on an emulated phone; run alone: `node dev/render-touch-check.mjs`) and the step files and pictures in `qa/render3d/`.
No change is requested in anybody else's file. The API is exactly SPEC 5.8; the full description is the comment at
the top of `src/render3d.js`. What the other agents need to know:

## For `dev/fold-demo.html` and `src/app.js`

```js
import { createRenderer, viewFromAzEl } from './render3d.js';
const R = createRenderer(canvas, { labelLayer });      // canvas is sized from its CSS box; a ResizeObserver follows it
R.setStyle({ front: SURFACE_FRONT, back: SURFACE_BACK, ghost: SURFACE_GHOST, opacity: SURFACE_OPACITY });  // = the defaults
R.setSurface({ positions, indices: mesh.tri, tint: mesh.tint });     // once per mesh
// every frame:
R.updatePositions(positions); R.setLines(lines); R.setMarkers(markers); R.setFrame({ center, radius }); R.render();
R.setView({ az, el });        // degrees; az 0, el 55 = the default view; R.setView(viewFromAzEl(az, el)) is the same
```

- The setters copy their input (reuse your arrays) and do not draw: call `R.render()` once per frame. If you never
  do, the renderer draws by itself on the next frame; it always redraws by itself while the camera moves.
- `setFrame` is eased (time constant 0.16 s) and may be called every frame; pass `immediate = true` when the scene
  changes (new group), so the camera does not glide between unrelated shapes.
- `setView`, `resetView` and the person's dragging are the only things that change the orientation. `R.getView()`
  gives `{ q, zoom }` if you want to keep it across a rebuild of the renderer (not needed otherwise).
- Triangles must be counter-clockwise seen from +z in the flat tile (as `mesh.tri` is): that side gets `front`.
- A marker's label is a `<span class="r3d-label">` at the marker's upper right, in `labelLayer`.
- `R.stats` has the CPU cost of the last frame (`normalsMs`, `sortMs`, `probeMs`, `cpuMs`).
- Dashes are painted on the surface (their length is a world length fixed by the first `setFrame`, or the last
  immediate one), so they do not crawl while the fold moves or the camera eases; `dash: [on, off]` in world units
  overrides the default. Lines fading out (`alpha` → 0) stay even: a translucent polyline has no beads at its joints.
- A line or marker lying on a sheet counts as visible; "hidden" means behind the nearest sheet by more than about
  the line's own width.

## For the fold agents (meshes)

- One or two overlapping sheets are drawn exactly, per pixel (also along a self-intersection line). So are three
  when the two hidden ones face opposite ways (a sheet folded back on itself). From four sheets on, the order of
  the hidden sheets comes from a per-triangle depth sort, which is only right when the sheets are apart by more than
  a triangle's size or when their triangles coincide.
- Snowflake: build every cell of the star by lifting ONE triangulation of T with the cell's isometry (as `mesh.js`
  does). Stacked layers then have coinciding triangles and the stack sorts exactly, whatever its height.
  `dev/render-demo.html?shape=zigzag` (aligned) against `?shape=zigzag&crossed=1` (not aligned) shows the difference.
- Flat pieces that must look flat (the star's cells): do not share vertices across a crease. Normals are smooth
  across shared vertices; the shader only falls back to the face normal where the two disagree by more than about
  20–35 degrees. Fine meshes welded across creases (the hinge meshes) are fine as they are.
- Keep triangles small compared with the scene (nothing wrong up to a few percent of its size).
