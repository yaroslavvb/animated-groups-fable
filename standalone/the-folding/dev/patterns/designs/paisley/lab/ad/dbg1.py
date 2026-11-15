import io, sys
p = 'design.js'
s = io.open(p, encoding='utf8').read()
old = """        let lo = Math.max(best ? Math.sqrt(best.obj / wS) * 1.003 : K.seatMin * 0.6, st ? 0 : K.slenderMin / 2);
        if (lo > sNext || !ok(lo)) return;
        let hi = lo;
        for (;;) { hi = Math.min(sNext, lo * 1.3); if (hi <= lo || !ok(hi)) break; lo = hi; }"""
new = """        let lo = Math.max(best ? Math.sqrt(best.obj / wS) * 1.003 : K.seatMin * 0.6, st ? 0 : K.slenderMin / 2);
        if (K.debugTail) { const row = []; for (const z of [0.03, 0.05, 0.08, 0.12, 0.16, 0.2]) row.push(ok(z) ? 1 : 0); K.debugTail({ e, st, off, lo: +lo.toFixed(3), ok: row.join('') }); }
        if (lo > sNext || !ok(lo)) return;
        let hi = lo;
        for (;;) { hi = Math.min(sNext, lo * 1.3); if (hi <= lo || !ok(hi)) break; lo = hi; }"""
if s.count(old) != 1: sys.exit('dbg1: no match')
s = s.replace(old, new)
io.open(p, 'w', encoding='utf8').write(s)
print('dbg1 ok')
