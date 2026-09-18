"""D2: cyclic colourings of the 68 forward (polar) film groups.

For each film group G (a 3-D polar space group with z = time) and each n, count
the onto homomorphisms sigma: G -> Z_n, split by  c_t = sigma(t)  where t is the
generator of the pure time translations of G (the unit period), and the classes
under the affine normaliser of G in spacetime (time orientation preserved,
Galilean shears allowed) together with colour relabelling by units of Z_n.
"""
import json
import cx_geom as X
import cx_pres as P
import cx_homgeom as HG

NS = [2, 3, 4, 5, 6, 12]
ORDER = None


def film_order(entries):
    return sorted(entries, key=lambda g: int(g[1:]))


def run(D=12, box=2, ellbox=2):
    entries = X.entries()
    order = film_order(entries)
    rows = []
    tot = {n: {'ct0': [0, 0], 'ctne': [0, 0]} for n in NS}
    for gid in order:
        e = entries[gid]
        G = X.Group(e, with_time=True)
        Nf = X.normaliser(G, D=D, box=box, allow_mirror=True,
                          allow_time_flip=False, ellbox=ellbox)
        pres = X.action_set(G, Nf)
        Np3 = X.normaliser(G, D=D, box=box, proper3=True, ellbox=ellbox)
        pres3 = X.action_set(G, Np3)
        row = {'id': gid, 'family': e['family'], 'orbifold': e['orbifold'],
               'signature': e['signature'], 'N': e['phaseOrder'],
               'norm': len(pres), 'norm_proper3': len(pres3), 'n': {}}
        for n in NS:
            hs = HG.homs(G, n)
            ons = [p for p in hs if HG.onto(G, p, n)]
            a = [p for p in ons if p[2] % n == 0]
            b = [p for p in ons if p[2] % n != 0]
            ca = X.orbits(G, a, n, None, pres=pres)
            cb = X.orbits(G, b, n, None, pres=pres)
            ca3 = X.orbits(G, a, n, None, pres=pres3)
            cb3 = X.orbits(G, b, n, None, pres=pres3)
            reps = {'ct0': [], 'ctne': []}
            for key, orbs in (('ct0', ca), ('ctne', cb)):
                for orb in orbs:
                    phi = orb[0]
                    col = {g: G.ev(phi, G.gens[g]) % n for g in G.gen_order}
                    reps[key].append({'size': len(orb), 'ct': phi[2] % n,
                                      'col': col})
            row['n'][n] = {'onto': len(ons), 'onto_ct0': len(a),
                           'onto_ctne': len(b),
                           'cls_ct0': len(ca), 'cls_ctne': len(cb),
                           'cls_ct0_p3': len(ca3), 'cls_ctne_p3': len(cb3),
                           'reps': reps}
            tot[n]['ct0'][0] += len(a)
            tot[n]['ct0'][1] += len(ca)
            tot[n]['ctne'][0] += len(b)
            tot[n]['ctne'][1] += len(cb)
        rows.append(row)
    json.dump({'ns': NS, 'rows': rows,
               'totals': {str(n): tot[n] for n in NS}},
              open('cx_d2.json', 'w'), indent=1)
    # ---- printout
    print('%-5s %-5s %-9s %-3s' % ('id', 'fam', 'orbifold', 'N') +
          ''.join('%17s' % ('n=%d' % n) for n in NS))
    for r in rows:
        cells = []
        for n in NS:
            d = r['n'][n]
            cells.append('%d:%d|%d:%d' % (d['onto_ct0'], d['cls_ct0'],
                                          d['onto_ctne'], d['cls_ctne']))
        print('%-5s %-5s %-9s %-3d' % (r['id'], r['family'], r['orbifold'],
                                       r['N']) +
              ''.join('%17s' % c for c in cells))
    print('\ncells: (c_t=0 onto : classes) | (c_t!=0 onto : classes)')
    print('%-25s' % 'TOTAL' +
          ''.join('%17s' % ('%d:%d|%d:%d' % (tot[n]['ct0'][0], tot[n]['ct0'][1],
                                             tot[n]['ctne'][0], tot[n]['ctne'][1]))
                  for n in NS))


if __name__ == '__main__':
    run()
