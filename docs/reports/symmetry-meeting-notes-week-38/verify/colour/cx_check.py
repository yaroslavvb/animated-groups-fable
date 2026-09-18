"""Consistency check.

For each of the 68 forward film groups G with parent wallpaper group Gamma:
  * the named geometric generators satisfy every SoT ch.10 relator of Gamma
    up to a pure translation-and-time carry  (I, lambda, k) with lambda in Z^2;
  * that carry's time part k equals  sum_i e_{j,i} f_i,  where e_{j,i} is the
    exponent sum of generator i in relator j and f_i the generator's time shift.
This verifies simultaneously (a) the site's generator data, (b) the
presentations, and (c) the identity k_r = sum of exponent-weighted f_i that the
colour condition rests on.
"""
from fractions import Fraction as F
import cx_geom as X
import cx_pres as P

ENT = X.entries()


def main():
    bad = 0
    nrel = 0
    for gid, e in ENT.items():
        fam = e['family']
        G = X.Group(e, with_time=True)
        assert set(G.gens) == set(P.GENS[fam]), (gid, fam, sorted(G.gens),
                                                 P.GENS[fam])
        f = {name: F(0) for name in P.GENS[fam]}
        for ng in e['namedGenerators']:
            f[ng['name']] = F(ng['timeShift'])
        E = P.expmat(fam)
        for j, rel in enumerate(P.RELATORS[fam]):
            nrel += 1
            M, v, tau = G.word(rel)
            if M != X.I2:
                print('FAIL linear part', gid, fam, rel, M)
                bad += 1
                continue
            if v[0].denominator != 1 or v[1].denominator != 1:
                print('FAIL translation carry not in lattice', gid, fam, rel, v)
                bad += 1
                continue
            if tau.denominator != 1:
                print('FAIL time carry not integral', gid, fam, rel, tau)
                bad += 1
                continue
            pred = sum(E[j][i]*f[g] for i, g in enumerate(P.GENS[fam]))
            if pred != tau:
                print('FAIL k_r mismatch', gid, fam, rel, 'geom', tau, 'pred', pred)
                bad += 1
    print('checked %d relators over %d groups; %d failures' %
          (nrel, len(ENT), bad))


if __name__ == '__main__':
    main()
