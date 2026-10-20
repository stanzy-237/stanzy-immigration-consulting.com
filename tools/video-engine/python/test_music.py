import unittest

import numpy as np

from music import MOODS, SFX_GAIN, SFX_NAMES, SR, compose, dip_envelope, duck_envelope, effects, sfx


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

    def test_dip_scales_music_inside_the_range_only(self):
        g = dip_envelope(6.0, [{"from": 2.0, "to": 4.0, "gain": 0.5}])
        self.assertAlmostEqual(g[int(1.0 * SR)], 1.0)
        self.assertAlmostEqual(g[int(3.0 * SR)], 0.5, places=5)
        self.assertAlmostEqual(g[int(5.0 * SR)], 1.0)

    def test_every_named_effect_is_audible_and_has_a_gain(self):
        for name in SFX_NAMES:
            sig = sfx(name, np.random.default_rng(1))
            self.assertGreater(len(sig), SR // 50, name)
            self.assertGreater(np.max(np.abs(sig)), 0.05, name)
            self.assertIn(name, SFX_GAIN, name)


if __name__ == "__main__":
    unittest.main()
