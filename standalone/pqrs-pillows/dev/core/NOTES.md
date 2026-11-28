# core: notes (src/state.js and the tests of the three pure modules)

Owner "core" of SPEC § 2. Fri 27 Nov 2026, 16:02 to 16:50. STATUS: done for this round; all three test files pass.
Every number below was measured today with the script named beside it (all in this folder or in `test/`).

## Files

| File | What | State |
|---|---|---|
| `src/state.js` | SPEC § 3.1: presets, typed orders, cards, activation, numbers, address, pillows | written, tested |
| `src/flips.js`, `src/pillow.js` | seeded from the prototypes | unchanged: no bug found |
| `test/state.test.js` | 14 tests, 7.5 s | pass |
| `test/flips.test.js` | 11 tests, 0.63 s: 360 seeded states, a port of `proto/flips/check.mjs` | pass |
| `test/pillow.test.js` | 14 tests, 0.55 s: a port of `proto/pillow-math/check.mjs` | pass |
| `dev/core/fuzz.mjs` | random sessions (sliders, flips, reloads through the address) against the invariants | seeds 1 to 7 clean |
| `dev/core/measure.mjs`, `probe-drag.mjs`, `probe-leave.mjs`, `probe-quarter.mjs`, `smoke.mjs`, `try-state.mjs` | the numbers quoted here | scratch |
| `dev/core/patch*.py`, `state.before-sticky.js` | the edits of this round as scripts, one snapshot (history only) | scratch |

Run, from `standalone/pqrs-pillows`:

```
node --test test/state.test.js test/flips.test.js test/pillow.test.js      # 39 tests, 39 pass
node dev/core/fuzz.mjs 60 40 1                                             # sessions, steps, seed: "no invariant broken"
```

## What state.js gives (beyond the contract's names)

- `stateFor(text)`: four digits 2..9 only (spaces, commas dropped); anything else is `null` and never reaches the
  engine's family registry. The state is the engine's: `{ k, perm, orders, L, tw, b: 0, tau: 0, thetas, print: null }`.
- `cardsOf(state)`: the contract's fields, and `dir` (2222: the loop's direction; `ends` is null there), `onTree`
  (`'picked' | 'far' | null`: a pair of 2s on that side), `id` (`'cut' | 'lo' | 'hi'`), `index`, `perm`, `orders`
  (the slots and orders of the state the card leads to). `pairs[i]` is sorted by feature number; `seals[i]` is an
  arc between the two cone points of `pairs[i]` (seals[0] blue, seals[1] orange when the card is active).
- `activate(state, key)`: also returns `Q`. A bad key throws (`/no such partition/`).
- `withNumbers(state, { L, tw }, { lRange })`: the optional third argument is a range a slider holds through a drag.
- `toHash(state, ui)`, `fromHash(text)`: `ui = { j, az, el }`; `DEFAULT_UI = { j: 0, az: -20, el: 14 }`.
- `pillowsOf(state)`: the contract's fields, and `angles`, `least` (loop to seal), `areaOverPi`, `rim`, `excess`, `kind`.
- Also exported: `CARD_KEYS`, `DEFAULT_UI`, `keyOf(state)` (the active key), `featureLabel(state, f)` (`"P3"`),
  `lengthRange(kind, L)`, `lengthText(L)` (`"2.634"`), `twistText(tw)` (`"+0.250"`, `"−0.125"`, never `"-0.000"`).

## Which loops the two inactive cards show: WHERE THIS DEPARTS FROM SPEC § 1.3 (for the orchestrator)

The spec: the triangle is carried across flips and "lapses by itself when a slider moves" (then the natural
triangle: in each pairing the shortest loop that meets the cut twice). Built so at first; two things then showed in
the numbers, and `withNumbers` now carries the triangle on (in `state.tri`, re-stamped at every move):

1. **The far pairs' naming is carried.** By flips.js's rule alone each inactive card's far pair is named afresh at
   every state so that its Twist is within a quarter turn, and the card's Twist then JUMPS BY HALF A TURN whenever
   it passes a quarter turn: 4 jumps over one Length drag of 3333 at Twist 0.05, 12 over one Twist drag at Length 6
   (`probe-quarter.mjs`). Carried: none; the Twist runs through [-1/2, 1/2] and wraps by a whole turn at the ends
   (`probe-drag.mjs`; `test/state.test.js`: 42 drags of 1,000 steps, no jump by half a turn, 26 wrap somewhere).
2. **The loops are carried too, except at a crossing.** A slider move keeps the three loops; a card's loop gives
   way to its twin only where the cut's Twist passes the value at which the two are equally long (its Length
   continues, its Twist changes sign: the spec's sentence). From a natural triangle that is exactly the natural
   triangle at every move (Twist 0 is the crossing), so every preset behaves as the spec says. The difference: a cut
   that is LONGER THAN ITS TWIN when it is left. By the lapse its card would drop to the twin at the first move of
   another card's slider (3333 at Length 4.1, Twist 0.2: 4.100 @ +0.200 became 3.707 @ −0.190; measured before
   the change). That is no corner: the cut is longer than its twin at 0 of 401 Twists at each preset's own Length,
   at 186 of 401 at 3333 Length 4.1, at 386 of 401 at Length 7, at 314 of 401 at 2222 Length 1.8 (`measure.mjs`).
   Now the card keeps its loop (`probe-leave.mjs`: 4.100 stays 4.100; 7.000 @ +0.250 goes on to 7.005, then 9.141
   as the other card's Twist moves by 0.3, and is 9.141 when it is made active again).
   One bound: a loop longer than its twin is kept only up to Length 16 (2222: 5), the longest cut the page allows;
   beyond it the twin takes its place. Without the bound the fuzz carried cards to Lengths of 92.
   To return to the spec's letter: in `continued` (state.js) put flips.js `naturalIndex(next)` in place of
   `carriedIndex(...)` and drop the loop with `cap`; `dev/core/state.before-sticky.js` is a snapshot of that version
   (to read: its imports are written for `src/`; and the two
   test blocks that then change are in `test/state.test.js`, "the three loops go on" and the round-trip test).

## For the integrator

- `state.tri` is there after a slider move too, not only after a flip. Nothing should read it but flips.js; the
  address writes it where needed.
- **Pale colours change places.** A card's `pairs[0]` (the pair that turns blue) is NOT always the pair with P:
  3333 opens with card `03|12` as `[[1, 2], [0, 3]]` (Q, R to be picked; the shell's screenshot shows it: orange dot
  on P3 S3), and when the active Twist passes 0 the `pairs` of BOTH inactive cards change places (`measure.mjs`:
  Twist +0.01: `[[0,2],[1,3]]`, `[[1,2],[0,3]]`; -0.01: `[[1,3],[0,2]]`, `[[0,3],[1,2]]`). It is true to what a
  click then does (which pair goes below in space), but it reads as a blink. Not fixed: "Ideas" 1.
- 2223 opens on its third card: the engine's default cut for 2223 is PS|QR (`m=3012`).
- A flip leaves the Length slider's own range in ordinary use: 3333 at Length 0.4 shows 9.243 and 9.264 on the
  other two cards, at Length 7 it shows 0.713 (`measure.mjs`). A card's `lRange` follows its number
  (`lengthRange`: `[0.4, max(7, 1.08 L)]`, 8 % under a Length below 0.4, the 8 % stopping at 0.05 and 16), so a
  slider takes its range from the card at every refresh and holds it while it is dragged (pass that range as
  `withNumbers`' third argument: the shell does).
- Costs (`measure.mjs`): `activate` 12 to 23 ms (the engine's `retiePrint`), `withNumbers` 25 microseconds,
  `cardsOf` 11, `toHash` 25 to 28, `pillowsOf` 1.1, `fromHash` 1.7; `fromHash` of a link to another pair 18 ms the
  first time (the engine's `linkedPrint`); `stateFor` of a signature not seen before 40 ms.
- After a flip to a card whose Twist is 0 the state's `tw` can be -1e-16: print Twists with `twistText`.
- `fromHash` returns `null` only when `k` is there and is no four cone points; with no `k` at all (`#`, `#tutorial`,
  `#j=1`) it is 3333 at the defaults. A view missing from the address comes back as `DEFAULT_UI`'s.
- The address carries `tri` where a reload would otherwise show another loop or another naming on an inactive card:
  21 of 32 flipped states of the test file; 13,524 of 16,800 states of the fuzz (its sliders jump at random).
  Flip there and back at the defaults writes `#` again. `toHash(fromHash(h).state)` is `h`: 1,662 reloads in the fuzz.
- A reload rounds the cut to 3 and 4 decimals: the inactive cards come back within 4e-3 (Length, relative) in the
  test file's states; in the fuzz the worst was a loop 0.13 long beside a cut 6.85 long, whose Twist came back
  off by 0.03.
- The flip carry of SPEC § 1.4, checked on the exact charts in `test/pillow.test.js` (last test): a point (s, theta)
  of the NEW state's chart lies on the OLD pillows at
  `toPillow(gOld, invH(PmatOld) * r.invQ * PmatNew * fermiToHyperboloid(s, theta))`, with `r = activate(...)` (or
  flips.js `flip`), `Pmat` from `fourConeCentered(orders, L, tw, { k: '3333' })`. Measured over 8 flips of 4
  states: the four new cone points land on the old ones to 2.3e-14; the two chart points of a new seal point are one
  old point to 1.9e-9; the new loop closes on the old pillows to 6.3e-13 and crosses the old loop exactly twice.

## Measured by the tests (the largest value of each line; the files print them)

- state: flip and back 3.1e-15, three round 2.2e-15 (16 states); a card's numbers across a flip 3.1e-15; the
  triangle's face across a flip 2.3e-14; a card against the flip to it, after a move: 0 (90 moved states).
- flips, 720 flips of 360 states, 647 "in range": a new cone point off the old ones 2.3e-11; a new turn moves an old
  cone point off the old ones 1.3e-10; a comma 2.6e-11; flip and back: L 2.3e-14, tw 2.9e-14; three round: L 2.4e-14,
  tw 3.8e-14; the cubic's residual 1.1e-15 (Heron on the plane 5.3e-16); a twin against the other root 1.5e-14.
  The engine's own re-cut takes the same loop in 650 of 650 and fails to come back in 180 of 650: exactly the
  states whose cut is longer than its twin. The page's print after a flip and the engine's re-tie: 3.5e-13.
- pillow: heights against the engine 7.0e-16; the seven relations 2.2e-14; Gauss–Bonnet by quadrature 4.0e-14; the
  crown's first fundamental form 1.1e-8 (central differences); home points 1.4e-12; 11 states at three mesh sizes
  closed with Euler characteristic 2, areas to 2.0e-14, cone angles to 1.1e-14; 300 random meshes likewise
  (3.2e-14 relative, 3.9e-13).
- fuzz, seeds 1 to 7: 16,800 steps, 2,512 activations, 1,662 reloads, no invariant broken; Lengths on the cards
  0.0171 to 15.947. (Seed 11, run last: clean too; a card as short as 0.003 there, beside a cut near 16. A cut
  under 0.05, which only a flip onto such a card gives, would reload at 0.05: the address clamps there.)

## Not done / not covered

- The 2222 mesh on the exact solid (prototype checks [5b], [6h]) is not in `test/pillow.test.js`: it needs
  `src/flat2222.js` (the surface owner's file and test).
- Nothing here ran in a browser: state.js has no DOM. (I looked at the shell's `dev/shell/shot-phone-panes-and-cards.png`:
  the cards show these numbers, 2.634 @ +0.000, 2.634 @ +0.000, 3.850 @ +0.250.) The shell built against the
  version before rules 1 and 2: the calls and fields are the same, but nobody has looked at the page with them.
- States a hand-written address makes with P in the far pair (`m=2301`) are taken as they are.
- A cut left at exactly the top of what the page allows (Length above 16) is not kept: by the bound.

## Ideas, not built (the clock)

1. **P's pair always the picked one.** Give every flipped state the name in which feature 0 is in the picked pair
   (all five presets open that way), so that every card's first pair is the blue one, the pale colours never change
   places, and P's pillow is always the lower one in space. The other name of the same marked shape is `dcba` at
   the SAME Twist (engine.md fact 5); its four home points are the same four points, its loops keep their numbers
   in the fan (derived, not tested). Safest route: let the engine do it (`recut(state, c, d)` on the far pair gives
   perm, thetas, Q, invQ; hyperbolic only, the flat re-cut may change the cut), then find `tri` by search: the
   `(k, lo, hi)` whose three cards have the Lengths and Twists (up to whole turns) they had; fall back to the
   unchanged state if none matches. It needs the orbit walk of `test/flips.test.js` in the state tests (cone points
   and commas on the old orbits), which is why it was not rushed. Flip and back may then return `badc` of the
   start (the same numbers, the pair's two points named the other way round).
2. A quiet mark on a card whose loop is longer than its twin (`minimal: false`): the reader can then see that a
   shorter loop of that pairing exists. (The twin move as a control is out of scope, SPEC § 5.)
3. More decimals in the address beside a long cut (`l` to 5, `tw` to 6 where L > 5) would bring the reloaded cards
   back closer; SPEC § 1.7 fixes 3 and 4.
