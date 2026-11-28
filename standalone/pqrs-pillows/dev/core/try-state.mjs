// try-state.mjs — a look at what state.js gives.  node dev/core/try-state.mjs
import * as S from '../../src/state.js';
import * as F from '../../src/flips.js';

const show = (st) => S.cardsOf(st).map((c) => `${c.key}${c.active ? '*' : ' '} ${c.pairs.map((p) => p.map((f) => S.featureLabel(st, f)).join(' ')).join(' | ')}  L ${c.L.toFixed(6)} tw ${S.twistText(c.tw)} (${c.tw.toExponential(2)}) range ${c.lRange.map((v) => +v.toFixed(3))} ${c.id}${c.onTree ? ' onTree ' + c.onTree : ''}${c.minimal ? '' : ' LONGER THAN TWIN'}`).join('\n   ');
for (const p of [...S.PRESETS, '2346']) {
  const st = S.stateFor(p);
  console.log(p, 'kind', S.kindOf(st), 'perm', st.perm.join(''), 'hash', S.toHash(st), '\n  ', show(st));
  let cur = st;
  for (const key of S.CARD_KEYS) {
    const t0 = performance.now();
    const r = S.activate(cur, key);
    const dt = performance.now() - t0;
    console.log(`  -> activate ${key}: changed ${r.changed} (${dt.toFixed(1)} ms) perm ${r.state.perm.join('')} L ${r.state.L.toFixed(6)} tw ${r.state.tw.toFixed(6)} tri ${F.triText(r.state.tri)} hash ${S.toHash(r.state)} print ${r.state.print ? 'fit ' + r.state.print.fit : r.state.print}`);
    cur = r.state;
  }
  const back = S.activate(cur, S.keyOf(st));
  console.log(`  -> home ${S.keyOf(st)}: perm ${back.state.perm.join('')} dL ${(back.state.L - st.L).toExponential(2)} dtw ${(back.state.tw - st.tw).toExponential(2)} hash ${S.toHash(back.state)}`);
  console.log('  pillows', JSON.stringify(S.pillowsOf(st).map((q) => ({ f: q.features, o: q.orders, loop: +q.loop.toFixed(4), seal: +q.seal.toFixed(4), h: q.heights.map((v) => +v.toFixed(4)), areaOverPi: +q.areaOverPi.toFixed(4), deg: q.degenerate, exact: q.exact, rim: +q.rim.toFixed(4) }))));
}
console.log(S.fromHash('#'), S.fromHash('#k=333*'), S.fromHash('#k=2346&m=0132&l=2.559&tw=0&j=1.5&v=30%2C20'));
