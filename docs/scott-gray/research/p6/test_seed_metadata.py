"""Regression for seed indices surviving rotation-kernel construction.

These two equivalent physical periodic cells also exercise the optional exact
translation reduction. They use actual native shooting, not a mocked solver.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import numpy as np


class SeedMetadataTest(unittest.TestCase):
    def test_repeated_cell_keeps_requested_wave_and_physical_orbit(self):
        records = []
        with tempfile.TemporaryDirectory(prefix='p6-seed-regression-') as temporary:
            for mode in [1, 2]:
                folder = Path(temporary) / str(mode)
                command = [sys.executable, str(Path(__file__).with_name('search.py')),
                           '--charge', '1', '--grid', str(12 * mode),
                           '--length', str(256 * mode), '--wavevector', str(mode), '0',
                           '--seed-translations', '--amplitude', '.018', '--frames', '12',
                           '--maxfev', '2000', '--output', str(folder)]
                subprocess.run(command, check=True, capture_output=True, timeout=45)
                record = json.loads((folder / 'candidate.json').read_text())
                self.assertEqual(record['spatialWavevector'], [mode, 0])
                self.assertEqual(record['spatialShell'], mode * mode)
                self.assertEqual(record['searchSettings']['translationRepeats'], mode)
                self.assertLess(record['shootingRms'], 1e-9)
                self.assertGreater(record['spatialRms'], .012)
                self.assertLess(max(x['spaceTimeRms'] for x in record['generatorMetrics']), 1e-8)
                field = np.fromfile(folder / 'candidate.f64', dtype='<f8').reshape(12, 2, 12 * mode, 12 * mode)
                records.append((record, field))
            self.assertAlmostEqual(records[0][0]['config']['params']['F'], records[1][0]['config']['params']['F'], places=11)
            self.assertAlmostEqual(records[0][0]['period'], records[1][0]['period'], places=6)
            tiled = np.tile(records[0][1], (1, 1, 2, 2))
            self.assertLess(float(np.max(abs(tiled - records[1][1]))), 1e-8)


if __name__ == '__main__':
    unittest.main()
