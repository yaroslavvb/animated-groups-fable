#!/usr/bin/env python3
"""Build the colour-to-forward-film census published on GitHub Pages.

The report deliberately keeps three equivalence problems separate:

* Wieting's count of every transitive perfect N-colouring of a plane group;
* the regular-cyclic subset, whose colour stabilizer H is normal and whose
  quotient is C_N;
* the canonical representatives of the 68 forward entries in this project's
  275-group catalog, binned by the exact order of their displayed clock data.

The first row is published reference data (Wieting, Table 11 / OEIS A307293).
The second was independently recomputed with a pinned Senechal--Wieting engine
and an affine-normalizer orbit search whose 17 x 6 result is checked for
stability across matrix-entry bounds 1 through 6.  Its per-wallpaper audit is
kept here so changes cannot silently alter the totals.
The third row is recomputed directly from docs/data/catalog.json.

Run from any directory:

    python3 enumerate/color_forward_census.py
    python3 enumerate/color_forward_census.py --check
"""

from __future__ import annotations

import argparse
import csv
from fractions import Fraction
import hashlib
import io
import json
import math
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "docs" / "data" / "catalog.json"
OUT_JSON = ROOT / "docs" / "data" / "color-forward-census.json"
OUT_CSV = ROOT / "docs" / "data" / "color-forward-census.csv"
OUT_BASE_CSV = ROOT / "docs" / "data" / "color-forward-by-wallpaper.csv"

MAX_COLOURS = 6
BASE_ORDER = (
    "p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm",
    "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m",
)

# Wieting's aggregate number a(N) of colour plane groups of index N.
WIETING_ALL = {1: 17, 2: 46, 3: 23, 4: 96, 5: 14, 6: 90}

# Regular-cyclic colour groups: affine-normalizer orbits of normal index-N
# subgroups H with wallpaper_group/H isomorphic to C_N.  Recompute this audit
# with verify_cyclic_colors.mjs and a checkout of wieting-subgroups.
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
CYCLIC_TOTALS = {n: sum(CYCLIC_BY_BASE[b][n - 1] for b in BASE_ORDER)
                 for n in range(1, MAX_COLOURS + 1)}
EXPECTED_CYCLIC_TOTALS = {1: 17, 2: 46, 3: 8, 4: 13, 5: 4, 6: 13}
EXPECTED_FILM_TOTALS = {1: 17, 2: 36, 3: 6, 4: 6, 5: 0, 6: 3}

def exact_tau(value: Any) -> Fraction:
    """Recover a catalog tau as the exact small rational used by export.py."""
    raw = float(value) % 1.0
    candidate = Fraction(raw).limit_denominator(12)
    if abs(float(candidate) - raw) > 1e-8:
        raise ValueError(f"time offset is not a small catalog rational: {value!r}")
    return candidate


def canonical_clock_order(group: dict[str, Any]) -> int:
    """LCM of temporal denominators in one canonical forward catalog entry."""
    order = 1
    for op in group["render"]["ops"]:
        if op["s"] != 1:
            raise ValueError(f"forward group {group['id']} contains time reversal")
        order = math.lcm(order, exact_tau(op["tau"]).denominator)
    return order


def build_payload() -> dict[str, Any]:
    raw_catalog = CATALOG.read_bytes()
    catalog = json.loads(raw_catalog)
    groups = catalog["groups"]
    forward = [group for group in groups if group["forward"]]

    if CYCLIC_TOTALS != EXPECTED_CYCLIC_TOTALS:
        raise AssertionError((CYCLIC_TOTALS, EXPECTED_CYCLIC_TOTALS))
    if WIETING_ALL[2] != CYCLIC_TOTALS[2]:
        raise AssertionError("every index-two subgroup must be regular cyclic")

    film_by_base = {
        base: {n: [] for n in range(1, MAX_COLOURS + 1)}
        for base in BASE_ORDER
    }
    for group in forward:
        base = group["base"]
        if base not in film_by_base:
            raise ValueError(f"unknown wallpaper base {base!r} in {group['id']}")
        order = canonical_clock_order(group)
        if order > MAX_COLOURS:
            raise ValueError(f"clock order {order} exceeds report range in {group['id']}")
        film_by_base[base][order].append({
            "id": group["id"],
            "symbol": group["symbol"],
        })

    film_totals = {
        n: sum(len(film_by_base[base][n]) for base in BASE_ORDER)
        for n in range(1, MAX_COLOURS + 1)
    }
    if film_totals != EXPECTED_FILM_TOTALS:
        raise AssertionError((film_totals, EXPECTED_FILM_TOTALS))
    if sum(film_totals.values()) != len(forward) or len(forward) != 68:
        raise AssertionError("forward-group census must contain exactly 68 entries")

    rows = []
    for n in range(1, MAX_COLOURS + 1):
        rows.append({
            "colours": n,
            "wieting_all_transitive": WIETING_ALL[n],
            "regular_cyclic_kernels": CYCLIC_TOTALS[n],
            "forward_catalog_canonical_clock_order": film_totals[n],
        })

    wallpaper_rows = []
    for base in BASE_ORDER:
        cyclic = {str(n): CYCLIC_BY_BASE[base][n - 1]
                  for n in range(1, MAX_COLOURS + 1)}
        films = {str(n): len(film_by_base[base][n])
                 for n in range(1, MAX_COLOURS + 1)}
        wallpaper_rows.append({
            "wallpaper_group": base,
            "regular_cyclic": cyclic,
            "forward_catalog": films,
            "forward_total": sum(films.values()),
        })

    return {
        "meta": {
            "schema_version": 1,
            "range": {"minimum_colours": 1, "maximum_colours": MAX_COLOURS},
            "catalog_source": "catalog.json",
            "catalog_sha256": hashlib.sha256(raw_catalog).hexdigest(),
            "catalog_total_groups": catalog["meta"]["total"],
            "catalog_forward_groups": len(forward),
            "definitions": {
                "wieting_all_transitive":
                    "Plane-affine classes of all index-N colour stabilizers.",
                "regular_cyclic_kernels":
                    "Plane-affine classes of normal index-N kernels with quotient C_N.",
                "forward_catalog_canonical_clock_order":
                    "Canonical 275-catalog forward representatives whose displayed temporal offsets generate a cyclic group of exact order N.",
            },
            "warning":
                "The three columns use different equivalence relations. The forward column is a canonical-representative statistic, not the number of all N-colourings of forward film groups.",
            "sources": [
                {
                    "label": "Wieting Table 11 totals (OEIS A307293)",
                    "url": "https://oeis.org/A307293",
                },
                {
                    "label": "Pinned Senechal-Wieting subgroup reconstruction",
                    "url": "https://github.com/yaroslavvb/wieting-subgroups/tree/dc192b34f206e6fd8e0533c6a25ab89a6055b9ff",
                },
                {
                    "label": "Jarratt-Schwarzenberger coloured plane groups",
                    "url": "https://doi.org/10.1107/S0567739480001866",
                },
            ],
        },
        "summary": rows,
        "by_wallpaper": wallpaper_rows,
        "forward_groups_by_order": {
            str(n): [item for base in BASE_ORDER for item in film_by_base[base][n]]
            for n in range(1, MAX_COLOURS + 1)
        },
    }


def json_text(payload: dict[str, Any]) -> str:
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"


def summary_csv_text(payload: dict[str, Any]) -> str:
    buf = io.StringIO(newline="")
    fields = (
        "colours", "wieting_all_transitive", "regular_cyclic_kernels",
        "forward_catalog_canonical_clock_order",
    )
    writer = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(payload["summary"])
    return buf.getvalue()


def wallpaper_csv_text(payload: dict[str, Any]) -> str:
    buf = io.StringIO(newline="")
    fields = ["wallpaper_group"]
    fields += [f"cyclic_n{n}" for n in range(1, MAX_COLOURS + 1)]
    fields += [f"film_n{n}" for n in range(1, MAX_COLOURS + 1)]
    fields += ["forward_total"]
    writer = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    for row in payload["by_wallpaper"]:
        out = {"wallpaper_group": row["wallpaper_group"],
               "forward_total": row["forward_total"]}
        for n in range(1, MAX_COLOURS + 1):
            out[f"cyclic_n{n}"] = row["regular_cyclic"][str(n)]
            out[f"film_n{n}"] = row["forward_catalog"][str(n)]
        writer.writerow(out)
    return buf.getvalue()


def outputs() -> dict[Path, str]:
    payload = build_payload()
    return {
        OUT_JSON: json_text(payload),
        OUT_CSV: summary_csv_text(payload),
        OUT_BASE_CSV: wallpaper_csv_text(payload),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="fail if tracked outputs differ from a fresh census")
    args = parser.parse_args(argv)

    generated = outputs()
    if args.check:
        stale = [path for path, text in generated.items()
                 if not path.exists() or path.read_text() != text]
        if stale:
            for path in stale:
                print(f"stale: {path.relative_to(ROOT)}", file=sys.stderr)
            return 1
        print("colour/forward-film census: tracked outputs are current")
        return 0

    for path, text in generated.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
