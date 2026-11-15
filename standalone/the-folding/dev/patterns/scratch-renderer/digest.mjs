// scratch: the numbers quoted in notes/patterns-renderer.md, from the proof's JSON
//   node dev/patterns/scratch-renderer/digest.mjs [tex-demo.json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const file = process.argv[2] || path.join(os.homedir(), 'drive.unsynced/artifacts/the-folding-patterns/renderer/tex-demo.json');
const J = JSON.parse(fs.readFileSync(file, 'utf8'));
const REQ = new Set([0.5, 1, 2, 4, 8]);
const mm = (a) => `${Math.min(...a)} … ${Math.max(...a)}`;
console.log('when', J.when, 'where', J.where, 'size', J.size, 'range', J.range, 'fails', J.fails.length);
for (const [k, r] of Object.entries(J.runs)) {
  console.log(`\n== ${k}: ${r.info.gpu}; aniso ${r.info.anisoUsed}; msaa ${r.info.samples}; meanTone ${r.info.meanTone.toFixed(4)}; unproject ${r.info.unprojectError}`);
  const req = r.zoom.filter((m) => REQ.has(m.z) && m.name !== 'grazing');
  console.log('far pct (required)', mm(req.map((m) => m.far.pct)), 'n', mm(req.map((m) => m.far.n)), 'sample pct', mm(req.map((m) => m.sample.pct)), 'sample n', mm(req.map((m) => m.sample.n)));
  console.log('worst far among required:', req.filter((m) => m.far.pct < 100).map((m) => `${m.name} z ${m.z}: ${m.far.pct} (worst ${m.far.worst})`).join('; '));
  for (const nm of ['face-on', 'tilted', 'grazing']) console.log(`width ${nm}:`, r.zoom.filter((m) => m.name === nm).map((m) => `z${m.z}: ${m.edge.width}`).join(', '));
  console.log('|offset px| required max', Math.max(...req.map((m) => Math.abs(m.edge.offsetPx))), 'grazing (required zooms) max', Math.max(...r.zoom.filter((m) => REQ.has(m.z) && m.name === 'grazing').map((m) => Math.abs(m.edge.offsetPx))));
  const mag = r.zoom.filter((m) => m.view.pxPerTexel >= 1 && m.name !== 'grazing');
  console.log('twin rmsTex, face-on + tilted at >= 1 device px a texel:', mm(mag.map((m) => m.twin.rmsTex)), `(${mag.length} views)`);
  for (const nm of ['tilted', 'grazing']) { const v = r.zoom.filter((m) => m.name === nm && REQ.has(m.z)); console.log(`iso / twin rms ratio ${nm} (required zooms):`, mm(v.map((m) => +(m.twin.rmsIso / m.twin.rms).toFixed(2))), '| rms', mm(v.map((m) => m.twin.rms)), 'iso', mm(v.map((m) => m.twin.rmsIso))); }
  console.log('seam plateau max (required)', Math.max(...req.map((m) => m.seam.plateauMax)), 'plateau n', mm(req.map((m) => m.seam.plateauN)), '; all views max', Math.max(...r.zoom.map((m) => m.seam.plateauMax)));
  console.log('back:', r.back.map((m) => `${m.name} z${m.z}: ${m.far.pct}% s${m.sample.pct}% w${m.edge.width} off${m.edge.offsetPx} dim${m.dim}`).join(' | '), 'cross', JSON.stringify(r.backCross));
  console.log('handover', JSON.stringify(r.handover));
  console.log('mesh', JSON.stringify(r.mesh));
  console.log('seamShift: views', r.seam.length, 'border max', Math.max(...r.seam.map((m) => m.borderMax)), 'overall max', Math.max(...r.seam.map((m) => m.max)), 'at', r.seam.filter((m) => m.max === Math.max(...r.seam.map((x) => x.max))).map((m) => m.name).join(','), 'levels', mm(r.seam.map((m) => Math.round(m.levels))));
  for (const el of [55, 90]) {
    const t = r.tiny.filter((x) => x.el === el);
    console.log(`tiny el ${el}: px ${t.map((x) => x.sheetPx)} | mean ${t.map((x) => x.gpu.mean)} | spread gpu ${t.map((x) => x.gpu.meanSpread)} ideal ${t.map((x) => x.ideal.meanSpread)} | flicker gpu ${t.map((x) => x.gpu.flicker)} ideal ${t.map((x) => x.ideal.flicker)} point ${t.map((x) => x.point.flicker)} soft ${t.map((x) => x.soft.flicker)}`);
  }
  console.log('lose', JSON.stringify(r.lose));
  if (r.baked) console.log('baked:', r.baked.map((m) => `${m.name}: ${m.far.pct}% w${m.edge.width} off${m.edge.offsetPx}`).join(' | '), 'seam', r.bakedSeam.map((m) => m.max));
  if (r.range) {
    for (const nm of ['face-on z 8', 'face-on z 0.125', 'face-on z 0.25']) console.log(`range sweep, ${nm}:`, r.range.filter((m) => m.name === nm).map((m) => `r${m.rangeTexels}: w${m.edge.width} pos${m.edge.posRms}`).join(', '));
  }
  if (r.size) console.log('size sweep:', r.size.map((m) => `${m.size} ${m.name}: far${m.far.pct} w${m.edge.width} pos${m.edge.posRms}/${m.edge.posMax} (tex ${m.edge.posRmsTexel})`).join(' | '));
  if (r.upload) console.log('upload', JSON.stringify(r.upload));
  if (r.other) console.log('other:', r.other.map((o) => `${o.label}: seam ${o.seam.map((m) => m.max)} close w${o.close.edge.width} pos${o.close.edge.posRms} far${o.close.far.pct}`).join(' | '));
  console.log('stats', JSON.stringify(r.stats));
}
