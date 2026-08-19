#!/usr/bin/env python3
"""Full run: enumerate + analyse subgroups of 237 and *237 up to index N1, N2; write JSON + text."""
import sys, time, json
from fractions import Fraction
from math import factorial
from collections import defaultdict, Counter
import os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lowindex import *
SS_MAX = 1000
DO_CORE_IDS = True


def col_perm(table, c):
    return tuple(row[c] for row in table)


def combined_order(gens1, gens2):
    n1 = len(gens1[0])
    gens = [tuple(list(g1) + [n1 + x for x in g2]) for g1, g2 in zip(gens1, gens2)]
    return perm_group_order(gens)


def core_ids(classes, gens_key, giant_flag_key):
    """Assign an id to each class such that two classes have the same id iff same core (kernel).
    Only classes with equal core_index can share a core; giants at the same degree never do
    (checked separately: for giants at different degrees the kernels differ trivially since
    the quotients differ)."""
    by_ci = defaultdict(list)
    for i, r in enumerate(classes):
        by_ci[r["core_index"]].append(i)
    cid = {}
    next_id = 0
    for ci, idxs in by_ci.items():
        reps = []   # list of (rep index, id)
        for i in idxs:
            r = classes[i]
            found = None
            if not r[giant_flag_key]:
                for j, idj in reps:
                    rj = classes[j]
                    if rj[giant_flag_key]:
                        continue
                    if combined_order(r[gens_key], rj[gens_key]) == ci:
                        found = idj
                        break
            if found is None:
                found = next_id
                next_id += 1
                reps.append((i, found))
            cid[i] = found
    return cid


def run_237(N):
    G = FPGroup(["x", "y"], {"x"}, [[("y", 1)] * 3, [("x", 1), ("y", 1)] * 7])
    found = []
    t0 = time.time()
    nodes = low_index_subgroups(G, N, lambda T: found.append(tuple(tuple(r) for r in T)))
    t_enum = time.time() - t0
    sys.stderr.write("237: %d classes of index <= %d, %d nodes, %.1fs\n" % (len(found), N, nodes, t_enum))
    results = []
    canon_index = {}
    t1 = time.time()
    for T in found:
        k = len(T)
        X = col_perm(T, 0)
        Y = col_perm(T, 1)
        XY = perm_mul(X, Y)
        auts = sum(1 for b in range(k) if standard_table_from(T, b, 3) == T)
        assert k % auts == 0
        cx, cy, cxy = cycles(X), cycles(Y), cycles(XY)
        cone2, cone3, cone7 = cx.count(1), cy.count(1), cxy.count(1)
        chi = Fraction(-k, 42)
        rhs = 2 - chi - Fraction(cone2, 2) - Fraction(2 * cone3, 3) - Fraction(6 * cone7, 7)
        assert rhs.denominator == 1 and rhs.numerator % 2 == 0
        g = rhs.numerator // 2
        sig = [g, [2] * cone2 + [3] * cone3 + [7] * cone7]
        giant = is_alternating_or_symmetric([X, Y], k)
        order = factorial(k) // 2 if giant else (perm_group_order([X, Y]) if k <= SS_MAX else None)
        if giant:
            assert all_even([X, Y])
        A, B, C = lift_237_table_to_star237(X, Y)
        orb = orbifold_of_reflection_table(A, B, C)
        assert orb["orientable_surface"] and orb["n_boundaries"] == 0 and orb["genus"] == g and orb["cones"] == sig[1]
        assert Fraction(orb["chi_orb"]) == chi
        T2 = tuple((r[0], r[2], r[1]) for r in T)
        cf2 = canonical_form(T2, 3)
        canon_index[T] = len(results)
        results.append({
            "id": len(results), "index": k, "x": list(X), "y": list(Y), "table": [list(r) for r in T],
            "auts": auts, "class_size": k // auts,
            "signature": sig, "conway": orb["conway"], "chi_orb": str(chi),
            "core_index": order, "image": name_group(order, k, None, None) if order else None, "core_index_factored": factorint(order) if order else None,
            "giant": giant, "primitive": is_primitive([X, Y], k),
            "cycles_x": cx, "cycles_y": cy, "cycles_xy": cxy,
            "_gens": [X, Y], "_outer_canon": cf2,
        })
    for r in results:
        cf2 = r.pop("_outer_canon")
        j = canon_index[cf2]
        r["outer_partner"] = j
        r["fixed_by_reflection"] = (j == r["id"])
    if DO_CORE_IDS:
        cid = core_ids(results, "_gens", "giant")
    for i, r in enumerate(results):
        r["core_id"] = cid[i] if DO_CORE_IDS else None
        del r["_gens"]
    t_an = time.time() - t1
    return results, nodes, t_enum, t_an


def run_star237(N):
    G = FPGroup(["a", "b", "c"], {"a", "b", "c"},
                [[("a", 1), ("b", 1)] * 2, [("b", 1), ("c", 1)] * 3, [("c", 1), ("a", 1)] * 7])
    found = []
    t0 = time.time()
    nodes = low_index_subgroups(G, N, lambda T: found.append(tuple(tuple(r) for r in T)))
    t_enum = time.time() - t0
    sys.stderr.write("*237: %d classes of index <= %d, %d nodes, %.1fs\n" % (len(found), N, nodes, t_enum))
    results = []
    t1 = time.time()
    for T in found:
        k = len(T)
        A, B, C = col_perm(T, 0), col_perm(T, 1), col_perm(T, 2)
        auts = sum(1 for b in range(k) if standard_table_from(T, b, 3) == T)
        assert k % auts == 0
        orb = orbifold_of_reflection_table(A, B, C)
        assert Fraction(orb["chi_orb"]) == Fraction(-k, 84), (k, orb)
        op = orientation_preserving_reflection_table(A, B, C)
        giant = is_alternating_or_symmetric([A, B, C], k)
        even = all_even([A, B, C])
        order = (factorial(k) // 2 if even else factorial(k)) if giant else (perm_group_order([A, B, C]) if k <= SS_MAX else None)
        results.append({
            "id": len(results), "index": k, "a": list(A), "b": list(B), "c": list(C), "table": [list(r) for r in T],
            "auts": auts, "class_size": k // auts,
            "orientation_preserving": op, "conway": orb["conway"],
            "orientable_surface": orb["orientable_surface"], "genus": orb["genus"],
            "crosscaps": orb["crosscaps"], "cones": orb["cones"], "boundaries": orb["boundaries"],
            "n_mirror_edges": orb["n_mirror_edges"], "chi_orb": orb["chi_orb"],
            "core_index": order, "image": name_group(order, k, None, None) if order else None, "core_index_factored": factorint(order) if order else None,
            "image_in_alternating": even, "giant": giant, "primitive": is_primitive([A, B, C], k),
            "cycles_a": cycles(A), "cycles_b": cycles(B), "cycles_c": cycles(C),
            "_gens": [A, B, C],
        })
    if DO_CORE_IDS:
        cid = core_ids(results, "_gens", "giant")
    for i, r in enumerate(results):
        r["core_id"] = cid[i] if DO_CORE_IDS else None
        del r["_gens"]
    t_an = time.time() - t1
    return results, nodes, t_enum, t_an


if __name__ == "__main__":
    N1 = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    N2 = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    SS_MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
    DO_CORE_IDS = (sys.argv[4] == "1") if len(sys.argv) > 4 else True
    suffix = sys.argv[5] if len(sys.argv) > 5 else ""
    r1, nodes1, te1, ta1 = run_237(N1)
    with open(HERE + "/out/lowindex_results_237%s.json" % suffix, "w") as f:
        json.dump({"group": "237 = <x,y | x^2, y^3, (xy)^7>", "N": N1, "nodes": nodes1,
                   "seconds_enumeration": te1, "seconds_analysis": ta1, "classes": r1}, f, indent=1)
    sys.stderr.write("237 analysis %.1fs\n" % ta1)
    r2, nodes2, te2, ta2 = run_star237(N2)
    with open(HERE + "/out/lowindex_results_star237%s.json" % suffix, "w") as f:
        json.dump({"group": "*237 = <a,b,c | a^2,b^2,c^2,(ab)^2,(bc)^3,(ca)^7>", "N": N2, "nodes": nodes2,
                   "seconds_enumeration": te2, "seconds_analysis": ta2, "classes": r2}, f, indent=1)
    sys.stderr.write("*237 analysis %.1fs\n" % ta2)
    print("done")
