# Klein bottle (xx = pg): the judge's decision

Mon 9 Nov 2026, about 23:00. The owner's complaint: "the side of the thing which houses the glide reflection is just empty,
so it's not clear why I need to do this complicated thing for the glide reflection."

## Decision: design A in full

Take design A ("seam-crossing comma", `dev/klein-a/`) in full: the comma placed across the glide seam, the comma filled
in 3D, and the twist phase 0.5. There are four small changes on the way in (see Plan). Do not take B or C. Both stay in
`dev/` as fallbacks.

## Why

The main question was whether he would see why the glide forces the complicated closing. A answers it in both panes,
using only the comma the app already draws:

- **Plane, t = 0.** The glide-sewn (orange) edges now carry something. A comma straddles the top edge, and its mirror
  image straddles the bottom edge, on the other side of the glide axis. The tile holds the round of the head at the top,
  and the mirrored curl at the bottom-left, in the half that used to be empty. That is the glide acting on one object.
- **3D.** The two grey pieces ride at the two open ends of the tube, on different lobes of the 8 (t of about 0.76 to 0.9).
  The end holding the head keeps its 8 upright. The other end visibly turns over (phase 0.5), and at t = 1 the pieces are
  one comma across the orange 8. The half turn, and with it the figure 8, is what joins the comma.
  See `qa/klein-judge/a-closing-default.png`, `qa/klein-a/cmp-film-p0-default.png` and
  `qa/klein-a/v5-xx-t1-az-70-el25.png`.

What the change costs:

- It adds no controls, no text and no new colour concept, and the plane code is untouched.
- The other 16 groups are bit-identical (A's `compare-groups.mjs`).
- The mathematics is unchanged. The seam gap at t = 1 is 2e-16, and at(1) stays glide-invariant with phase 0.5 (1e-9).
- The cost per rebuild is about 220 vertices and 0.7 ms.
- No coordinates change, so links made by the URL-state work (owner's second ask, SPEC §7) stay valid.

Re-checked here on aifoundry1 against A's copy (klein-a, roll, motif and folds suites): 69 of 70 pass. The one failure
is the expected ghost-colour contract (`test/folds.test.js` about line 829).

## Rejected

- **B, two-sided colour (sand back).** It is a correct and well-tested idea. But it adds a colour convention that needs a
  caption phrase, and it changes the plane and 3D look of three groups (xx, \*x, 22x). Sand seen through teal turns
  khaki, and the lobe stays empty of any motif. In the default view the colour switch runs into the screen. It reads well
  only in `turned.html`, which rotates xx's coordinate frame. That reverses the roll owner's choice, needs the
  hard-coded xx seeds in the tests rotated, and would invalidate seeds in URLs. Keep `dev/klein-b/design-b-colour.patch`
  as the fallback if he still asks "why" after seeing A.
- **C, the classic bottle.** It is the iconic shape and its closed form is exact. But it is a new fold, and the complaint
  was about emptiness, not about the shape. It also brings:
  - strong distortion (neck 0.45x, body 1.82x);
  - three roll tests to rewrite;
  - speed bounds met with almost no margin (0.0245 against 0.025);
  - a confusing stretch around t 0.85 to 0.95, where the neck passes through the body twice;
  - in the default view, a kettle-like closed shape on which the comma is small and seen at a slant. On the thin neck
    the curl piece is barely visible (`qa/klein-judge/c-closing-default.png`).

  Its 3D comma tint is per vertex, so the edge is blurred; A's split of the mesh along the outline is exact.

## Known weak spots of A (accepted)

- At t = 1 in the default view the seam lies at the ring's far left, so the joined comma is seen at a slant. It reads as
  a grey patch across the orange 8, and fully when the view is turned (az -70). The closing frames show the story best.
- With the Hexagon preset the roof cuts the comma into 4 or 5 pieces, one of them a tiny sliver. With a dragged seed the
  comma lands wherever the cut leaves it. That is correct, because the pattern is fixed and the cut moves over it.
- The comma is filled in 3D only for xx. Filling every group's comma would be a look change for all 17 groups, so it is
  not part of this change. Offer it to him later if he likes the filled comma.
- The klein fold dips below z = 0 by 1.1e-5 tile sizes at t of about 0.385 (it was already 6e-6 in v1). This is
  invisible.

## Plan, acceptance and owners

They are the same as in the structured answer returned to the orchestrator. In short:

| Files | Owner | What |
|---|---|---|
| `src/motif.js`, `src/folds/roll.js`, `src/palette.js`, `test/motif.test.js`, new `test/klein.test.js` | Klein work | port from `dev/klein-a/src/` |
| `src/app.js` (3 hunks), `test/folds.test.js` (1 assertion) | ui-app | request in `notes/klein.md`; merge after the URL-state change lands |

`src/motif.js`, `src/app.js`, `src/folds/roll.js` and `src/palette.js` are byte-identical to A's base snapshot today,
so the hunks apply as they are.
