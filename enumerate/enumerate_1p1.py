"""1+1D space-time groups. Anchor: Xu & Wu (PRL 2018) count = 13:
P1, P2, Pm_x, Pg_x, Pm_t, Pg_t, Cm_x, Cm_t, P2m_xm_t, P2g_xg_t, P2m_xg_t,
P2g_xm_t, C2m_xm_t.
"""

from fractions import Fraction

from stcore import ArithClass, Lattice, group_closure, cocycle_sigma
from driver import dedupe_pairs, enumerate_groups

H = Fraction(1, 2)

MX = ((-1,),)   # spatial mirror (1x1 matrix -1)
ID = ((1,),)

POINT_GROUPS = {
    "1":  [],
    "mx": [(MX, 1)],
    "mt": [(ID, -1)],
    "2":  [(MX, -1)],
    "mm": [(MX, 1), (ID, -1)],
}

LATTICES = {
    "P": [],
    "C": [(H, H)],
    # stress tests — must merge into P by rescaling:
    "P-xfine": [(H, 0)],
    "P-tfine": [(0, H)],
}


def name_group(pg_name, lat_name, ac, vec):
    """Human name in Xu-Wu style from the cocycle."""
    sig = cocycle_sigma(ac, vec)
    parts = []
    for (op, s), v in zip(ac.P, sig):
        M = op
        if (M, s) == (ID, 1):
            continue
        frac_x = v[0] % 1
        frac_t = v[1] % 1
        if (M, s) == (MX, 1):
            parts.append("g_x" if frac_t != 0 else "m_x")
        elif (M, s) == (ID, -1):
            parts.append("g_t" if frac_x != 0 else "m_t")
        elif (M, s) == (MX, -1):
            parts.append("2")
    order = {"2": 0, "m_x": 1, "g_x": 1, "m_t": 2, "g_t": 2}
    parts.sort(key=lambda p: order[p])
    return lat_name[0] + ("".join(parts) if parts else "1")


def main():
    named = []
    for pg_name, gens in POINT_GROUPS.items():
        for lat_name, cents in LATTICES.items():
            lat = Lattice(1, True, cents)
            try:
                P = group_closure(gens, 1)
                ac = ArithClass(P, lat)
            except AssertionError:
                continue  # point group does not preserve lattice
            named.append((f"{pg_name}/{lat_name}", ac))

    classes, merged = dedupe_pairs(named, bound=2, verbose=True)
    print(f"arithmetic classes: {len(classes)}  (merged: {len(merged)})")

    results = enumerate_groups(classes, bound_moves=2, verbose=True)
    total = 0
    names = []
    for cname, ac, orbits in results:
        pg_name, lat_name = cname.split("/")
        for vec in orbits:
            names.append(name_group(pg_name, lat_name, ac, vec))
            total += 1
    print(f"TOTAL 1+1D space-time groups: {total} (expected 13)")
    print("names:", sorted(names))
    expected = sorted(["P1", "P2", "Pm_x", "Pg_x", "Pm_t", "Pg_t", "Cm_x",
                       "Cm_t", "P2m_xm_t", "P2g_xg_t", "P2m_xg_t", "P2g_xm_t",
                       "C2m_xm_t"])
    assert total == 13, total
    assert sorted(names) == expected, sorted(names)
    print("matches Xu-Wu list ✓")

    import os
    import pickle
    os.makedirs("out", exist_ok=True)
    entries = []
    for cname, ac, orbits in results:
        pg_name, lat_name = cname.split("/")
        for vec in orbits:
            entries.append({"name": name_group(pg_name, lat_name, ac, vec),
                            "ac": ac, "vec": vec})
    with open("out/enum1p1.pkl", "wb") as f:
        pickle.dump(entries, f)
    print("saved out/enum1p1.pkl")


if __name__ == "__main__":
    main()
