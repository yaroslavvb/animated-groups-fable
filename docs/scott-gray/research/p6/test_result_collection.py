"""A failed worker must not discard other completed periodic-orbit candidates."""
import json
from pathlib import Path
import tempfile
import unittest

from result_collection import collect_results


class Completed:
    def __init__(self, name):
        self.name = name

    def get(self):
        return {'report': {'name': self.name, 'converged': True, 'seconds': 1.25},
                'initial': self.name.encode()}


class Failed:
    def get(self):
        raise ValueError('A bounded worker rejected its unknown count.')


class CollectionTest(unittest.TestCase):
    def test_worker_failure_keeps_earlier_and_later_results(self):
        with tempfile.TemporaryDirectory(prefix='p6-collection-') as temporary:
            path = Path(temporary)
            reports = collect_results([('first', Completed('first')),
                                       ('failed', Failed()),
                                       ('last', Completed('last'))], path, emit=lambda _: None)
            self.assertEqual(len(reports), 3)
            self.assertEqual(reports, json.loads((path / 'results.json').read_text()))
            self.assertEqual((path / 'first' / 'initial.f64').read_bytes(), b'first')
            self.assertEqual((path / 'last' / 'initial.f64').read_bytes(), b'last')
            self.assertFalse((path / 'failed' / 'initial.f64').exists())
            self.assertFalse(reports[1]['converged'])
            self.assertTrue(reports[1]['executionFailed'])
            self.assertEqual(reports[1]['failureType'], 'ValueError')
            self.assertIsNone(reports[1]['seconds'])


if __name__ == '__main__':
    unittest.main()
