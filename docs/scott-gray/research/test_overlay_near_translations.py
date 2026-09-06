"""Approximate repeats remain separate from admitted space-time symmetries."""

import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("near_translations", HERE / "build-overlay-near-translations.py")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


def star_movie(n=66, wave=(1, 5), frames=3):
    y, x = np.indices((n, n)) / n
    a, b = wave
    waves = [(a, b), (a + b, -a), (b, -a - b)]
    movie = []
    for t in range(frames):
        pattern = sum(np.cos(2 * np.pi * (u * x + v * y + t / 12 + j / 6))
                      for j, (u, v) in enumerate(waves))
        movie.append([.3 + .03 * pattern, .2 + .02 * pattern])
    return np.asarray(movie)


class NearTranslationTests(unittest.TestCase):
    def test_index31_subgrid_repeat_is_approximate_and_closed(self):
        field = star_movie()
        result = BUILDER.analyze(field)
        self.assertEqual(result["classification"], "approximate-only")
        self.assertEqual(result["approximateTranslationCount"], 31)
        self.assertGreater(result["maximumRelativeError"], 1e-5)
        self.assertLess(result["maximumRelativeError"], .05)
        self.assertLess(max(result["spectralDefect"]["channelForbiddenPowerFraction"]), 1e-25)
        self.assertEqual(json.loads(json.dumps(result))["approximateTranslationCount"], 31)

    def test_localized_defect_is_not_hidden_by_small_rms(self):
        field = star_movie()
        field[-1, 0, 12, 23] += .08
        self.assertIsNone(BUILDER.analyze(field))

    def test_later_frame_or_other_channel_cannot_be_ignored(self):
        field = star_movie()
        y, x = np.indices((66, 66)) / 66
        field[-1, 1] += .035 * np.cos(2 * np.pi * x)
        self.assertIsNone(BUILDER.analyze(field))

    def test_exact_q12_subgroup_is_excluded(self):
        field = star_movie(n=24, wave=(2, 2))
        group = BUILDER.translation_group((2, 2))
        strict = [np.asarray(v) / group["denominator"] for v in group["numerators"]]
        self.assertEqual(len(strict), 12)
        self.assertIsNone(BUILDER.analyze(field, strict))

    def test_common_refinement_maximum_bounds_arbitrary_points(self):
        rng = np.random.default_rng(93)
        field = rng.uniform(.1, .9, (2, 2, 6, 6))
        vector = np.array([.137, .259])
        measured = BUILDER.measure_translation(field, vector, np.array([1., 1.]))
        for offset in rng.uniform(0, 1, (100, 2)):
            error = (BUILDER.sample_offset(field, vector * 6 + offset)
                     - BUILDER.sample_offset(field, offset))
            self.assertTrue(np.all(np.max(abs(error), axis=(0, 2, 3))
                                   <= np.asarray(measured["channelMax"]) + 1e-12))


if __name__ == "__main__":
    unittest.main()
