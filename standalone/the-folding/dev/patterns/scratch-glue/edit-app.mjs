// edit-app.mjs — the glue's edits of src/app.js, applied once (each must match exactly once; nothing is written otherwise)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app.js');
let s = fs.readFileSync(file, 'utf8');
const edits = [
  [`// THE PATTERN (13 Nov 2026; the owner: "use the Checkerboard choice … I want more of the surface to be covered with
// pattern … Maybe add a selector at the top which allows me to pick different patterns"). state.pattern is a key of
// pattern.js PATTERNS: 'checker' (the default), 'rings', 'comma'. A print ('checker', 'rings') is a two-tone pattern
// of the plane that the group leaves as it is: the plane shows it everywhere (setScene({ print })), the 3D sheet
// carries it as paper does, front teal and back sand, nearly opaque (the renderer evaluates it per pixel at each
// vertex's paper point: setSurface({ uv }), setStyle({ print })); no comma is drawn then. 'comma' is the picture as it
// was: one comma per tile on a translucent sheet. The hash carries it as pat=<key> when it is not the default.
`, `// THE PATTERN (13 Nov 2026; the owner: "use the Checkerboard choice … I want more of the surface to be covered with
// pattern … Maybe add a selector at the top which allows me to pick different patterns"). state.pattern is a key of
// pattern.js allPatterns(): 'checker' (the default), 'rings', 'comma', and the shape patterns that were registered
// (pattern.js registerPattern; the pattern round of 13 Nov). A print ('checker', 'rings', a shape pattern) is a
// two-tone pattern of the plane that the group leaves as it is: the plane shows it everywhere (setScene({ print })),
// the 3D sheet carries it as paper does, front teal and back sand, nearly opaque (the renderer evaluates it per pixel
// at each vertex's paper point: setSurface({ uv }), setStyle({ print }); a shape print through its distance texture,
// which printUniforms bakes once); no comma is drawn then. 'comma' is the picture as it was: one comma per tile on a
// translucent sheet; a registered pattern that has no print for a group (printFor: null, with a warning) shows the
// comma there too. The hash carries it as pat=<key> when it is not the default. #app[data-pattern] is the key;
// #app[data-print] the kind of the print on screen ('linear', 'rings', 'shapes'), absent under the comma.
`],
  [`import { PATTERNS, DEFAULT_PATTERN, resolvePattern, printFor, printUniforms } from './pattern.js';`,
   `import { allPatterns, DEFAULT_PATTERN, resolvePattern, printFor, printUniforms } from './pattern.js';`],
  [` * '#g=<id>' and every other key whose rounded value is not its default (pat: a key of pattern.js PATTERNS, written
 * when it is not DEFAULT_PATTERN; a missing or unknown one is not written). Always matches WRAPPER_HASH.`,
   ` * '#g=<id>' and every other key whose rounded value is not its default (pat: a key of pattern.js allPatterns(), written
 * when it is not DEFAULT_PATTERN; a missing or unknown one is not written). Always matches WRAPPER_HASH.`],
  [` *   pattern      a key of pattern.js PATTERNS. 'comma' (the default HERE, the picture as it was before the prints, which
 *                the tests of the pure half were written for): the comma is cut into the mesh and its outline drawn.
 *                'checker' | 'rings' (the app's default is 'checker'): scene.print is the group's print, no comma.`,
   ` *   pattern      a key of pattern.js allPatterns(). 'comma' (the default HERE, the picture as it was before the prints,
 *                which the tests of the pure half were written for): the comma is cut into the mesh and its outline drawn.
 *                'checker' | 'rings' | a registered shape pattern (the app's default is 'checker'): scene.print is the
 *                group's print, no comma. (A registered pattern without a print for this group: the comma, as 'comma'.)`],
  [`  /** The selector shows the pattern; #app[data-pattern] names it (the legend and the swatch read it). */
  function syncPattern() {
    if (el.app.getAttribute('data-pattern') !== state.pattern) el.app.setAttribute('data-pattern', state.pattern);
    if (patEl.select && patEl.select.value !== state.pattern) patEl.select.value = state.pattern;
    const P0 = PATTERNS.find((q) => q.key === state.pattern);
    if (patEl.label && P0 && patEl.label.textContent !== P0.label) patEl.label.textContent = P0.label;
    if (patEl.box && P0) patEl.box.title = 'Pattern: ' + P0.label + ' — ' + P0.hint;
  }`,
   `  /** The selector lists every pattern (pattern.js allPatterns(): the page's own and the registered ones, also one
   *  that was registered after the page started) and shows the current one; #app[data-pattern] names it (the legend
   *  and the swatch read it), #app[data-print] says what kind of print the scene has (absent: the comma). */
  function syncPattern() {
    if (el.app.getAttribute('data-pattern') !== state.pattern) el.app.setAttribute('data-pattern', state.pattern);
    const all = allPatterns();
    if (patEl.select) {
      const opts = patEl.select.options;
      if (!opts || opts.length !== all.length) {
        const have = new Set(Array.from(opts || [], (o) => o.value));
        for (const q of all) if (!have.has(q.key)) { const o = doc.createElement('option'); o.value = q.key; o.textContent = q.label; patEl.select.appendChild(o); }
      }
      if (patEl.select.value !== state.pattern) patEl.select.value = state.pattern;
    }
    const P0 = all.find((q) => q.key === state.pattern);
    if (patEl.label && P0 && patEl.label.textContent !== P0.label) patEl.label.textContent = P0.label;
    if (patEl.box && P0) patEl.box.title = 'Pattern: ' + P0.label + (P0.hint ? ' — ' + P0.hint : '');
    const kind = scene && scene.print ? scene.print.kind : null;
    if (kind === null) { if (el.app.hasAttribute('data-print')) el.app.removeAttribute('data-print'); }
    else if (el.app.getAttribute('data-print') !== kind) el.app.setAttribute('data-print', kind);
  }`],
  [`    scene = next;
    counters.rebuilds++;
    syncFeatures();`,
   `    scene = next;
    counters.rebuilds++;
    syncFeatures();
    syncPattern();                                             // (#app[data-print]: the new scene's print, or none)`],
  [`      // the pattern (pattern.js): its key, the print's name ('checks', 'triangles', 'hexagons', 'stripes', 'rings') or null
      pattern: state.pattern, print: scene && scene.print ? scene.print.name : null,`,
   `      // the pattern (pattern.js): its key, the print's name ('checks', 'triangles', 'hexagons', 'stripes', 'rings'; a
      // shape pattern's key) or null, and the print's kind ('linear', 'rings', 'shapes') or null
      pattern: state.pattern, print: scene && scene.print ? scene.print.name : null, printKind: scene && scene.print ? scene.print.kind : null,`],
  [`  if (patEl.select) {
    if (!patEl.select.options || !patEl.select.options.length) {
      for (const q of PATTERNS) { const o = doc.createElement('option'); o.value = q.key; o.textContent = q.label; patEl.select.appendChild(o); }
    }
    patEl.select.addEventListener('change', () => { setPattern(patEl.select.value); flushHash(); });
  }`,
   `  // (the select's options: syncPattern — the shell's own three, and one for every pattern that was registered)
  if (patEl.select) patEl.select.addEventListener('change', () => { setPattern(patEl.select.value); flushHash(); });`],
  [`//   setPattern(key)   (getState().pattern, .print: the print's name or null, .recut: null or { home, pieces, movers,
//                  tau0 }, .foldCaption: the words over the fold pane)`,
   `//   setPattern(key)   (getState().pattern, .print: the print's name or null, .printKind, .recut: null or { home,
//                  pieces, movers, tau0 }, .foldCaption: the words over the fold pane)`],
];
let n = 0;
for (const [a, b] of edits) {
  const k = s.split(a).length - 1;
  if (k !== 1) { console.error(`edit ${n}: found ${k} times:\n${a.slice(0, 120)}`); process.exit(1); }
  s = s.replace(a, () => b);
  n++;
}
fs.writeFileSync(file, s);
console.log(`applied ${n} edits to ${file}`);
