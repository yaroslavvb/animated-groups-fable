"""D1: cyclic colourings of the 17 wallpaper groups.

Gamma is taken GEOMETRICALLY (the site's lattice + coset representatives for the
N=1 reference entry of each family), so nothing depends on the named generators.
Counts of Hom(Gamma,Z_n) are cross-checked against the SoT ch.10 presentation
(Smith normal form of the exponent-sum matrix).

Equivalence: phi ~ u . (phi o conj_A)  for u a unit of Z_n and A an affine map
of the plane with A Gamma A^{-1} = Gamma.  By Bieberbach's second theorem every
automorphism of Gamma is such a conjugation, so this is exactly
    Hom_onto(Gamma, Z_n) / (Aut(Gamma) x (Z/n)^*) ,
i.e. index-n normal subgroups with cyclic quotient, up to affine equivalence of
the pair (Gamma, ker) -- SoT's "isotopically reshaped" relation.
`proper` restricts A to orientation-preserving maps.
"""
import json
import cx_geom as X
import cx_pres as P
import cx_homgeom as HG

NS = [2, 3, 4, 5, 6, 7, 8, 12]


def run(D=12, box=2):
    entries = X.entries()
    out = {}
    tot = {n: [0, 0, 0] for n in NS}
    print('%-6s %-7s %-13s' % ('fam', 'orb', 'Gamma^ab') +
          ''.join('%12s' % ('n=%d' % n) for n in NS))
    for fam in P.IT_ORDER:
        e = entries[X.REF[fam]]
        assert e['phaseOrder'] == 1
        G = X.Group(e, with_time=False)
        Na = X.normaliser(G, D=D, box=box, allow_mirror=True)
        Np = X.normaliser(G, D=D, box=box, allow_mirror=False)
        rank, tors = P.abelianisation(fam)
        ab = ('Z^%d' % rank if rank else '') + \
             ('' if not tors else ('+' if rank else '') +
              '+'.join('Z%d' % d for d in tors))
        cells = []
        out[fam] = {'orb': P.ORB[fam], 'ab': ab, 'norm': len(Na),
                    'norm_proper': len(Np), 'n': {}}
        for n in NS:
            hs = HG.homs(G, n)
            assert len(hs) == P.n_homs(fam, n), (fam, n, len(hs),
                                                 P.n_homs(fam, n))
            ons = [p for p in hs if HG.onto(G, p, n)]
            oa = X.orbits(G, ons, n, Na)
            op = X.orbits(G, ons, n, Np)
            cells.append('%d/%d/%d' % (len(ons), len(oa), len(op)))
            tot[n][0] += len(ons)
            tot[n][1] += len(oa)
            tot[n][2] += len(op)
            reps = []
            for orb in oa:
                phi = orb[0]
                col = {g: G.ev(phi, G.gens[g]) % n for g in G.gen_order}
                reps.append({'size': len(orb), 'col': col,
                             'u': [phi[0], phi[1]]})
            out[fam]['n'][n] = {'homs': len(hs), 'onto': len(ons),
                                'classes': len(oa), 'classes_proper': len(op),
                                'class_reps': reps}
        print('%-6s %-7s %-13s' % (fam, P.ORB[fam], ab) +
              ''.join('%12s' % c for c in cells))
    print('%-6s %-7s %-13s' % ('TOTAL', '', '') +
          ''.join('%12s' % ('%d/%d/%d' % tuple(tot[n])) for n in NS))
    print('\ncells: onto-homs / classes (full affine normaliser) / '
          'classes (orientation-preserving only)')
    json.dump({'ns': NS, 'groups': out,
               'totals': {str(n): tot[n] for n in NS}},
              open('cx_d1.json', 'w'), indent=1)


if __name__ == '__main__':
    run()
