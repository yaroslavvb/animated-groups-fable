#!/usr/bin/env python3
"""Independent check: number of index-n subgroups of a triangle group (l,m,n) via
Frobenius' formula + Murnaghan-Nakayama (character table of S_n on the classes of
elements of order dividing l, m, n) and Hall's recursion for transitive homs.
Also handles the reflection group *lmn (3 involutions with (ab)^l (bc)^m (ca)^n):
h_k = #hom(*lmn, S_k) computed differently: sum over triples of involutions... that
is not a product formula, so we do *lmn by brute force only for tiny k.
"""
import sys
from fractions import Fraction
from functools import lru_cache
from math import factorial


def partitions(n, maxpart=None):
    if maxpart is None:
        maxpart = n
    if n == 0:
        yield ()
        return
    for p in range(min(n, maxpart), 0, -1):
        for rest in partitions(n - p, p):
            yield (p,) + rest


def hook_count(lam):
    """f^lambda = number of SYT."""
    n = sum(lam)
    conj = [sum(1 for p in lam if p > j) for j in range(lam[0])] if lam else []
    prod = 1
    for i, p in enumerate(lam):
        for j in range(p):
            prod *= (p - j - 1) + (conj[j] - i - 1) + 1
    return factorial(n) // prod


@lru_cache(maxsize=None)
def chi(lam, mu):
    """Character chi^lam at cycle type mu (tuple, non-increasing, all parts >=1).
    mu is assumed to have all its parts > 1 first and 1's last."""
    if not mu:
        return 1
    r = mu[0]
    if r == 1:
        return hook_count(lam)
    rest = mu[1:]
    # beta numbers
    l = len(lam)
    beta = [lam[i] + (l - 1 - i) for i in range(l)]
    bset = set(beta)
    total = 0
    for idx, b in enumerate(beta):
        nb = b - r
        if nb < 0 or nb in bset:
            continue
        # sign: number of beads strictly between nb and b
        cnt = sum(1 for x in beta if nb < x < b)
        newbeta = sorted([x for x in beta if x != b] + [nb], reverse=True)
        L = len(newbeta)
        newlam = tuple(newbeta[i] - (L - 1 - i) for i in range(L))
        newlam = tuple(p for p in newlam if p > 0)
        total += (-1) ** cnt * chi(newlam, rest)
    return total


def class_size(mu):
    n = sum(mu)
    from collections import Counter
    c = Counter(mu)
    denom = 1
    for part, mult in c.items():
        denom *= (part ** mult) * factorial(mult)
    return factorial(n) // denom


def hom_count_triangle(l, m, nn, k):
    """|Hom(<x,y,z | x^l, y^m, z^nn, xyz>, S_k)|."""
    if k == 0:
        return 1
    def classes_of_order_dividing(d):
        out = []
        for mu in partitions(k):
            if all(d % p == 0 for p in mu):
                out.append(mu)
        return out
    Cl = classes_of_order_dividing(l)
    Cm = classes_of_order_dividing(m)
    Cn = classes_of_order_dividing(nn)
    total = Fraction(0)
    for lam in partitions(k):
        d = hook_count(lam)
        Al = sum(class_size(mu) * chi(lam, mu) for mu in Cl)
        Am = sum(class_size(mu) * chi(lam, mu) for mu in Cm)
        An = sum(class_size(mu) * chi(lam, mu) for mu in Cn)
        total += Fraction(Al * Am * An, d)
    total /= factorial(k)
    assert total.denominator == 1
    return int(total)


def subgroup_counts(l, m, nn, N):
    h = [hom_count_triangle(l, m, nn, k) for k in range(N + 1)]
    s = [0] * (N + 1)
    for n in range(1, N + 1):
        # h_n/(n-1)! = sum_{k=1}^n s_k h_{n-k}/(n-k)!
        val = Fraction(h[n], factorial(n - 1))
        for k in range(1, n):
            val -= Fraction(s[k] * h[n - k], factorial(n - k))
        assert val.denominator == 1
        s[n] = int(val)
    return h, s


if __name__ == "__main__":
    N = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    h, s = subgroup_counts(2, 3, 7, N)
    print("237 number of subgroups of index n, n=1..%d:" % N)
    print(s[1:])
