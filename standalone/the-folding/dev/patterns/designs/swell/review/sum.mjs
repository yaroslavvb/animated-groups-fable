// review/sum.mjs — reads lab.mjs output on stdin, prints one short line per group (and passes other lines through)
let s = '';
process.stdin.on('data', (d) => { s += d; }).on('end', () => {
  for (const l of s.trim().split('\n')) {
    let r = null;
    try { r = JSON.parse(l); } catch (e) { /* not a row */ }
    if (!r || !r.id) { if (!l.startsWith('WROTE')) console.log(l); continue; }
    const i = r.info || {}, c = i.comma || {};
    console.log(r.id.padEnd(6), 'cov', String(r.cov).padEnd(5), 'bare', String(r.bare).padEnd(5), 'solid', String(r.solid).padEnd(5),
      'over', r.over, 'v', r.verts, 'ms', r.ms, 'lam', i.lambda, 'w', i.channel, '|', c.partner, 'head', c.head, 'D', c.D, 'sw', c.sweep, 'm', c.m,
      r.error ? 'ERROR ' + r.error : '');
  }
});
