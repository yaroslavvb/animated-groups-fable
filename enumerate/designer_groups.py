#!/usr/bin/env python3
"""Rebuild docs/data/xu-correspondence.json and docs/data/designer-groups.json.

WHY THIS EXISTS.  The designer's group menu was built once, by hand, with the
selection "forward film groups with clock order >= 3".  That quietly dropped
the 36 groups whose clock is a single half-period flip -- among them g6,
2_1 2_1 2_1 2_1, which is entry 01/51 of the correspondence table.  A clock of
order 2 is no less a clock than one of order 6: the 180 degree turn about
every 2-centre advances the film by half a period, and no instant of the film
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
import json
import urllib.request
from fractions import Fraction
from math import gcd
from pathlib import Path

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
        })
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
            "selection": "forward film groups with clock order >= 2",
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


if __name__ == "__main__":
    main()
