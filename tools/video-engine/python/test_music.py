import unittest

import numpy as np

from music import MOODS, SR, compose, duck_envelope, effects


class Music(unittest.TestCase):
    def test_every_mood_fills_the_exact_duration_deterministically(self):
        for mood in MOODS:
            a = compose(7.3, mood)
            self.assertEqual(len(a), int(7.3 * SR), mood)
            self.assertLessEqual(np.max(np.abs(a)), 1.0 + 1e-9)
            self.assertTrue(np.array_equal(a, compose(7.3, mood)), mood)
            self.assertLess(np.max(np.abs(a[-int(0.05 * SR):])), 0.05, "fades out at the end")

    def test_ducking_lowers_music_only_while_speaking(self):
        g = duck_envelope(6.0, [{"start": 2.0, "end": 3.0}])
        self.assertAlmostEqual(g[int(0.5 * SR)], 1.0)
        self.assertAlmostEqual(g[int(2.5 * SR)], 0.32, places=5)
        self.assertAlmostEqual(g[int(5.0 * SR)], 1.0)

    def test_effects_skip_overlapping_events(self):
        one = effects(2.0, [{"t": 1.0, "a": "pop"}])
        two = effects(2.0, [{"t": 1.0, "a": "pop"}, {"t": 1.03, "a": "pop"}])
        self.assertTrue(np.array_equal(one, two))
        self.assertGreater(np.max(np.abs(one)), 0)


if __name__ == "__main__":
    unittest.main()
