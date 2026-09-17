# Chair tiling

An interactive view of Chaim Goodman-Strauss's marked chair: one three-dimensional
tile — a 2×2×2 cube with one of its eight cells taken out — whose 24 unit facets
carry three kinds of arrow, and the hierarchy of supertiles those arrows force.

Live: <https://chair-tiling.pages.dev/> · also served from this repository at
`/chair-tiling/`. The page is marked `noindex`: it reconstructs an unpublished
idea and should not turn up in search results. The `og:` tags name the
pages.dev copy deliberately — that is the link this page is shared by; the
GitHub Pages copy is the one that lives in version control.

Self-contained static folder, no build step, no network at runtime, WebGL 2,
one instanced draw call.

## Provenance

The construction was explained by **Chaim Goodman-Strauss in conversation on
17 September 2026** (unpublished) and is reconstructed here from a photograph of
his hand sketch; errors are ours.

The marked tile is **chiral**: a marking and its mirror image are different
objects, they satisfy every statement below equally well, and only the drawing
says which one CGS meant. The first transcription of the photograph interchanged
x and y, so the first version of this page drew the mirror image. It has been
re-read against the axes CGS wrote on the photograph himself — *+x* to the lower
left, *+y* to the right, z upright — and corrected: in the pit, the hollow purple
V is on the left wall and the solid head on the right. `verify/tiling-spec.md`
opens with the correction and §6 shows the two candidates side by side.

* `verify/tiling-spec.md` — the reconstruction and its computer checks, including
  a section headed *What is not proved*.
* `verify/marking.json` — the machine-readable result: 24 facets with their marks
  and marked corners, the 8 substitution frames, the 44-pose contact atlas, the 7
  notch fillers, and the map onto I. Tsiokos's panel IDs.
* `verify/*.py`, `verify/runall.sh`, `verify/runall.log` — the scripts that produced
  it (pure `python3`, no dependencies, about 3½ minutes end to end) and the log of
  one full run. `verify/index.html` indexes them. The one external input they need,
  a transcription of I. Tsiokos's paper, ships beside them as
  `verify/tiling-matching-system.json`, so the bundle runs as it stands — note that
  `export.py` **overwrites** `verify/marking.json` in place.
* `marking.data.mjs` — **generated** from `verify/marking.json` by
  `node tools/make-data.mjs`; the page inlines only the 24 facets and the 8 child
  frames so that it needs no fetch. Do not edit it by hand.

The tile, the eight-child substitution and the recognition-of-the-central-child
argument are the n = 3 case of C. Goodman-Strauss, *An aperiodic pair of tiles in
Eⁿ for all n ≥ 3* ([preprint](https://strauss.hosted.uark.edu/papers/Newpaper.pdf),
EJC 20 (1999) 385–395) — this page shows them; the *marking* is what is
reconstructed here. The comparison with the contact atlas of I. Tsiokos,
*A Strongly Aperiodic Monotile in Three Dimensions*
([Zenodo, 2026](https://zenodo.org/records/22792358)), is what the verification
section rests on for its two external claims. Meeting notes:
<https://yaroslavvb.github.io/animated-groups-fable/reports/symmetry-meeting-notes-week-38/>.

## What the page shows

The **level-n supertile**: the chair at scale 2ⁿ, cut into 8ⁿ unit chairs by the
substitution. The home view is orthographic, looking down the (1, 1, 1) body
diagonal into the dent, which is the viewpoint of the sketch: the bounding cube's
silhouette is a regular hexagon, the three visible faces are congruent rhombi, and
the notch is a hexagonal pit in the middle.

Each mark is drawn along its facet's own diagonal, pointing at the marked corner,
so the two purple quarters of one 2×2 face read as a single bar with a solid head
at one end and a hollow head at the other — as in the sketch. Marks are drawn
procedurally in the fragment shader from the facet's (u, v) frame, so they cost no
geometry and stay crisp at any zoom; they fade out when a facet gets too small to
carry one.

Because the dent's walls have the same normals as the outer faces, no amount of
lighting can tell a pit from a bump. The page uses aerial perspective instead:
everything darkens with distance along the view axis.

Chairs are drawn very slightly shrunk about their own centroids, so there is a
visible seam between them. The gap is a fixed distance in world units, which
falls below a pixel as the supertile grows, so it widens in proportion with the
level (to a cap of 7.5%) — otherwise level 5 in plain colouring is level 0 with
a texture on it.

On a window wide enough for the caption to sit beside the object rather than
over it, the panel opens by default and the object is framed in the strip of
canvas it leaves free, so the two never overlap. Below that the panel starts
collapsed as a chip.

## Controls

| | |
|---|---|
| orbit | drag, or one finger, or arrow keys (shift for bigger steps) |
| zoom | wheel, pinch, trackpad pinch, `+` / `−` |
| pan and turn | two fingers; trackpad twist |
| substitution level | `[` `]` or the −/+ in the bar; 0 to 5 (4 on small touch screens) |
| explode | `E` — pulls the sub-chairs apart at every level at once, so the middle one of each eight is visible; the camera backs off by the same factor the patch grows by, with a little margin, and keeps whatever zoom and viewpoint you had |
| markings | `M` |
| colouring | `C` — plain, by sub-chair of the whole supertile, middle chairs against corner chairs |
| reset view | `0` |
| fullscreen | `F`, or double-click |
| about panel | `I` |
| frame statistics | `S`, or `?stats=1` |

`?level=n` picks the starting level.

**Zoom is bounded** (about 1/7× to 90× of the home framing). Zooming into the dent
was *not* made endless. The tiling is exactly self-similar about the concave corner,
so an endless dive is possible in principle, but every honest version of it has to
make one more level of subdivision appear as the zoom passes a factor of two, and a
subdivision that pops in is worse than no dive at all. At level 4 or 5 you can
already zoom into four or five nested dents, which is the same picture. See
*Not done* below.

## Verification

`tools/check.mjs` re-runs, against the page's own JavaScript geometry, the two
statements the picture depends on:

```sh
node docs/chair-tiling/tools/check.mjs
```

* the 8ⁿ chairs partition the supertile 2ⁿ·C exactly, no overlaps, no gaps;
* every facet shared by two of them satisfies the matching rule — the two marks
  point at the same corner and their types are complementary.

It reproduces `verify/verify.py`'s contact counts (48 / 576 / 5376 shared facets at
levels 1 / 2 / 3, counted once each; the write-up counts them from both sides as
96 / 1152 / 10752), and 0 violations at every level.

Browser checks used while building: Chrome and WebKit, 1440×900 at dpr 2 and
390×844 at dpr 3, page loads with no console errors, canvas non-blank, every
control exercised.

## Not claimed

The page says this in its own caption, and it matters: **aperiodicity is not
proved**. Forcing is proved only as a local theorem — from the shell of neighbours
around a chair you can tell whether it is a middle one — and the induction to
aperiodicity is not formalised. The marks are blind to reflection, so homochirality
is imposed rather than derived, and registration (facets meeting square on) is
assumed. `verify/tiling-spec.md` §7.5 and §8 give the full list.

One drawing detail is a choice rather than a result: every arrow is drawn with
its head at the marked corner. What the matching rule uses is the pair
(type, corner), which is invariant under reflecting the facet in that diagonal
(§8.2), so nothing verified depends on which end the head is at — but the blue
arrowheads in particular are not clearly readable in the photograph, and the
page commits to a direction for them all the same.

## Not done

* **Endless zoom into the dent** — see above.
* **Interior culling.** Every chair draws all 24 of its facets whether or not a
  neighbour hides them. The depth buffer sorts it out, and level 5 (32 768 chairs,
  1.6 M triangles) is comfortable on a desktop GPU, but a facet mask per instance
  would cut most of that.

## Deploy

```sh
export CLOUDFLARE_ACCOUNT_ID=…
npx -y wrangler@latest pages deploy docs/chair-tiling --project-name chair-tiling --branch main --commit-dirty=true
```

## Files

```
index.html          page, meta tags, control bar, caption
style.css
app.mjs             controls, gestures, keyboard, framing
camera.mjs          orthographic orbit camera
renderer.mjs        WebGL 2: shaders, instancing, the mark glyphs
tiling.mjs          chair mesh and substitution — no WebGL, testable in node
marking.data.mjs    generated from verify/marking.json
manifest.webmanifest
tools/make-data.mjs generator
tools/check.mjs     partition and matching-rule check
verify/             the python that produced marking.json, its one data input,
                    and the write-up
social-preview.jpg  og:image, a screenshot of the level-2 home view
```
