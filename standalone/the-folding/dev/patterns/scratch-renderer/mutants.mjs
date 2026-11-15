// scratch: plant one fault at a time into a COPY of src/render3d.js (never into the real one) and lay out, per fault,
// a little tree mut/<name>/{src,test} whose tests are the real test files and whose other sources are links to the
// real ones. mut-run.sh then runs each tree's two test files on the mini: every fault must be caught.
//   node dev/patterns/scratch-renderer/mutants.mjs          (then: bash dev/patterns/scratch-renderer/mut-run.sh)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const src = fs.readFileSync(path.join(root, 'src/render3d.js'), 'utf8');
const M = [
  ['upload-every-frame', `if (G.patTex && G.patData === tex.data && G.patSize === tex.size) return G.patTex;`, ``],
  ['key-on-wrapper-not-data', `if (G.patTex && G.patData === tex.data && G.patSize === tex.size) return G.patTex;`, `if (G.patTex && G.patWrap === tex) return G.patTex; G.patWrap = tex;`],
  ['old-texture-kept', `    dropPrintTexture();\n    if (G.maxTex > 0`, `    if (G.maxTex > 0`],
  ['not-dropped-with-the-print', `      if (G.patTex && !(style.print && style.print.mode === 3)) dropPrintTexture();\n`, ``],
  ['shader-fract', `texture(uPatT, vec2(dot(uPatI.xy, q), dot(uPatI.zw, q)))`, `texture(uPatT, fract(vec2(dot(uPatI.xy, q), dot(uPatI.zw, q))))`],
  ['shader-decode-128', `* (uPatO.z / 127.0);`, `* (uPatO.z / 128.0);`],
  ['shader-ramp-saturates-at-range', `return clamp(0.5 - sd / clamp(w, 1e-6 * range, 2.0 * range), 0.0, 1.0);`, `return clamp(0.5 - sd / clamp(w, 1e-6 * range, 1.0 * range), 0.0, 1.0);`],
  ['shader-trusts-gradient-length', `return mix(iso, length(gs) / max(gm, 1e-6), smoothstep(0.2, 0.6, gm));`, `return mix(iso, length(gs), smoothstep(0.2, 0.6, gm));`],
  ['shader-footprint-isotropic', `return mix(iso, length(gs) / max(gm, 1e-6), smoothstep(0.2, 0.6, gm));`, `return iso;`],
  ['shader-lowp-sampler', `uniform highp sampler2D uPatT;`, `uniform sampler2D uPatT;`],
  ['js-ramp-saturates-at-range', `const lo = 1e-6 * range, hi = 2 * range;`, `const lo = 1e-6 * range, hi = range;`],
  ['js-footprint-no-flat-fallback', `return iso + (across - iso) * u * u * (3 - 2 * u);`, `return across;`],
  ['js-sample-half-texel', `const x = s * n - 0.5, y = t * n - 0.5, i = Math.floor(x)`, `const x = s * n, y = t * n, i = Math.floor(x)`],
  ['js-sample-transposed', `const i0 = wrap(i), i1 = wrap(i + 1), r0 = wrap(j) * n, r1 = wrap(j + 1) * n;`, `const i0 = wrap(j), i1 = wrap(j + 1), r0 = wrap(i) * n, r1 = wrap(i + 1) * n;`],
  ['wrap-clamp', `gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);`, `gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);`],
  ['no-mipmap', `    gl.generateMipmap(gl.TEXTURE_2D);\n    G.patTex = t;`, `    G.patTex = t;`],
  ['min-linear', `gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);`, `gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);`],
  ['alignment-4', `gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);`, `gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);`],
  ['no-anisotropy', `    if (G.aniso) gl.texParameterf(gl.TEXTURE_2D, G.aniso[0], G.aniso[1]);\n`, ``],
  ['rgba-texture', `gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, tex.size, tex.size, 0, gl.RED, gl.UNSIGNED_BYTE, tex.data);`, `gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, tex.size, tex.size, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, tex.data);`],
  ['data-copied', `A: Float32Array.from(P.A), I: Float32Array.from(P.I), O, tex: { size, data, range } };`, `A: Float32Array.from(P.A), I: Float32Array.from(P.I), O, tex: { size, data: data.slice(), range } };`],
  ['range-from-O-first', `const range = Number.isFinite(T.range) && T.range > 0 ? +T.range : +P.O[2];`, `const range = P.O[2] > 0 ? +P.O[2] : +T.range;`],
  ['short-data-accepted', "  if (data.length < size * size) return `tex.data holds ${data.length} texels; a tex.size of ${size} needs ${size * size}`;\n", ``],
  ['too-large-still-mode-3', `gl.uniform1i(u.uPat, pr && !(pr.mode === 3 && !sdfTex) ? pr.mode : 0);`, `gl.uniform1i(u.uPat, pr ? pr.mode : 0);`],
  ['blank-not-bound', `gl.bindTexture(gl.TEXTURE_2D, sdfTex || G.blankTex); gl.uniform1i(u.uPatT, 0);`, `if (sdfTex) gl.bindTexture(gl.TEXTURE_2D, sdfTex); gl.uniform1i(u.uPatT, 0);`],
  ['dispose-leaks', `      for (const k of ['blankTex', 'patTex']) if (G[k]) gl.deleteTexture(G[k]);\n`, ``],
  ['setstyle-touches-gl', `        style.print = typeof sp === 'string' ? null : sp;`, `        style.print = typeof sp === 'string' ? null : sp; if (style.print && G) printTexture(style.print.tex);`],
  ['mode-1-broken', `      } else style.print = P && (P.mode === 1 || P.mode === 2) && fine(P.L, 9)`, `      } else style.print = P && (P.mode === 2) && fine(P.L, 9)`],
  ['print-without-uv', `const pr = m && surf.uv && style.print && style.print.mode > 0 ? style.print : null;`, `const pr = m && style.print && style.print.mode > 0 ? style.print : null;`],
];
const out = path.join(here, 'mut');
fs.rmSync(out, { recursive: true, force: true });
const others = fs.readdirSync(path.join(root, 'src')).filter((f) => f !== 'render3d.js');
for (const [name, a, b] of M) {
  if (!src.includes(a)) throw new Error(`${name}: the text to change is not in src/render3d.js`);
  if (src.split(a).length !== 2) throw new Error(`${name}: the text to change is there more than once`);
  const dir = path.join(out, name);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true }); fs.mkdirSync(path.join(dir, 'test'));
  fs.writeFileSync(path.join(dir, 'src/render3d.js'), src.replace(a, b));
  for (const f of others) fs.symlinkSync(path.join('../../../../../../src', f), path.join(dir, 'src', f));
  for (const t of ['render3d.test.js', 'render3d-dom.test.js']) fs.copyFileSync(path.join(root, 'test', t), path.join(dir, 'test', t));
}
// and one tree with no fault: it must pass
{
  const dir = path.join(out, '0-no-fault');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true }); fs.mkdirSync(path.join(dir, 'test'));
  fs.writeFileSync(path.join(dir, 'src/render3d.js'), src);
  for (const f of others) fs.symlinkSync(path.join('../../../../../../src', f), path.join(dir, 'src', f));
  for (const t of ['render3d.test.js', 'render3d-dom.test.js']) fs.copyFileSync(path.join(root, 'test', t), path.join(dir, 'test', t));
}
console.log(`${M.length} faults planted under ${out}`);
