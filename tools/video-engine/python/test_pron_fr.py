import unittest

from pron_fr import load_dictionary, normalize_for_match, number_to_words, ordinal_to_words, speak_word, split_words


class NumberToWords(unittest.TestCase):
    def test_french_number_rules(self):
        cases = {
            0: "zéro", 1: "un", 16: "seize", 17: "dix-sept", 21: "vingt et un", 22: "vingt-deux",
            70: "soixante-dix", 71: "soixante et onze", 72: "soixante-douze", 80: "quatre-vingts",
            81: "quatre-vingt-un", 90: "quatre-vingt-dix", 91: "quatre-vingt-onze", 99: "quatre-vingt-dix-neuf",
            100: "cent", 101: "cent un", 200: "deux cents", 201: "deux cent un", 435: "quatre cent trente-cinq",
            1000: "mille", 2026: "deux mille vingt-six", 55500: "cinquante-cinq mille cinq cents",
            80000: "quatre-vingt mille", 200000: "deux cent mille", 1_000_000: "un million",
            2_500_000: "deux millions cinq cent mille",
        }
        for n, words in cases.items():
            self.assertEqual(number_to_words(n), words, n)

    def test_ordinals(self):
        self.assertEqual(ordinal_to_words(1), "premier")
        self.assertEqual(ordinal_to_words(2), "deuxième")
        self.assertEqual(ordinal_to_words(4), "quatrième")
        self.assertEqual(ordinal_to_words(5), "cinquième")
        self.assertEqual(ordinal_to_words(9), "neuvième")
        self.assertEqual(ordinal_to_words(21), "vingt et unième")


class SpeakWord(unittest.TestCase):
    d = load_dictionary({"Kemi": "kémi"})

    def say(self, w):
        return speak_word(w, self.d)

    def test_dictionary_is_whole_word_and_case_insensitive(self):
        self.assertEqual(self.say("CRS"), "cé erre esse")
        self.assertEqual(self.say("crs,"), "cé erre esse,")
        self.assertEqual(self.say("Kemi"), "kémi")
        self.assertEqual(self.say("CRSX"), "CRSX")

    def test_elision_keeps_the_article(self):
        self.assertEqual(self.say("l'EIMT"), "l'é i èm té")
        self.assertEqual(self.say("jusqu'à"), "jusqu'à")

    def test_numbers_signs_suffixes(self):
        self.assertEqual(self.say("150"), "cent cinquante")
        self.assertEqual(self.say("+150"), "plus cent cinquante")
        self.assertEqual(self.say("−200"), "moins deux cents")
        self.assertEqual(self.say("1,5"), "un virgule cinq")
        self.assertEqual(self.say("2×"), "deux fois")
        self.assertEqual(self.say("10%"), "dix pour cent")
        self.assertEqual(self.say("1er"), "premier")
        self.assertEqual(self.say("3e"), "troisième")
        self.assertEqual(self.say("~17"), "environ dix-sept")
        self.assertEqual(self.say("0-1"), "zéro à un")
        self.assertEqual(self.say("435."), "quatre cent trente-cinq.")

    def test_phone_groups_and_nbsp_thousands(self):
        self.assertEqual(self.say("+237"), "plus deux cent trente-sept")
        self.assertEqual(self.say("015"), "zéro quinze")
        self.assertEqual(self.say("55 500"), "cinquante-cinq mille cinq cents")

    def test_symbols(self):
        self.assertEqual(self.say("≥"), "au moins")
        self.assertEqual(self.say("→"), "")

    def test_split_matches_core_js(self):
        self.assertEqual(split_words("Plus de 55 500  invitations ici"), ["Plus", "de", "55 500", "invitations ici"])


class Align(unittest.TestCase):
    def test_boundaries_map_back_to_display_words(self):
        from tts_edge import align
        parts = ["Le", "score", "cé erre esse", "bondit", "→" and "", "l'é i èm té"]
        bounds = [
            {"t": 0.1, "d": 0.2, "text": "Le"}, {"t": 0.3, "d": 0.3, "text": "score"},
            {"t": 0.6, "d": 0.15, "text": "cé"}, {"t": 0.78, "d": 0.2, "text": "erre"}, {"t": 1.0, "d": 0.13, "text": "esse"},
            {"t": 1.17, "d": 0.3, "text": "bondit"}, {"t": 1.6, "d": 0.4, "text": "l'é i èm té"},
        ]
        t = align(parts, bounds)
        self.assertEqual(t[0][0], 0.1)
        self.assertAlmostEqual(t[2][0], 0.6)
        self.assertAlmostEqual(t[2][1], 1.17)  # stretched to the next word for continuous karaoke
        self.assertGreaterEqual(t[4][0], t[3][0])  # silent token gets a slot between neighbours
        self.assertAlmostEqual(t[5][1], 2.0)
        self.assertEqual(normalize_for_match("Été-2026!"), "ete2026")


if __name__ == "__main__":
    unittest.main()
