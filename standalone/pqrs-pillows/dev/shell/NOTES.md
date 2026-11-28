# shell: notes (Fri 27 Nov 2026, 16:02 – 16:49)

Owner of `src/page.js`, `src/page.template.html`, `src/page.css`, `src/cards.js`, `src/pattern-glue.js`, the build
into `site/index.html`, and (the spec's test rule: one file a module, the module's owner) `test/cards.test.js`,
`test/pattern-glue.test.js`, `test/page.test.js`. Everything else in `dev/shell/` is scratch.

## For the integrator

1. **Tutorial: still to paste.** `src/page.template.html` holds ONE placeholder line between
   `<!-- TUTORIAL:BEGIN -->` and `<!-- TUTORIAL:END -->` (inside `<section id="tutorial" class="tut">`), as my task
   said. Paste `src/tutorial.html` there, then `npm run build`. `test/page.test.js` pins the two markers.
2. **`site/index.html` as I leave it (built 16:45) already HAS the tutorial**, pasted at build time into a copy of
   the template (`node dev/shell/build-dev.mjs --site --tutorial`; `src/` untouched), because the gate
   (`tools/check.mjs`) fails a page without it. After step 1 the plain `npm run build` gives the same page. The plain
   SPEC 2.2 command was also run as it is (16:22, 16:28: built, 380 to 383 kB without the tutorial); it passes the
   build's own refusals either way.
3. **Rebuild last.** `site/index.html` holds the other owners' modules as they were at 16:45 (`state.js` 16:45,
   `solver.js` 16:42, `surface-model.js` and `surface-pane.js` 16:41, `print3d.js` 16:35, `tutorial.html` 16:30). They were
   still changing; three of THEIR node tests failed when I ran the whole folder at 16:33 (print3d: "overlapping commas
   are baked as their union"; surface-model: "the world frame", "2223: a flip keeps the surface"; 101 of 104 passed).
   Mine pass. The build before that one (16:34) is kept as `dev/shell/site-1634.html`.
4. **The Surface switch:** `const SURFACE = true;` near the top of `src/page.js`. `false` shows the quiet
   "surface loading" line; everything else works (checked with `node dev/shell/build-dev.mjs --off` →
   `dev/shell/index-off.html`: a link opened, a card activated, a Twist set, no error). A failure INSIDE the three
   modules does not break the page either: the pane then says "surface not drawn for these numbers", the next change
   starts cold, and after six failures in a row the surface is left off (`window.__pqrs.surface()` has `error`, `fails`).
5. **Contract, pane (SPEC 3.4 reads otherwise):** the chart is an OPTION of `showFrame`
   (`pane.showFrame(frame, { uv, labels, render })`), not a field of the frame; `page.js` follows the pane's file.
6. **The turn after a flip ignores the model's `shift`.** `sm.flip` returns `{ turn, shift, cold }`; `pane.turn` takes
   a rotation only, so `page.js` calls `pane.turn(turn, 0.5, { inverse: true })` and the solid starts its turn with
   the small jump the surface owner's notes describe (up to about 0.3 of the frame radius). Needs `turn` to take the
   shift, or the model to pose about a point the flip keeps.
7. **Print policy in `page.js`:** bake, then `chartOf` (print3d folds with the state baked last). At rest 1024 px at
   once; under a drag 512 px every frame while a bake is under 12 ms (measured here: 3 to 9 ms), else at most every
   90 ms with the chart kept between bakes; the 1024 px bake 200 ms after the last change. After any change that is
   not a drag, and at the end of a drag, the solver is let settle on idle frames (`sm.settle(8)`, at most 30 frames,
   stopped when the mean stretch moves under 2e-5).
8. **The second pair's orange marks in the Pattern pane are a hack on the model.** The pane paints a corner class
   `#0072B2` when its `kind` is `'cone'` and `#D55E00` otherwise (`pattern-ext.js` drawMarks, `pattern-gl.js`
   isCone), so `pattern-glue.js pairModel` hands the second pair's two classes over with `kind: 'cone-far'`, on a COPY
   of `A`. If a fast-forward makes the pane read `kind` anywhere else this breaks; `test/pattern-glue.test.js` holds
   the model and the browser checks hold the picture.
9. **Card names:** a card always writes the pair with P first (`P3 S3 | Q3 R3`), so its name never changes sides;
   the two DOTS say which pair is blue and larger (state.js `pairs[0]`) and which orange. The table and the key
   write a pillow's two cone points in the order P, Q, R, S (state.js lists them in slot order).
10. **A finger on an inactive card's slider** does not activate the card at pointerdown (it may be scrolling the
    page across the cards): the slider's first movement does. A mouse activates at pointerdown, as asked.
11. **`cards.js` holds a Length slider's range while it is held** and tells the page (`onInput(key, { L },
    { dragging, range })`), which passes it to `withNumbers(…, { lRange })`: state.js's range follows the number.
12. **Twist text uses a true minus** (U+2212, state.js `twistText`). For machines: every `output.pq-sval` has
    `data-value` with the plain number, and `window.__pqrs.shown()` returns numbers.
13. **`html, body` do NOT hide horizontal overflow**: anything too wide shows as a sideways scroll and in the checks.
14. **The tab is not in the address** (a link `#tutorial` opens the Tutorial tab on 3333; nothing writes it).
15. Styles for the tutorial's classes (`.tut-sec`, `.tut h2`, `.tut-table-scroll`, `.tut-table`, `.tut-ref`) are in
    `src/page.css` (the words owner asked in `dev/words/NOTES.md`).

## What works (measured)

All browser numbers: headless system Chrome through Playwright on this Mac (an M4; WebGL on), on `site/index.html`
built 16:45. `node dev/shell/check.mjs site/index.html` (mine, output kept in `dev/shell/check.out.txt`): 90 `ok`,
0 `FAIL`. `node tools/check.mjs site/index.html` (the words owner's gate, output kept in
`dev/shell/words-check.out.txt`): 67 ok, 0 FAIL, 0 skip in 108 s (run 16:46). Both were also clean on the builds of
16:28 (mine; the gate failed only its two tutorial lines there, the tutorial not being in the page), 16:34 and
16:40. The numbers in the table are those of the 16:34 to 16:45 runs; they did not differ beyond what is said.

| What | Result | How |
|---|---|---|
| node tests of my modules | 22 tests pass, 0.64 s | `node --test test/cards.test.js test/pattern-glue.test.js test/page.test.js` |
| the build's refusals | passes: one script, one style, no outside URL | `npm run build` (380 kB), and with the tutorial (558.6 kB, 135 formulas typeset) |
| nothing wider than the screen | scrollWidth = window width, and no element's right edge beyond it | 1280×900, 1024×700, 390×844 (dpr 2, touch), Play and Tutorial |
| both panes together | 1280×900: two panes 584 px each, the cards' foot at 868 px; 1024×700: panes 486 px each, the cards' foot at 690 px; phone: panes 180 + 180 px side by side, and scrolled to the panes the three cards end at 735 of 844 px | bounding boxes; `shot-desk.png`, `shot-small.png`, `shot-phone-panes-and-cards.png` |
| tap targets, field text | every visible button, input and card header at least 44 px both ways; field 16 px | computed boxes, all three windows |
| WebGL path of the Pattern pane | `pattern.state().gl === true` on 3333, 2223, 2345, 4444 and a typed 2346, also after each of 3 activations; 2222 is canvas 2D (the plane, by design) | 1280×900 |
| **stillness, 3333** | the pattern first slid by a drag, then six header clicks in a row (02\|13, 03\|12, 01\|23, 03\|12, 02\|13, 01\|23): **0 of about 3,400 grid nodes changed tone** each time (64 × 64 nodes over the middle 70 % of the pane; nodes on a line or mark left out); over EVERY pixel of the pane, **0 of about 100,000 print pixels changed tone** (paper ↔ comma); about 1.5 % of them changed value at all, by at most 21 of 255, all within 2 px of a seal, the loop, a mark or a comma's edge (at least 3 px away from those: 0 of 56,652 changed value at all) | `check.mjs`, the three windows (phone: 0 of about 2,800 nodes, 0 of about 11,500 pixels) |
| stillness, the other presets | 2222, 2223, 2345, 4444, three activations each from the defaults: 0 of about 1,900 nodes (48 × 48 grid) changed tone in each | 1280×900 |
| the gate's own measure | (words owner's) one device pixel of shift reads 1.73 % (3333), 2.58 % (2345), 2.36 % (2222) at 1280×900; every activation read 0.00 % of about 340,000 print pixels (phone: of about 33,000) | `tools/check.mjs` |
| **a Twist drag moves all three cards** | a mouse drag of the active card's Twist thumb, 3333: PQ\|RS L 2.634 → 2.634, tw 0.000 → +0.134; PR\|QS L 2.634 → 2.740, tw 0.000 → −0.125; PS\|QR L 3.850 → 3.342, tw +0.250 → +0.238 | real pointer events, 1280×900 (1024: the same pattern; phone: by the input event) |
| an inactive card's slider grabbed at once | pointerdown makes the card active with the print still (0 of about 2,000 nodes), the same gesture drags it (Twist −0.125 → +0.039) | real pointer events |
| keys | ArrowRight on a focused Twist slider: +0.010 | keyboard event |
| typed orders | `2346` opens (labels P2 Q3 R4 S6); `2a46` and `23456`: one line under the field, the pane's top did not move by a pixel, the state stayed | 1280×900 |
| journey | Part → "two pillows" (left button Join, right Unzip), Unzip → "open crowns" (left Zip, right off), Zip, Join back; `&j=` in the address | clicks, all three windows; `shot-j1.png`, `shot-j2.png` |
| address | reopening the written address restores orbifold, active card and the three cards' numbers | a second page, all three windows |
| cost | a slider step 7.8 to 8.6 ms of script (median of 12, in each of nine runs; worst single step 10.7), an activation 28 to 40 ms, a print bake 3.3 to 4.4 ms | `performance.now()` round `window.__pqrs.set` / `.activate` |
| console | no console error, no page error in any run | |

Pictures looked at (in `dev/shell/`): `shot-desk.png`, `shot-small.png`, `shot-phone-panes-and-cards.png`,
`shot-flip-twist.png` (PR|QS active at Twist 0.2: marks, seals, cards and the solid all follow), `shot-j1.png`,
`shot-j2.png` (the two open crowns), `shot-2222-quarter.png`, `shot-2345.png`, `shot-tutorial-desk.png`,
`shot-tutorial-phone.png`, `shot-off.png` (Surface off), `check-*.png` (full pages and every preset), set beside
`shots/sibling-real2222.png` and `shots/tfth-3333-desktop.png`.

## How to run

```
cd standalone/pqrs-pillows
node --test test/cards.test.js test/pattern-glue.test.js test/page.test.js     # 22 tests, under 1 s
npm run build                                   # site/index.html by the SPEC 2.2 command (shell owner / integrator only)
node dev/shell/build-dev.mjs [--site] [--tutorial] [--off] [--no-minify]
        # default out dev/shell/index.html; --site: site/index.html; --tutorial: src/tutorial.html pasted at build
        # time; --off: the Surface's three modules replaced by stand-ins; a module missing in src/ gets a stand-in too
node dev/shell/check.mjs [file.html] [--shots]  # my browser check; default dev/shell/index.html; pictures check-*.png
node dev/shell/shots.mjs [file.html]            # the pictures shot-*.png
```

`window.__pqrs` (for checks and the console): `state()`, `cards()` (numbers from state.js), `shown()` (what the
cards show), `pillows()`, `open('2346')`, `activate('02|13')`, `set({ L, tw }, { key, dragging })`, `journey(j)`,
`tab('tutorial')`, `flush()`, `pattern` (the createPattern object: `state().gl`, `getView()`, `readPatch()`),
`patternGrid(n, reach)` (the print's tone, 'p' paper / 'i' comma / 'o' other, at an n × n grid over the middle of the
pane), `patternPixels()` (ImageData of the pane, WebGL canvas and overlay together), `surface()`, `pane()`, `model()`.
Sharp edge: a grid taken while the pattern still coasts after a drag shows the coast's motion (my first run failed on
that; the check now waits for the view to rest).

## Not done / ideas left

- The tutorial is not pasted into the template (integrator, item 1).
- The Surface pane's "Drag to turn" hint sits in the pane's lower left corner (the solid can reach the pane's foot:
  at 1024×700 the centred hint lay over the label of the lowest cone point); it goes at the first touch of the pane,
  of a card or of the journey, and is not shown on a phone.
- The turn after a flip starts with a small jump (item 6).
- No tap-on-a-mark pick (SPEC 1.4: none in v1); `onPick` is not used.
- The Pattern pane has no full-screen button (Two features, two handles has one).
- No "Reset numbers" button: a tap on the pressed preset chip returns to the engine's defaults.
- Only the active loop is drawn on the pattern. A faint line for an inactive card's loop while its card is hovered
  would tie cards to curves; `card.seg` is there for it; it costs line instances of the WebGL path (128 a tile).
- The Length sliders are linear in L (Two features, two handles' is logarithmic).
- Dark mode: only what the imported style sheets do. The cards, key and table use their variables; the pair dots
  in the DOM go lighter in the dark while the pattern's and the solid's marks keep `#0072B2` / `#D55E00`.
- Not tried on a real phone or in Safari; the phone numbers above are a 390 px touch window on this Mac's GPU.
