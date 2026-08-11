#!/usr/bin/env python3
"""Regression tests for the generated colour/forward-film census."""

from __future__ import annotations

import re
import unittest

try:
    from . import color_forward_census as census
except ImportError:  # Direct execution: python enumerate/test_*.py
    import color_forward_census as census


class ColorForwardCensusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.payload = census.build_payload()

    def test_three_summary_rows(self) -> None:
        rows = self.payload["summary"]
        self.assertEqual(
            [row["wieting_all_transitive"] for row in rows],
            [17, 46, 23, 96, 14, 90],
        )
        self.assertEqual(
            [row["regular_cyclic_kernels"] for row in rows],
            [17, 46, 8, 13, 4, 13],
        )
        self.assertEqual(
            [row["forward_catalog_canonical_clock_order"] for row in rows],
            [17, 36, 6, 6, 0, 3],
        )

    def test_every_forward_group_occurs_once(self) -> None:
        items = [
            item
            for group_items in self.payload["forward_groups_by_order"].values()
            for item in group_items
        ]
        ids = [item["id"] for item in items]
        self.assertEqual(len(ids), 68)
        self.assertEqual(len(set(ids)), 68)

    def test_wallpaper_rows_reconcile(self) -> None:
        rows = self.payload["by_wallpaper"]
        self.assertEqual([row["wallpaper_group"] for row in rows],
                         list(census.BASE_ORDER))
        self.assertEqual([row["orbifold"] for row in rows],
                         [census.ORBIFOLD_BY_BASE[base]
                          for base in census.BASE_ORDER])
        self.assertEqual(len({row["orbifold"] for row in rows}), 17)
        self.assertEqual(sum(row["forward_total"] for row in rows), 68)

    def test_downloads_keep_both_group_notations(self) -> None:
        csv_header = census.wallpaper_csv_text(self.payload).splitlines()[0]
        self.assertEqual(csv_header.split(",")[:2],
                         ["orbifold", "wallpaper_group"])
        self.assertEqual(
            self.payload["meta"]["label_conventions"]["primary"],
            "Conway orbifold notation",
        )

    def test_noscript_fallback_matches_payload(self) -> None:
        report = (census.ROOT / "docs" / "future-directions.html").read_text()
        match = re.search(r"<noscript>(.*?)</noscript>", report, re.DOTALL)
        self.assertIsNotNone(match)
        vectors = re.findall(r"(?:\d+,){5}\d+", match.group(1))
        rows = self.payload["summary"]
        expected = [
            ",".join(str(row[field]) for row in rows)
            for field in (
                "wieting_all_transitive",
                "regular_cyclic_kernels",
                "forward_catalog_canonical_clock_order",
            )
        ]
        self.assertEqual(vectors, expected)


if __name__ == "__main__":
    unittest.main()
