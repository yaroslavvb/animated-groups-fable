// scratch: more of the numbers quoted in notes/patterns-renderer.md (the far misses, the direction control), from the proof's JSON
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const J = JSON.parse(fs.readFileSync(process.argv[2] || path.join(os.homedir(), 'drive.unsynced/artifacts/the-folding-patterns/renderer/tex-demo.json'), 'utf8'));
const REQ = new Set([0.5, 1, 2, 4, 8]);
const mm = (a) => `${Math.min(...a)} … ${Math.max(...a)}`;
console.log('when', J.when, 'fails', J.fails.length);
for (const [k, r] of Object.entries(J.runs)) {
  const req = r.zoom.filter((m) => REQ.has(m.z) && m.name !== 'grazing');
  console.log(`\n${k}: required views ${req.length}; far pct ${mm(req.map((m) => m.far.pct))}; misses:`, req.filter((m) => m.far.missN).map((m) => `${m.name} z${m.z} (${m.view.pxPerTexel} px/texel): ${m.far.missN} of ${m.far.n}, farthest ${m.far.missCornerTexels} texels from a corner`).join('; ') || 'none');
  console.log('  all views with misses:', r.zoom.filter((m) => m.far.missN).map((m) => `${m.name} z${m.z}: ${m.far.missN} (${m.far.missCornerTexels})`).join('; '));
  for (const nm of ['tilted', 'grazing']) {
    const v = r.zoom.filter((m) => m.name === nm && REQ.has(m.z) && m.view.pxPerTexel >= 1);
    console.log(`  ${nm}, required zooms at >= 1 device px a texel (${v.length} views): tex rms ${mm(v.map((m) => m.twin.rmsTex))}, tex-iso ${mm(v.map((m) => m.twin.rmsTexIso))}, ratio ${mm(v.map((m) => +(m.twin.rmsTexIso / m.twin.rmsTex).toFixed(1)))}`);
  }
  const fo = r.zoom.filter((m) => m.name === 'face-on' && REQ.has(m.z));
  console.log('  face-on: tex', fo.map((m) => m.twin.rmsTex).join(','), 'tex-iso', fo.map((m) => m.twin.rmsTexIso).join(','));
  console.log('  back misses:', r.back.map((m) => `${m.name} z${m.z}: ${m.far.missN} (${m.far.missCornerTexels})`).join('; '));
  if (r.baked) console.log('  baked misses:', r.baked.map((m) => `${m.name}: ${m.far.missN} (${m.far.missCornerTexels})`).join('; '), 'offsets', r.baked.map((m) => m.edge.offsetPx).join(','));
  console.log('  seam plateau n (required):', mm(req.map((m) => m.seam.plateauN)), 'max', Math.max(...req.map((m) => m.seam.plateauMax)));
  console.log('  handover', JSON.stringify(r.handover), 'lose', r.lose.uploadsBefore, '->', r.lose.uploadsAfter, 'diff', r.lose.worstDiff, 'upload', JSON.stringify(r.upload || null));
}
