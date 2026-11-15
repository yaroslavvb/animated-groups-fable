// dev/patterns/scratch-review-webkit/summarize.mjs — what lib.mjs's report.json says, short, for one or more engines.
//   node dev/patterns/scratch-review-webkit/summarize.mjs <dir with report.json> [...]
import fs from 'node:fs';
import path from 'node:path';

for (const dir of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
  console.log(`\n===== ${r.engine} ${r.version}  (${dir})`);
  const e = r.env || {};
  console.log(`ua: ${e.ua}`);
  console.log(`dpr ${e.dpr}; requestIdleCallback ${e.ric} / cancel ${e.cic}; renderer ok ${e.rok}; opened with ${e.opened} on ${e.group} (print ${e.print}, ${e.printKind}); select ${e.select}; data-pattern ${e.dataPattern}; data-print ${e.dataPrint}; hash "${e.hash}"; app errors ${JSON.stringify(e.errors)}; uploads ${e.uploads}`);
  if (e.gl) console.log(`gl: ${e.gl.version} | ${e.gl.glsl} | ${e.gl.vendor} | ${e.gl.renderer} | unmasked ${JSON.stringify(e.gl.unmasked)} | maxTex ${e.gl.maxTex} aniso ${e.gl.aniso} samples ${e.gl.samples} stencil ${e.gl.stencil}`);
  console.log('shader: ' + JSON.stringify(r.shader));
  console.log('gl errors at open: ' + JSON.stringify(r.glErrAtOpen));
  console.log('loads: ' + r.loads.map((l) => `${l.name} ${l.ms} ms`).join(', '));
  // agree
  console.log('-- t = 0: 3D and plane against print.tone  (agree / wrong / unclassified of n; sep = distance of the two tones)');
  for (const a of r.agree) {
    if (a.skip) { console.log(`  ${a.p.padEnd(8)} ${a.g.padEnd(5)} SKIP ${a.skip}`); continue; }
    const f = (c) => `${String(c.agree).padStart(4)}/${String(c.wrong).padStart(3)}/${String(c.unc).padStart(3)} of ${String(c.n).padStart(4)} sep ${String(c.sep).padStart(3)}`;
    const flag = (c) => (c.sep < 25 || c.wrong > 0.01 * (c.agree + c.wrong) || c.agree < 50) ? ' <<<' : '';
    console.log(`  ${a.p.padEnd(8)} ${a.g.padEnd(5)} ${a.print} | 3D ${f(a.gl3)}${flag(a.gl3)} | plane ${f(a.plane)}${flag(a.plane)} | glErr ${a.glErr}`);
    if (flag(a.gl3) || flag(a.plane)) console.log(`      3D light ${JSON.stringify(a.gl3.light)} dark ${JSON.stringify(a.gl3.dark)} bad ${JSON.stringify(a.gl3.bad.slice(0, 3))}; plane light ${JSON.stringify(a.plane.light)} dark ${JSON.stringify(a.plane.dark)} bad ${JSON.stringify(a.plane.bad.slice(0, 3))}`);
  }
  if (r.patTime) console.log('-- setPattern on 333 (round, key, ms): ' + r.patTime.map((x) => x.join(' ')).join(', '));
  const pm = r.states.filter((s) => s.plane).map((s) => s.plane.printMs), cm = r.states.filter((s) => s.r3d).map((s) => s.r3d.cpuMs), dm = r.states.filter((s) => s.plane).map((s) => s.plane.ms);
  const stat = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? `median ${s[s.length >> 1]} max ${s[s.length - 1]}` : 'none'; };
  if (pm.length) console.log(`-- plane: last print layer build ${stat(pm)} ms; last plane draw ${stat(dm)} ms; 3D cpu per frame ${stat(cm)} ms`);
  // states
  const odd =r.states.filter((s) => s.shotError || !s.print || s.glErr && s.glErr.length || s.errors || (s.appErrors && s.appErrors.length) || !s.webgl);
  console.log(`-- states: ${r.states.length}, odd: ${odd.length}`);
  for (const s of odd.slice(0, 12)) console.log('  ' + JSON.stringify(s));
  const ph = (r.phone || []).filter((s) => !s.print || s.glErr && s.glErr.length || s.errors || !s.webgl);
  console.log(`-- phone states: ${(r.phone || []).length}, odd: ${ph.length}` + (r.phoneEnv ? `; phone dpr ${r.phoneEnv.dpr}` : ''));
  for (const s of ph.slice(0, 8)) console.log('  ' + JSON.stringify(s));
  // select
  console.log('-- the native select (chosen with selectOption)');
  for (const s of r.select) {
    const ok = s.pattern === s.chose && s.dataPattern === s.chose && s.select === s.chose && s.swatches.length === 1 && s.swatches[0].includes('pat-sw-' + s.chose) && s.pageW <= s.w && s.headerOver <= 0;
    console.log(`  ${ok ? 'ok ' : 'BAD'} ${s.w} ${s.chose.padEnd(8)} -> pattern ${s.pattern}, print ${s.print}/${s.kind}, data-print ${s.dataPrint}, swatch ${s.swatches.join('|')} ${JSON.stringify(s.swBox)} paints ${s.paints.join(' ')}, label "${s.label}" ${s.labelShown ? 'shown' : 'hidden'}, option "${s.selectedText}", hash ${s.hash}, page ${s.pageW}, header +${s.headerOver}, select ${s.selScrollW}/${s.selClientW}`);
  }
  console.log('-- page width per pattern chosen in the select');
  const wb = r.width.filter((w) => w.pageW > w.w || w.bodyW > w.w || w.headerOver > 0 || w.pattern !== w.p);
  console.log(`  ${r.width.length} checks, ${wb.length} wider than the window or not taken` + (wb.length ? ': ' + JSON.stringify(wb.slice(0, 6)) : ''));
  console.log('  select scrollWidth/clientWidth at 320: ' + r.width.filter((w) => w.w === 320).map((w) => `${w.p} ${w.selScrollW}/${w.selClientW}`).join(', '));
  // idle
  for (const [k, v] of Object.entries(r.idle || {})) {
    console.log(`-- idle (${k}): requestIdleCallback ${v.ric}`);
    for (const p of v.passes) console.log(`  ${p.p.padEnd(8)} ${p.sec.toFixed(1)} s  ${JSON.stringify(p.warm)}`);
    const ms = v.warmedTomoe.map((x) => x[1]).sort((a, b) => a - b);
    console.log(`  setGroup with Tomoe made ahead: median ${ms[ms.length >> 1]} ms, max ${ms[ms.length - 1]} (${v.warmedTomoe.map((x) => x.join(' ')).join(', ')})`);
    const lg = v.log.filter((l) => l[0] !== 'log' && l[0] !== 'debug');
    if (lg.length) console.log('  console: ' + JSON.stringify(lg.slice(0, 6)));
  }
  for (const [p, v] of Object.entries(r.time || {})) {
    const ms = v.cold.out.map((x) => x[1]).sort((a, b) => a - b);
    console.log(`-- setGroup, nothing made ahead, ${p}: (made before ${v.cold.before}) median ${ms[ms.length >> 1]} ms, max ${ms[ms.length - 1]}  (${v.cold.out.map((x) => x.join(' ')).join(', ')})`);
  }
  for (const [k, lg] of Object.entries(r.logs || {})) {
    const imp = lg.filter((l) => l[0] !== 'log' && l[0] !== 'debug');
    console.log(`-- console (${k}): ${lg.length} messages, ${imp.length} not logs` + (imp.length ? '\n   ' + imp.slice(0, 15).map((l) => l.join(': ')).join('\n   ') : ''));
  }
}
