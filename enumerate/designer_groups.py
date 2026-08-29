#!/usr/bin/env python3
"""Rebuild docs/data/xu-correspondence.json and docs/data/designer-groups.json.

WHY THIS EXISTS.  The designer's group menu was built once, by hand, with the
selection "forward spacetime groups with clock order >= 3".  That quietly dropped
the 36 groups whose clock is a single half-period flip -- among them g6,
2_1 2_1 2_1 2_1, which is entry 01/51 of the correspondence table.  A clock of
order 2 is no less a clock than one of order 6: the 180 degree turn about
every 2-centre advances the animation by half a period, and no instant of the animation
has the full p2 symmetry.  So the menu, not the classification, was wrong.
Selection here is `clock order >= 2`, computed from the ops rather than
copied, and the list is generated rather than typed.

TWO OUTPUTS.
  xu-correspondence.json   the Conway / Goodman-Strauss reading of all 68
                           forward groups -- the book colour signature, the
                           ToS colour type G/K, the colour-fixing kernel and
                           the phase palette.  Vendored from
                           yaroslavvb.github.io/animated-groups, which derives
                           it from this repo's own catalog.json; the sha256 it
                           pins is checked here so the two cannot drift apart
                           unnoticed.
  designer-groups.json     the subset the designer can build billiards in,
                           plus the geometry it needs: basis, ops, generators.

Usage:  python3 designer_groups.py [--offline]
"""

import argparse
import hashlib
import itertools
import json
import urllib.request
from fractions import Fraction
from math import gcd
from pathlib import Path

# The canonical generators come from the patterns build, which is where the
# orbifold generating set of each wallpaper group is defined exactly. Python
# puts this script's own directory on the path, so a plain import finds it.
import enumerate_patterns

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data"
SOURCE = ("https://yaroslavvb.github.io/animated-groups/data/"
          "clockwork-coloring-correspondence.json")
PAGE = ("https://yaroslavvb.github.io/animated-groups/"
        "clockwork-coloring-correspondence.html")

SUPER = {"⁰": 0, "¹": 1, "²": 2, "³": 3, "⁴": 4,
         "⁵": 5, "⁶": 6, "⁷": 7, "⁸": 8, "⁹": 9}


def sig_html(sig):
    """the book signature with its superscripts as real <sup> markup"""
    return "".join(f"<sup>{SUPER[c]}</sup>" if c in SUPER else c for c in sig)


def sub_html(sym):
    """the catalogue symbol with its subscripts as real <sub> markup"""
    subs = {"₀": 0, "₁": 1, "₂": 2, "₃": 3, "₄": 4,
            "₅": 5, "₆": 6, "₇": 7, "₈": 8, "₉": 9}
    return "".join(f"<sub>{subs[c]}</sub>" if c in subs else c for c in sym)


def frac(x, limit=24):
    return Fraction(x).limit_denominator(limit)


def clock_order(g):
    """lcm of the denominators of the time offsets: the order of the clock"""
    n = 1
    for o in g["render"]["ops"]:
        d = frac(o["tau"] % 1).denominator
        n = n * d // gcd(n, d)
    return n


# --------------------------------------------------------------- the ops --
IDENT = ((1, 0), (0, 1))


def as_op(o):
    """(M, v, tau) with exact rationals, translations reduced mod the lattice"""
    M = tuple(tuple(int(x) for x in row) for row in o["M"])
    v = tuple(frac(x % 1) for x in o["v"])
    return (M, v, frac(o["tau"] % 1))


def compose(a, b):
    """a then b, i.e. b(a(x)) -- matches x -> Mx + v acting on the left"""
    (Ma, va, ta), (Mb, vb, tb) = a, b
    M = tuple(tuple(sum(Mb[i][k] * Ma[k][j] for k in range(2)) for j in range(2))
              for i in range(2))
    v = tuple(frac((sum(Mb[i][k] * va[k] for k in range(2)) + vb[i]) % 1)
              for i in range(2))
    return (M, v, frac((ta + tb) % 1))


def order_of(op):
    cur, n = op, 1
    ident = (IDENT, (Fraction(0), Fraction(0)), Fraction(0))
    while cur != ident and n < 25:
        cur = compose(cur, op)
        n += 1
    return n


def vec_words(v):
    """'1/3 a + 2/3 b' — a translation written in the cell's own basis"""
    parts = []
    for c, name in zip(v, ("a", "b")):
        c = ((c % 1) + 1) % 1
        if c > Fraction(1, 2):          # read the short way round
            c -= 1
        if c == 0:
            continue
        sign = "−" if c < 0 else ("+" if parts else "")
        mag = abs(c)
        parts.append(f"{sign} {mag} {name}" if parts else
                     f"{'−' if c < 0 else ''}{mag} {name}")
    return " ".join(parts) if parts else "0"


def describe(op, power, gen_order):
    """what this power of the generator DOES, in words a reader can check"""
    M, v, _ = op
    det = M[0][0] * M[1][1] - M[0][1] * M[1][0]
    if M == IDENT:
        return ("translation", f"Translation by {vec_words(v)}")
    if det == 1:
        turn = Fraction(power, gen_order)
        deg = 360 * turn
        word = ("Half-turn rotation (180°)" if turn == Fraction(1, 2)
                else f"{turn}-turn rotation ({deg}°)")
        return ("rotation", word)
    # det == -1: a mirror if the square is a lattice translation, else a glide
    gx = (M[0][0] * v[0] + M[0][1] * v[1] + v[0]) % 2
    gy = (M[1][0] * v[0] + M[1][1] * v[1] + v[1]) % 2
    pure = gx in (0, 2) and gy in (0, 2)
    return ("reflection" if pure else "glide",
            "Mirror reflection" if pure else "Glide reflection")


def time_shift(tau):
    return "none" if tau == 0 else f"+{tau} period"


def closure(elems):
    """the finite quotient the coset reps generate, translations mod 1"""
    ident = (IDENT, (Fraction(0), Fraction(0)), Fraction(0))
    seen = {ident} | set(elems)
    frontier = list(seen)
    while frontier:
        x = frontier.pop()
        for y in list(seen):
            for z in (compose(x, y), compose(y, x)):
                if z not in seen:
                    seen.add(z)
                    frontier.append(z)
    return seen


def geometric_ops(group):
    """A, A², B, … — a generating set and its powers, each with its time shift.

    Two things matter for this to read well. First close the coset reps into
    the actual finite quotient: the reps of 6₂3₂2 are a half-turn and a third-
    turn, and only their product is the sixfold generator the reader is
    looking for. Then take generators of the LARGEST order first, so a cyclic
    group is presented as one generator and its powers rather than as two
    unrelated ones. The group never exceeds eighteen elements, so this can be
    done by direct search."""
    ident = (IDENT, (Fraction(0), Fraction(0)), Fraction(0))
    full = closure({as_op(o) for o in group["render"]["ops"]})
    # rotations before reflections before translations, then by falling order:
    # the reader wants the turning generator named first
    def rank(e):
        M = e[0]
        det = M[0][0] * M[1][1] - M[0][1] * M[1][0]
        kind = 2 if M == IDENT else (0 if det == 1 else 1)
        return (kind, -order_of(e), str(e))

    reached = {ident}
    out, letter = [], ord("A")
    for e in sorted(full, key=rank):
        if e in reached:
            continue
        n = order_of(e)
        cur = e
        for k in range(1, n):
            kind, text = describe(cur, k, n)
            out.append({
                "generator": chr(letter),
                "power": str(k),
                "role": "generator" if k == 1 else "power",
                "kind": kind,
                "operation": text,
                "phase": str(cur[2]),
                "timeShift": time_shift(cur[2]),
            })
            cur = compose(cur, e)
        reached = closure(reached | {e})
        letter += 1
    return out


# ------------------------------------------ the canonical generators --

# WHY THIS IS NOT A LOOKUP.
#
# patterns.html presents every wallpaper group by its ORBIFOLD generators --
# one per cone point, one per mirror boundary -- named α β γ δ / P Q Z and
# tied by relations like αβγ = 1. The designer derived its own generating set
# by search and named it A, B, C. Both are correct and they are not the same
# set, so a statement carried from one page to the other was not checkable:
# there was no α in the designer to compare patterns' α with.
#
# The two cannot simply share a table, because they do not share a CELL.
# patterns works in the wallpaper group's own primitive cell; the designer
# works in the COLOUR cell -- the period cell of the animation, which is the
# parent cell only when the clock is carried entirely by point operations and
# is n times larger when translations carry part of it. The origins and the
# axes were chosen independently on top of that: the designer's pmg sits in a
# cell turned a quarter turn from patterns', and its pgg origin is an eighth
# of a cell away from patterns'.
#
# So the generators are TRANSPORTED. Find the change of cell
#
#     y = M0 x + t0        x in patterns' cell, y in the designer's
#
# whose M0 carries the parent's translation lattice onto the parent
# translations as the designer sees them, and which lands every canonical
# generator on an element the designer's op table actually holds. Then each
# generator's time shift is simply read off that table.
#
# WHICH TRANSPORT. There is more than one -- the group's own normaliser
# permutes the cone points, and 27 of the 51 groups admit transports that
# disagree about which 3-centre is α. The labelling is pinned by the COLOUR
# GROUP, which is the whole point of the exercise: a cyclic colour
# permutation IS a time shift, so the vector of shifts, read as exponents of
# the clock, must be the vector of exponents patterns.html publishes for one
# of its colour groups over the same wallpaper. Every one of the 51 lands on
# exactly one colour group, and on it exactly -- not merely up to a
# relabelling of the colours. So the designer's α is patterns' α, and what
# patterns prints as a cycle this page prints as a time shift.


def _mmul(A, B):
    return tuple(tuple(sum(A[i][k] * B[k][j] for k in range(2))
                       for j in range(2)) for i in range(2))


def _minv(A):
    d = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    return ((A[1][1] / d, -A[0][1] / d), (-A[1][0] / d, A[0][0] / d))


def _mvec(A, v):
    return (A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1])


def _exact(M):
    return tuple(tuple(Fraction(x) for x in row) for row in M)


def _integral(M):
    return all(x.denominator == 1 for row in M for x in row)


def _int_mat(M):
    return tuple(tuple(int(x) for x in row) for row in M)


def cell_bases(lattice):
    """Every small basis of Z² + `lattice` — the candidate linear parts.

    The parent's translations, seen in the designer's cell, are Z² together
    with the translation parts of its identity ops: one entry when the clock
    is carried by point operations alone, n of them when the animation's cell
    is n parent cells. M0 has to carry patterns' Z² onto exactly that, so its
    columns are a basis of it."""
    den = 1
    for v in lattice:
        for c in v:
            den = den * c.denominator // gcd(den, c.denominator)
    pts = [p for p in (( Fraction(a, den), Fraction(b, den))
                       for a in range(-den, den + 1)
                       for b in range(-den, den + 1))
           if any((p[0] - w[0]).denominator == 1 and (p[1] - w[1]).denominator == 1
                  for w in [(Fraction(0), Fraction(0))] + lattice)]
    want = Fraction(1, len(lattice))
    return [((w1[0], w2[0]), (w1[1], w2[1]))
            for w1, w2 in itertools.product(pts, repeat=2)
            if abs(w1[0] * w2[1] - w1[1] * w2[0]) == want]


# Origins are searched on a grid rather than solved for: a mirror generator
# leaves I - M singular and the solve has cases, while the grid has none. The
# denominator has to admit an eighth (pgg's origin) and a twelfth (the
# hexagonal ones), so it is their lcm.
ORIGIN_STEPS = 24


def transport_shifts(group, gens):
    """{generator name: time shift} for every change of cell that works."""
    ops = {(M, v): tau for M, v, tau in
           (as_op(o) for o in group["render"]["ops"])}
    lattice = [v for (M, v) in ops if M == IDENT]
    out = []
    for M0 in cell_bases(lattice):
        M0inv = _minv(M0)
        moved = []
        for name, (M, v) in gens:
            Mp = _mmul(_mmul(M0, _exact(M)), M0inv)
            if not _integral(Mp):
                break                      # this cell does not carry the group
            moved.append((name, _int_mat(Mp), _mvec(M0, (Fraction(v[0]),
                                                        Fraction(v[1])))))
        else:
            for a in range(ORIGIN_STEPS):
                for b in range(ORIGIN_STEPS):
                    t0 = (Fraction(a, ORIGIN_STEPS), Fraction(b, ORIGIN_STEPS))
                    shifts = {}
                    for name, Mp, M0v in moved:
                        Mt = _mvec(_exact(Mp), t0)
                        key = (Mp, ((M0v[0] - Mt[0] + t0[0]) % 1,
                                    (M0v[1] - Mt[1] + t0[1]) % 1))
                        if key not in ops:
                            break
                        shifts[name] = ops[key]
                    else:
                        out.append(shifts)
    return out


def perm_of(cycle, k):
    """a cycle string as written in patterns.json, as a permutation tuple"""
    p = list(range(k))
    if cycle.strip() == "1":
        return tuple(p)
    for part in cycle.replace(")(", ")|(").split("|"):
        letters = [ord(c) - 65 for c in part if c.isalpha()]
        for i, c in enumerate(letters):
            p[c] = letters[(i + 1) % len(letters)]
    return tuple(p)


def perm_compose(p, q):
    return tuple(p[q[i]] for i in range(len(q)))


def cyclic_exponents(cycles, k):
    """{generator: exponent of a clock generator}, or None if the colour
    group is not a cyclic group of order k acting regularly.

    The clock generator is looked for in the whole GENERATED group and not
    among the listed permutations: over p31m the six-colour cyclic group is
    generated by a three-cycle and an involution, and neither of them alone
    generates it."""
    perms = {n: perm_of(c, k) for n, c in cycles.items()}
    ident = tuple(range(k))
    grp, frontier = {ident}, [ident]
    while frontier:
        x = frontier.pop()
        for gp in perms.values():
            y = perm_compose(x, gp)
            if y not in grp:
                grp.add(y)
                frontier.append(y)
    for rho in sorted(grp):
        powers, cur = {}, ident
        while cur not in powers:
            powers[cur] = len(powers)
            cur = perm_compose(cur, rho)
        if len(powers) == k and all(p in powers for p in perms.values()):
            return {n: powers[p] for n, p in perms.items()}
    return None


def canonical_generators(group, entry, patterns, chaim):
    """patterns.html's generators for this group, with their time shifts, and
    the colour group the reading identifies. None when nothing matches."""
    hm = entry["parentHm"]
    fam = patterns["wallpaper"].get(hm)
    if not fam or hm not in chaim:
        return None
    names = [n for n, _ in chaim[hm]["gens"]]
    if names != [g["name"] for g in fam["generators"]]:
        raise SystemExit(f"{hm}: patterns.json and the CHAIM table disagree "
                         f"about the generators ({names} vs "
                         f"{[g['name'] for g in fam['generators']]})")
    n = entry["clockOrder"]
    shifts = transport_shifts(group, chaim[hm]["gens"])
    if not shifts:
        return None
    vectors = {tuple(int(s[name] * n) % n for name in names): s for s in shifts}
    for cg in patterns["groups"]:
        if cg["hm"] != hm or cg["k"] != n:
            continue
        exps = cyclic_exponents(cg["cycles"], n)
        if not exps:
            continue
        want = tuple(exps[name] % n for name in names)
        if want not in vectors:
            continue
        chosen = vectors[want]
        # An independent check on the whole identification: the colour-fixing
        # kernel is read here from the Xu correspondence and there from the
        # pattern enumeration, by two calculations that share nothing. If the
        # transport had landed on the wrong colour group they would part.
        if cg["kernel_orb"] != entry["kernelOrbifold"]:
            raise SystemExit(
                f"{group['id']}: matched {cg['id']}, but its kernel is "
                f"{cg['kernel_orb']} and the correspondence says "
                f"{entry['kernelOrbifold']}")
        return {
            "colourGroup": cg["id"],
            "gs": cg["gs"],
            # what patterns.html prints for it: the published G&S symbol where
            # the books name the group, and its own systematic symbol where
            # they do not. Built the same way here so the two pages call the
            # colouring by the same name.
            "symbol": cg["gs"] or (f"{cg['hm']}[{cg['k']}]" + "".join(
                "₀₁₂₃₄₅₆₇₈₉"[int(d)] for d in cg["id"].rsplit("-", 1)[-1])),
            "patternsUrl": f"patterns.html#group-{cg['id']}",
            "relations": fam["relations"],
            "generators": [
                {"name": g["name"],
                 "geometry": g["geometry"],
                 "kind": g["kind"],
                 "phase": str(chosen[g["name"]]),
                 "timeShift": time_shift(chosen[g["name"]]),
                 "cycle": cg["cycles"][g["name"]]}
                for g in fam["generators"]],
        }
    return None


# ------------------------------------------------------------------ main --
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true",
                    help="reuse the vendored xu-correspondence.json")
    args = ap.parse_args()

    catalog = json.loads((DATA / "catalog.json").read_text())
    by_id = {g["id"]: g for g in catalog["groups"]}

    vendored = DATA / "xu-correspondence.json"
    if args.offline and vendored.exists():
        corr = json.loads(vendored.read_text())
        entries = corr["groups"]
        print(f"offline: {len(entries)} entries from {vendored.name}")
    else:
        raw = json.loads(urllib.request.urlopen(SOURCE).read().decode())
        pinned = raw["meta"].get("source_catalog_sha256")
        mine = hashlib.sha256((DATA / "catalog.json").read_bytes()).hexdigest()
        if pinned and pinned != mine:
            raise SystemExit(
                f"the correspondence data was built against a different "
                f"catalog.json\n  it pins {pinned}\n  ours is  {mine}\n"
                f"regenerate the catalog or refresh the correspondence first")
        print(f"catalog sha256 matches the correspondence data ({mine[:12]}…)")
        entries = {}
        for g in raw["groups"]:
            sig = g["book_color_signature"]
            entries[g["id"]] = {
                "id": g["id"],
                "ordinal": g["ordinal"],
                "signature": sig,
                "signatureHtml": sig_html(sig),
                "tos": g["tos_notation"],
                "clockOrder": g["clock_order"],
                "cyclic": g["cyclic_group"],
                "parentOrbifold": g["parent"]["orbifold"],
                "parentHm": g["parent"]["hm"],
                "kernelOrbifold": g["kernel"]["orbifold"],
                "kernelHm": g["kernel"]["hm"],
                "phaseLabels": [p["phase"] for p in g["phase_residues"]],
                "phaseColors": [p["color"] for p in g["phase_residues"]],
                "correspondenceUrl": f"{PAGE}#{g['id']}",
            }
        corr = {
            "meta": {
                "source": SOURCE,
                "sourceSchemaVersion": raw["meta"]["schema_version"],
                "catalogSha256": mine,
                "selection": "group.forward == true",
                "count": len(entries),
                "notation": "book colour signature and G/K colour type from "
                            "The Symmetries of Things (Conway, Burgiel, "
                            "Goodman-Strauss 2008)",
            },
            "groups": entries,
        }
        vendored.write_text(json.dumps(corr, ensure_ascii=False, indent=1))
        print(f"wrote {vendored.relative_to(ROOT)}  ({len(entries)} forward groups)")
        entries = corr["groups"]

    # The fifteen entries that were written by hand carry richer generator
    # prose than anything derived here can — "about centre D", a named glide
    # axis. Those are kept exactly as they were; only the groups that were
    # missing get machine-derived text. Nothing that already reads well is
    # traded for uniformity.
    prior_path = DATA / "designer-groups.json"
    prior = {}
    if prior_path.exists():
        prior = {g["id"]: g for g in json.loads(prior_path.read_text())["groups"]}

    # the canonical generators, and the exact table they are defined in
    patterns = json.loads((DATA / "patterns.json").read_text())
    enumerate_patterns.build_chaim()
    chaim = enumerate_patterns.CHAIM
    uncanonical = []

    # --- the designer's menu: every clockwork group with a real clock ---
    picked = []
    for gid, e in entries.items():
        g = by_id[gid]
        n = clock_order(g)
        if n != e["clockOrder"]:
            raise SystemExit(f"{gid}: clock order {n} computed, "
                             f"{e['clockOrder']} in the correspondence data")
        if n < 2:
            continue
        picked.append({
            "id": gid,
            "n": n,
            "signature": e["signature"],
            "signatureHtml": e["signatureHtml"],
            "cyclic": e["cyclic"],
            "fable": g["symbol"],
            "fableHtml": g.get("symbolHtml") or sub_html(g["symbol"]),
            "parentOrbifold": e["parentOrbifold"],
            "parentHm": e["parentHm"],
            "kernelOrbifold": e["kernelOrbifold"],
            "kernelHm": e["kernelHm"],
            "system": g["system"],
            "phaseColors": e["phaseColors"],
            "phaseLabels": e["phaseLabels"],
            "correspondenceUrl": e["correspondenceUrl"],
            "catalogUrl": f"group.html?g={gid}",
            "basis": g["render"]["basis"],
            "ops": g["render"]["ops"],
            "generators": [
                {"expr": line.split("#")[0].strip(),
                 "note": line.split("#")[1].strip() if "#" in line else ""}
                for line in g["generators"]],
            "hm": g.get("hm", ""),
            "geometricOps": (prior[gid]["geometricOps"] if gid in prior
                             else geometric_ops(g)),
            # patterns.html's own generators, if this group's clock can be read
            # as one of its colour groups; null leaves the page on the derived
            # A, B listing rather than on a labelling nothing pinned
            "canonical": canonical_generators(g, e, patterns, chaim),
        })
        if picked[-1]["canonical"] is None:
            uncanonical.append(gid)
    # Order in this file is the WIRE order urlstate.js freezes: position is the
    # value a shared link carries, so old entries keep their index and new ones
    # are appended. Sorting the whole list would silently repoint every link
    # ever copied out of the designer.
    was = list(prior)
    picked.sort(key=lambda p: (was.index(p["id"]) if p["id"] in prior
                               else len(was),
                               p["n"], p["parentOrbifold"], int(p["id"][1:])))

    orders = sorted({p["n"] for p in picked})
    out = {
        "meta": {
            "count": len(picked),
            "selection": "forward spacetime groups with clock order >= 2",
            "colorOrders": orders,
            "notation": "book_color_signature from The Symmetries of Things "
                        "(Conway, Burgiel, Goodman-Strauss 2008)",
            "source": "data/xu-correspondence.json",
            "palette": ["#0072B2", "#E69F00", "#009E73",
                        "#CC79A7", "#D55E00", "#56B4E9"],
            "byColors": {str(n): [p["id"] for p in picked if p["n"] == n]
                         for n in orders},
        },
        "groups": picked,
    }
    (DATA / "designer-groups.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1))
    print(f"wrote docs/data/designer-groups.json  {len(picked)} groups, "
          f"orders {orders}: " +
          ", ".join(f"{n}→{sum(1 for p in picked if p['n'] == n)}" for n in orders))
    print("  ids in wire order (append-only!):")
    print("   ", " ".join(p["id"] for p in picked))
    named = len(picked) - len(uncanonical)
    print(f"  canonical generators: {named}/{len(picked)} groups carry "
          f"patterns.html's own labelling")
    if uncanonical:
        print("    no colour group matched, left on the derived listing:",
              " ".join(uncanonical))


if __name__ == "__main__":
    main()
