/** A two-line shim, and the reason for it.
 *
 * `momentum.mjs` in this directory is a **byte-identical** copy of
 * `../scott-gray/trefoil/momentum.mjs` (which is itself byte-identical to the
 * `gyre/` and `triskele/` copies — checked). Keeping it byte-identical is worth
 * something: the glide is subtle, heavily commented and tested on three pages,
 * and a diff of four files that says "no difference" is a stronger statement
 * than a diff that says "one import line". Its one dependency is
 *
 *     import {snapAngle, wrapAngle} from './renderer.mjs';
 *
 * so this directory supplies a `renderer.mjs` that forwards those two functions
 * to the generalised renderer. Nothing else imports this file.
 */
export {snapAngle, wrapAngle} from './colour-renderer.mjs';
