"""Shared driver: dedupe arithmetic classes, enumerate group classes."""

from stcore import ArithClass, Lattice, find_conjugations, group_closure, reduce_classes


def op_order(op, d):
    from stcore import op_mul, op_identity
    e = op_identity(d)
    x = op
    for k in range(1, 30):
        if x == e:
            return k
        x = op_mul(x, op)
    raise ValueError


def cheap_invariant(ac):
    """Conjugation-invariant data only (lattice data is NOT invariant under
    rescaling re-basings)."""
    d = ac.lat.d
    ops = sorted((sum(M[i][i] for i in range(d)),  # spatial trace
                  s, op_order((M, s), d))
                 for (M, s) in ac.P)
    return (len(ac.P), tuple(ops))


def dedupe_pairs(named, bound=2, orientation="any", verbose=False):
    """named: list of (name, ArithClass). Returns list of (name, ac) reps."""
    reps = []
    merged = {}
    for name, ac in named:
        inv = cheap_invariant(ac)
        found = None
        for rname, rac, rinv in reps:
            if rinv != inv:
                continue
            if find_conjugations(ac, rac, bound=bound, max_found=1,
                                 orientation=orientation):
                found = rname
                break
        if found:
            merged[name] = found
            if verbose:
                print(f"    {name} ~ {found} (merged)", flush=True)
        else:
            reps.append((name, ac, inv))
    return [(n, a) for (n, a, _) in reps], merged


def enumerate_groups(classes, bound_moves=1, orientation="any", verbose=False):
    """classes: list of (name, ArithClass). Returns list of
    (name, ac, orbit_rep_vectors)."""
    out = []
    for name, ac in classes:
        D2, reps = ac.h1_with_reps()
        moves = find_conjugations(ac, ac, bound=bound_moves,
                                  orientation=orientation)
        orbits = reduce_classes(ac, reps, moves)
        if verbose:
            print(f"  {name:12s} |P|={len(ac.P):2d} H1={len(reps):3d} "
                  f"moves={len(moves):3d} -> {len(orbits)} groups", flush=True)
        out.append((name, ac, orbits))
    return out
