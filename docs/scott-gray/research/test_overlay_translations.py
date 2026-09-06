"""Regression checks for full-movie, two-concentration overlay periods."""

import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("overlay_translations", HERE / "build-overlay-translations.py")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class TranslationTests(unittest.TestCase):
    def test_rejects_match_visible_only_in_first_frame_or_one_channel(self):
        rng = np.random.default_rng(42)
        tile = rng.uniform(.1, .9, (3, 2, 6, 3)).astype(np.float32)
        field = np.concatenate((tile, tile), axis=-1)
        shifts = lambda f: {tuple(t["gridShift"]) for t in BUILDER.analyze(f)["translations"]}
        self.assertIn((3, 0), shifts(field))
        # An apparently repeating U image does not establish a movie symmetry.
        field[2, 1, 4, 5] += .01
        self.assertNotIn((3, 0), shifts(field))
        self.assertEqual(shifts(field), {(0, 0)})

    def test_pointwise_check_rejects_a_small_rms_local_defect(self):
        field = np.full((10, 2, 12, 12), .3, dtype=np.float32)
        field[0, 1, 0, 0] += 2e-7
        variation = np.ones(2)
        # Its RMS is below the FFT screening tolerance, but maximum error is not.
        self.assertIsNone(BUILDER.verify_translation(field, 0, 1, variation))

    def test_reported_shell3_has_three_exact_spatial_periods(self):
        base = HERE.parent / "p6/data/orbits"
        name = "g248-F0p00404000-k0p02000000-mode1-shell3-N48-M192"
        metadata = json.loads((base / (name + ".json")).read_text())
        n, m = metadata["config"]["N"], metadata["config"]["M"]
        field = np.fromfile(base / metadata["fieldUrl"], dtype="<f4").reshape(m, 2, n, n)
        translations = BUILDER.analyze(field)["translations"]
        self.assertEqual({tuple(t["gridShift"]) for t in translations}, {(0, 0), (32, 16), (16, 32)})
        self.assertTrue(all(t["max"] == 0 and t["rms"] == 0 for t in translations))


if __name__ == "__main__":
    unittest.main()
