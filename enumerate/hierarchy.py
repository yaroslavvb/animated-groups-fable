#!/usr/bin/env python3
"""Build the data behind docs/hierarchy.html.

The hierarchy page is an essay about how six classifications fit together:
the 17 wallpaper groups, the coloured wallpaper groups up to six colours, the
275 spacetime groups, the 68 forward-time ones we call clockwork
groups, the 230 space groups, and the 68 polar space groups among them.  Every
count printed on that page is produced here, from `docs/data/catalog.json`, so
that none of them is a number typed in by hand and left to rot.

Three kinds of input meet in this script.

1. *Recomputed.*  Anything that is a property of our own 275-group catalog:
   the image of each spacetime group's clock in Isom(S^1), the totals by clock
   order, by spatial projection, by crystal system.  Pure Python.

2. *Pinned.*  The 3D space-group type of each of the 275, as an International
   Tables number.  These come from spglib and are stored in PINNED_IT below,
   so that the normal run needs no dependency; `--verify` recomputes them with
   spglib and fails loudly on any disagreement.  The same table, restricted to
   the 68 forward groups, was independently produced under spglib 2.6.0 in the
   companion animated-groups repository and agrees record for record.

3. *Literature.*  Wieting's totals for all transitive N-colourings of the
   plane groups, and the Senechal--Wieting per-group counts of normal
   index-N subgroups with cyclic quotient.  These are constants with a
   citation, not something we recompute; they are the outside yardstick the
   page measures our own counts against.

Run:

    python3 enumerate/hierarchy.py            # write docs/data/hierarchy.json
    python3 enumerate/hierarchy.py --verify   # also recheck the pins (spglib)
    python3 enumerate/hierarchy.py --report   # print the tables to stdout
"""

from __future__ import annotations

import argparse
import collections
import json
import math
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "docs" / "data" / "catalog.json"
OUT = ROOT / "docs" / "data" / "hierarchy.json"

MAX_COLOURS = 6

# --------------------------------------------------------------------------
# literature constants
# --------------------------------------------------------------------------

# T. W. Wieting, *The Mathematical Theory of Chromatic Plane Ornaments*
# (Dekker, 1982), Table 11: the number of N-colour plane groups, i.e. of
# transitive N-colourings of the 17 plane groups up to plane-affine
# equivalence.  Also OEIS A307293.  The sequence is famously not monotone.
WIETING_ALL = {1: 17, 2: 46, 3: 23, 4: 96, 5: 14, 6: 90}

# Senechal--Wieting, per wallpaper group: the number of normal subgroups of
# index N with *cyclic* quotient C_N, up to plane-affine equivalence -- the
# colourings in which the colour group is C_N acting regularly, so that
# "colour" can be read as "phase on a clock".  Rows are N = 1..6.
CYCLIC_BY_BASE = {
    "p1":   (1, 1, 1, 1, 1, 1),
    "p2":   (1, 2, 0, 0, 0, 0),
    "pm":   (1, 5, 1, 3, 1, 5),
    "pg":   (1, 2, 1, 2, 1, 2),
    "cm":   (1, 3, 1, 2, 1, 3),
    "pmm":  (1, 5, 0, 0, 0, 0),
    "pmg":  (1, 5, 0, 0, 0, 0),
    "pgg":  (1, 2, 0, 1, 0, 0),
    "cmm":  (1, 5, 0, 0, 0, 0),
    "p4":   (1, 2, 0, 2, 0, 0),
    "p4m":  (1, 5, 0, 0, 0, 0),
    "p4g":  (1, 3, 0, 2, 0, 0),
    "p3":   (1, 0, 2, 0, 0, 0),
    "p3m1": (1, 1, 0, 0, 0, 0),
    "p31m": (1, 1, 1, 0, 0, 1),
    "p6":   (1, 1, 1, 0, 0, 1),
    "p6m":  (1, 3, 0, 0, 0, 0),
}

ORBIFOLD = {
    "p1": "◦", "p2": "2222", "pm": "**", "pg": "××",
    "cm": "*×", "pmm": "*2222", "pmg": "22*", "pgg": "22×",
    "cmm": "2*22", "p4": "442", "p4m": "*442", "p4g": "4*2",
    "p3": "333", "p3m1": "*333", "p31m": "3*3", "p6": "632", "p6m": "*632",
}
BASE_ORDER = list(ORBIFOLD)

# The wallpaper groups whose point group contains no rotation: the only ones
# with an invariant direction along which a phase gradient is a pure drift.
ROTATION_FREE = ("p1", "pm", "pg", "cm")

# --------------------------------------------------------------------------
# pinned 3D space-group types
# --------------------------------------------------------------------------

# id -> International Tables number of the 3D space group obtained by reading
# the clock phase as a third coordinate.  Produced by spglib from each
# catalog entry's own operations and cell; --verify recomputes it.
PINNED_IT = {
    int(a): int(b) for a, b in (
        pair.split(":") for pair in (
            "1:1 2:5 3:3 4:4 5:3 6:4 7:5 8:8 9:9 10:6 11:7 12:6 13:7 14:8 "
            "15:9 16:2 17:21 18:20 19:16 20:17 21:18 22:19 23:17 24:18 25:22 "
            "26:23 27:24 28:38 29:40 30:39 31:41 32:25 33:28 34:30 35:34 "
            "36:27 37:30 38:28 39:32 40:26 41:29 42:29 43:33 44:26 45:31 "
            "46:31 47:33 48:42 49:43 50:44 51:46 52:46 53:45 54:25 55:27 "
            "56:28 57:30 58:32 59:34 60:26 61:29 62:31 63:33 64:38 65:39 "
            "66:40 67:41 68:35 69:37 70:36 71:44 72:45 73:46 74:42 75:43 "
            "76:81 77:82 78:35 79:36 80:36 81:37 82:38 83:39 84:40 85:41 "
            "86:10 87:13 88:11 89:14 90:12 91:15 92:21 93:20 94:75 95:77 "
            "96:76 97:78 98:79 99:80 100:10 101:11 102:13 103:14 104:12 "
            "105:15 106:111 107:112 108:113 109:114 110:115 111:116 112:117 "
            "113:118 114:121 115:122 116:119 117:120 118:89 119:93 120:95 "
            "121:91 122:90 123:94 124:96 125:92 126:97 127:98 128:99 129:105 "
            "130:101 131:103 132:100 133:106 134:102 135:104 136:107 "
            "137:109 138:108 139:110 140:47 141:49 142:51 143:53 144:55 "
            "145:58 146:51 147:59 148:57 149:62 150:49 151:50 152:51 153:54 "
            "154:54 155:52 156:57 157:60 158:53 159:54 160:57 161:55 162:60 "
            "163:56 164:61 165:62 166:50 167:48 168:53 169:52 170:59 171:56 "
            "172:52 173:60 174:58 175:62 176:65 177:66 178:63 179:63 180:67 "
            "181:68 182:64 183:64 184:65 185:66 186:63 187:67 188:68 189:64 "
            "190:71 191:72 192:74 193:72 194:74 195:73 196:69 197:70 198:83 "
            "199:84 200:85 201:86 202:87 203:88 204:123 205:131 206:124 "
            "207:132 208:127 209:135 210:128 211:136 212:125 213:133 "
            "214:126 215:134 216:129 217:137 218:130 219:138 220:139 "
            "221:140 222:141 223:142 224:143 225:145 226:144 227:146 "
            "228:147 229:148 230:156 231:158 232:157 233:159 234:160 "
            "235:161 236:174 237:149 238:151 239:153 240:150 241:154 "
            "242:152 243:168 244:171 245:172 246:173 247:170 248:169 "
            "249:155 250:189 251:190 252:187 253:188 254:162 255:163 "
            "256:164 257:165 258:166 259:167 260:177 261:180 262:181 "
            "263:182 264:179 265:178 266:175 267:176 268:183 269:185 "
            "270:184 271:186 272:191 273:193 274:194 275:192"
        ).split()
    )
}

# The 68 polar (pyroelectric-class) space-group types: Hermann--Mauguin short
# symbol and geometric crystal class, for the columns of the 68-row table.
PINNED_POLAR = {
    1: ("P1", "1"), 3: ("P2", "2"), 4: ("P2_1", "2"), 5: ("C2", "2"),
    6: ("Pm", "m"), 7: ("Pc", "m"), 8: ("Cm", "m"), 9: ("Cc", "m"),
    25: ("Pmm2", "mm2"), 26: ("Pmc2_1", "mm2"), 27: ("Pcc2", "mm2"),
    28: ("Pma2", "mm2"), 29: ("Pca2_1", "mm2"), 30: ("Pnc2", "mm2"),
    31: ("Pmn2_1", "mm2"), 32: ("Pba2", "mm2"), 33: ("Pna2_1", "mm2"),
    34: ("Pnn2", "mm2"), 35: ("Cmm2", "mm2"), 36: ("Cmc2_1", "mm2"),
    37: ("Ccc2", "mm2"), 38: ("Amm2", "mm2"), 39: ("Aem2", "mm2"),
    40: ("Ama2", "mm2"), 41: ("Aea2", "mm2"), 42: ("Fmm2", "mm2"),
    43: ("Fdd2", "mm2"), 44: ("Imm2", "mm2"), 45: ("Iba2", "mm2"),
    46: ("Ima2", "mm2"), 75: ("P4", "4"), 76: ("P4_1", "4"),
    77: ("P4_2", "4"), 78: ("P4_3", "4"), 79: ("I4", "4"), 80: ("I4_1", "4"),
    99: ("P4mm", "4mm"), 100: ("P4bm", "4mm"), 101: ("P4_2cm", "4mm"),
    102: ("P4_2nm", "4mm"), 103: ("P4cc", "4mm"), 104: ("P4nc", "4mm"),
    105: ("P4_2mc", "4mm"), 106: ("P4_2bc", "4mm"), 107: ("I4mm", "4mm"),
    108: ("I4cm", "4mm"), 109: ("I4_1md", "4mm"), 110: ("I4_1cd", "4mm"),
    143: ("P3", "3"), 144: ("P3_1", "3"), 145: ("P3_2", "3"), 146: ("R3", "3"),
    156: ("P3m1", "3m"), 157: ("P31m", "3m"), 158: ("P3c1", "3m"),
    159: ("P31c", "3m"), 160: ("R3m", "3m"), 161: ("R3c", "3m"),
    168: ("P6", "6"), 169: ("P6_1", "6"), 170: ("P6_5", "6"),
    171: ("P6_2", "6"), 172: ("P6_4", "6"), 173: ("P6_3", "6"),
    183: ("P6mm", "6mm"), 184: ("P6cc", "6mm"), 185: ("P6_3cm", "6mm"),
    186: ("P6_3mc", "6mm"),
}

# The four enantiomorphic pairs among the polar types: mirror-image animations that
# are one coloured pattern but two spacetime groups.
ENANTIOMORPHIC_PAIRS = ((76, 78), (144, 145), (169, 170), (171, 172))

SYSTEM_RANGES = (
    (1, 2, "triclinic"), (3, 15, "monoclinic"), (16, 74, "orthorhombic"),
    (75, 142, "tetragonal"), (143, 167, "trigonal"), (168, 194, "hexagonal"),
    (195, 230, "cubic"),
)


def system_of(it: int) -> str:
    for lo, hi, name in SYSTEM_RANGES:
        if lo <= it <= hi:
            return name
    raise ValueError(it)


# --------------------------------------------------------------------------
# recomputed from the catalog
# --------------------------------------------------------------------------

def phase(value) -> Fraction:
    """A catalog time offset as its exact small rational, mod 1."""
    raw = float(value) % 1.0
    exact = Fraction(raw).limit_denominator(12)
    if abs(float(exact) - raw) > 1e-8 and abs(float(exact) - 1 - raw) > 1e-8:
        raise ValueError(f"time offset is not a small catalog rational: {value!r}")
    return exact % 1


def has_pure_reversal(group) -> bool:
    """Does G contain a reversal that acts trivially on space?

    Such an element is (x, t) -> (x, -t + tau0): the animation played backwards is
    itself, with nothing moved. Its presence is what stops the clock from
    colouring the projection, because then the map G -> Isom(S^1) is not
    trivial on the kernel of the spatial projection and so does not descend.
    """
    return any(o["M"] == [[1, 0], [0, 1]] and phase(o["v"][0]) == 0
               and phase(o["v"][1]) == 0 and o["s"] == -1
               for o in group["render"]["ops"])


def clock_image(group) -> tuple[int, bool]:
    """The image of a spacetime group in Isom(S^1), as (N, contains a reversal).

    Every element acts on the loop as t -> t + tau or t -> -t + tau.  The
    forward ones give rotations of the phase circle directly; a pair of
    reversals composes to the rotation by their difference.  The rotations so
    obtained generate a finite cyclic group of order N, so the image is C_N
    when the group is forward and the dihedral group D_N when it is not.
    """
    ops = group["render"]["ops"]
    forward = [phase(o["tau"]) for o in ops if o["s"] == 1]
    reversing = [phase(o["tau"]) for o in ops if o["s"] == -1]
    order = 1
    for tau in forward:
        order = math.lcm(order, tau.denominator)
    for a in reversing:
        for b in reversing:
            order = math.lcm(order, ((a - b) % 1).denominator)
    return order, bool(reversing)


def build(groups):
    rows = []
    for g in groups:
        n, reversing = clock_image(g)
        it = PINNED_IT[int(g["id"][1:])]
        rows.append(dict(id=g["id"], symbol=g["symbol"], symbolHtml=g["symbolHtml"],
                         base=g["base"], system=g["system"], product=g["product"],
                         forward=g["forward"], clock=n, reversing=reversing, it=it,
                         pureReversal=has_pure_reversal(g)))
        if reversing == g["forward"]:
            raise AssertionError(f"{g['id']}: forward flag disagrees with its operations")
    return rows


def report(rows):
    data = {}

    forward = [r for r in rows if not r["reversing"]]
    data["headline"] = dict(
        spacetimeGroups=len(rows), clockwork=len(forward), wallpaper=17,
        spaceGroups=230, cubic=36, nonCubic=194, polar=68,
        clockworkNonProduct=sum(1 for r in forward if not r["product"]),
    )

    # --- colours -----------------------------------------------------------
    by_clock = collections.Counter(r["clock"] for r in forward)
    data["colourCensus"] = [
        dict(n=n, wieting=WIETING_ALL[n],
             cyclic=sum(CYCLIC_BY_BASE[b][n - 1] for b in BASE_ORDER),
             clockwork=by_clock.get(n, 0))
        for n in range(1, MAX_COLOURS + 1)
    ]

    spacetime_by_base = collections.defaultdict(lambda: [0] * MAX_COLOURS)
    for r in forward:
        spacetime_by_base[r["base"]][r["clock"] - 1] += 1
    data["byOrbifold"] = [
        dict(hm=b, orbifold=ORBIFOLD[b], cyclic=list(CYCLIC_BY_BASE[b]),
             spacetime=list(spacetime_by_base[b]),
             cyclicTotal=sum(CYCLIC_BY_BASE[b]), spacetimeTotal=sum(spacetime_by_base[b]))
        for b in BASE_ORDER
    ]
    data["rotationFree"] = dict(
        bases=list(ROTATION_FREE),
        cyclic=sum(sum(CYCLIC_BY_BASE[b]) for b in ROTATION_FREE),
        spacetime=sum(sum(spacetime_by_base[b]) for b in ROTATION_FREE),
    )

    # --- the clock's image -------------------------------------------------
    data["phaseImage"] = [
        dict(n=n,
             cyclic=sum(1 for r in rows if not r["reversing"] and r["clock"] == n),
             dihedral=sum(1 for r in rows if r["reversing"] and r["clock"] == n))
        for n in (1, 2, 3, 4, 6)
    ]

    # --- which colouring of the projection a spacetime group induces ------------
    #
    # Write Phi: G -> Isom(S^1) for the action on the loop. Phi descends to the
    # projected wallpaper group exactly when no element acts trivially on space
    # and non-trivially on time, i.e. when G has no pure time reversal; the
    # colours are then the cosets of ker Phi and the colour group is the image.
    # D_1 is cyclic of order 2, so it colours as well as C_N does — the colour
    # is the direction of time rather than a phase. That row is the answer to
    # "regular cyclic colour group, yet the animation runs backwards".
    def kind(r):
        if not r["reversing"]:
            return "cyclic"
        if r["pureReversal"]:
            return "none"
        return "antisymmetry" if r["clock"] == 1 else "dihedral"

    kinds = collections.Counter(kind(r) for r in rows)
    data["colouringKinds"] = [
        dict(key="cyclic", image="C<sub>N</sub>", descends=True,
             colourGroup="C<sub>N</sub>, regular", colour="phase",
             count=kinds["cyclic"]),
        dict(key="antisymmetry", image="D<sub>1</sub>", descends=True,
             colourGroup="C<sub>2</sub>, regular", colour="direction of time",
             count=kinds["antisymmetry"]),
        dict(key="dihedral", image="D<sub>N</sub>, N&nbsp;≥&nbsp;2", descends=True,
             colourGroup="D<sub>N</sub> on 2N colours", colour="phase and direction",
             count=kinds["dihedral"]),
        dict(key="none", image="C<sub>N</sub> or D<sub>N</sub>", descends=False,
             colourGroup="—", colour="—", count=kinds["none"]),
    ]
    data["regularCyclicTotal"] = kinds["cyclic"] + kinds["antisymmetry"]

    # The groups with a pure time reversal. Conjugating a forward element by
    # one negates its phase, so 2*tau lies in the loop lattice and the clock
    # has order 1 or 2 — and per wallpaper group the counts are exactly the
    # Senechal--Wieting numbers of cyclic subgroups of index 1 and 2, i.e. the
    # 17 grey and 46 black-white plane groups.
    pure = [r for r in rows if r["pureReversal"]]
    pure_by_base = {b: [sum(1 for r in pure if r["base"] == b and r["clock"] == n)
                        for n in (1, 2)] for b in BASE_ORDER}
    data["pureReversal"] = dict(
        count=len(pure),
        byClock={str(n): sum(1 for r in pure if r["clock"] == n) for n in (1, 2)},
        byBase=[dict(hm=b, orbifold=ORBIFOLD[b], spacetime=pure_by_base[b],
                     colourings=list(CYCLIC_BY_BASE[b][:2])) for b in BASE_ORDER],
        matchesMagneticPlaneGroups=all(
            pure_by_base[b] == list(CYCLIC_BY_BASE[b][:2]) for b in BASE_ORDER),
    )
    assert {r["clock"] for r in pure} <= {1, 2}, \
        "a pure time reversal forces a clock of order 1 or 2"
    assert data["pureReversal"]["matchesMagneticPlaneGroups"], \
        "the pure-reversal groups do not match the magnetic plane groups base by base"
    assert sum(k["count"] for k in data["colouringKinds"]) == len(rows)

    # --- forgetting which axis is time -------------------------------------
    fibre = collections.defaultdict(list)
    for r in rows:
        fibre[r["it"]].append(r)
    by_system = collections.defaultdict(lambda: collections.Counter())
    for it, members in fibre.items():
        by_system[system_of(it)][len(members)] += 1
    data["fibres"] = dict(
        types=len(fibre),
        sizeCounts={str(k): v for k, v in
                    sorted(collections.Counter(len(v) for v in fibre.values()).items())},
        bySystem=[
            dict(system=name,
                 types=sum(by_system[name].values()),
                 spacetimeGroups=sum(k * v for k, v in by_system[name].items()),
                 sizes={str(k): v for k, v in sorted(by_system[name].items())})
            for _, _, name in SYSTEM_RANGES if by_system[name]
        ],
    )

    # --- clockwork = polar -------------------------------------------------
    polar_rows = []
    for r in sorted(forward, key=lambda r: r["it"]):
        hm, pg = PINNED_POLAR[r["it"]]
        polar_rows.append(dict(id=r["id"], symbol=r["symbol"], symbolHtml=r["symbolHtml"],
                               base=r["base"], orbifold=ORBIFOLD[r["base"]],
                               clock=r["clock"], it=r["it"], hm=hm, pointGroup=pg,
                               system=system_of(r["it"]), product=r["product"]))
    data["polarTable"] = polar_rows
    data["enantiomorphicPairs"] = [list(p) for p in ENANTIOMORPHIC_PAIRS]

    # a fibre worth showing: one 3D crystal, three different animations
    biggest = max(fibre.items(), key=lambda kv: (len(kv[1]), -kv[0]))
    data["fibreExample"] = dict(
        it=biggest[0], hm=PINNED_POLAR.get(biggest[0], ("", ""))[0],
        members=[dict(id=m["id"], symbol=m["symbol"], symbolHtml=m["symbolHtml"],
                      forward=m["forward"], base=m["base"]) for m in biggest[1]],
    )

    # --- the assertions the page's claims rest on --------------------------
    assert len(rows) == 275
    assert len(forward) == 68
    assert data["fibres"]["types"] == 194
    assert max(fibre) <= 194, "a spacetime group landed in a cubic type"
    assert sorted(fibre) == list(range(1, 195)), "the 194 non-cubic types are not all hit"
    assert sorted({r["it"] for r in forward}) == sorted(PINNED_POLAR), \
        "the forward groups are not in bijection with the polar types"
    assert sum(v * int(k) for k, v in data["fibres"]["sizeCounts"].items()) == 275
    assert sum(row["clockwork"] for row in data["colourCensus"]) == 68
    for row in data["colourCensus"]:
        if row["n"] == 5:
            assert row["clockwork"] == 0, "a five-phase clock should be impossible"
    return data


def verify_pins(groups):
    """Recompute every pinned space-group number with spglib."""
    import numpy as np
    import spglib

    bad = []
    for g in groups:
        b = g["render"]["basis"]
        lattice = np.array([[b[0][0], b[0][1], 0.0],
                            [b[1][0], b[1][1], 0.0],
                            [0.0, 0.0, 1.0]])
        rot, trans = [], []
        for o in g["render"]["ops"]:
            m = o["M"]
            rot.append([[m[0][0], m[0][1], 0], [m[1][0], m[1][1], 0], [0, 0, o["s"]]])
            trans.append([o["v"][0], o["v"][1], o["tau"]])
        t = spglib.get_spacegroup_type_from_symmetry(
            np.array(rot, dtype="intc"), np.array(trans, float),
            lattice=lattice, symprec=1e-5)
        got = None if t is None else t.number
        want = PINNED_IT[int(g["id"][1:])]
        if got != want:
            bad.append((g["id"], want, got))
    if bad:
        for gid, want, got in bad:
            print(f"  MISMATCH {gid}: pinned {want}, spglib {got}")
        raise SystemExit(f"{len(bad)} pinned space-group numbers are wrong")
    print(f"verified {len(groups)} space-group types against spglib {spglib.__version__}")


def print_report(data):
    h = data["headline"]
    print(f"spacetime groups {h['spacetimeGroups']}   clockwork {h['clockwork']}   "
          f"3D types hit {data['fibres']['types']} of the {h['nonCubic']} non-cubic")
    print("\ncolours  Wieting  cyclic  clockwork")
    for row in data["colourCensus"]:
        print(f"  {row['n']:>4}  {row['wieting']:7}  {row['cyclic']:6}  {row['clockwork']:9}")
    print("\nclock image      " + "".join(f"{n:>6}" for n in (1, 2, 3, 4, 6)))
    print("  C_N (forward)  " + "".join(f"{r['cyclic']:>6}" for r in data["phaseImage"]))
    print("  D_N (reversal) " + "".join(f"{r['dihedral']:>6}" for r in data["phaseImage"]))
    print("\ncolouring induced on the projection")
    for k in data["colouringKinds"]:
        print(f"  {k['key']:<13} {k['count']:>4}")
    print(f"  regular cyclic in total: {data['regularCyclicTotal']}")
    p = data["pureReversal"]
    print(f"  pure time reversal: {p['count']} = {p['byClock']['1']} + "
          f"{p['byClock']['2']}, matching the grey and black-white plane groups")
    print("\nfibres of 'forget which axis is time'")
    for row in data["fibres"]["bySystem"]:
        print(f"  {row['system']:<13} {row['types']:>4} types  {row['animations']:>4} animations  "
              f"sizes {row['sizes']}")
    rf = data["rotationFree"]
    print(f"\nover {', '.join(rf['bases'])}: {rf['cyclic']} cyclic colourings "
          f"collapse to {rf['animation']} spacetime groups")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--verify", action="store_true", help="recheck the pins with spglib")
    ap.add_argument("--report", action="store_true", help="print the tables")
    args = ap.parse_args()

    catalog = json.loads(CATALOG.read_text())
    groups = catalog["groups"]
    if args.verify:
        verify_pins(groups)

    data = report(build(groups))
    data["meta"] = dict(
        source="docs/data/catalog.json",
        generator="enumerate/hierarchy.py",
        maxColours=MAX_COLOURS,
        literature=[
            "T. W. Wieting, The Mathematical Theory of Chromatic Plane Ornaments "
            "(Dekker, 1982), Table 11 = OEIS A307293",
            "M. Senechal, Color groups, Discrete Appl. Math. 1 (1979) 51-73",
            "J. D. Jarratt, R. L. E. Schwarzenberger, Coloured plane groups, "
            "Acta Cryst. A36 (1980) 884-888",
        ],
        spaceGroupTypes="pinned spglib results; rerun with --verify",
    )
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    if args.report:
        print_report(data)


if __name__ == "__main__":
    main()
