"""French pronunciation: display word -> spoken text, one word at a time.

Each displayed word maps to exactly one spoken string (possibly several words or
empty), so TTS word timings can be mapped back onto the subtitle words.
"""
import json
import re
import unicodedata
from pathlib import Path

GLOBAL_DICT = Path(__file__).resolve().parent.parent / "engine" / "pron" / "fr.json"

UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
         "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
         "dix-sept", "dix-huit", "dix-neuf"]
TENS = {2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante"}
ORDINAL_SPECIAL = {1: "premier", 5: "cinquième", 9: "neuvième"}

NBSP = "  "
LEAD_PUNCT = "«\"“(['¿¡\u00a0\u202f"
TRAIL_PUNCT = ".,;:!?»\"”)]…\u00a0\u202f"
ELISION = re.compile(r"^((?:l|d|j|n|s|c|m|t|qu|jusqu|lorsqu|puisqu)['’])(.+)$", re.IGNORECASE)
NUMBER = re.compile(
    r"^(?P<approx>[~≈])?(?P<sign>[+\-−])?(?P<int>\d[\d" + NBSP + r"]*)(?:,(?P<dec>\d+))?"
    r"(?P<suf>er|re|e|ème|×|x|%|h|€|\$)?$"
)
RANGE = re.compile(r"^(\d+)[-–](\d+)$")


def split_words(text):
    """Regular whitespace only, mirroring engine/core.js splitWords."""
    return [w for w in re.split(r"[ \t\r\n]+", text) if w]


def _below_100(n):
    if n < 20:
        return UNITS[n]
    tens, unit = divmod(n, 10)
    if tens in (7, 9):
        base = "soixante" if tens == 7 else "quatre-vingt"
        rest = 10 + unit
        if tens == 7 and unit == 1:
            return "soixante et onze"
        return f"{base}-{UNITS[rest]}"
    if tens == 8:
        return "quatre-vingts" if unit == 0 else f"quatre-vingt-{UNITS[unit]}"
    word = TENS[tens]
    if unit == 0:
        return word
    if unit == 1:
        return f"{word} et un"
    return f"{word}-{UNITS[unit]}"


def _below_1000(n, final=True):
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds:
        if hundreds == 1:
            parts.append("cent")
        else:
            parts.append(f"{UNITS[hundreds]} cent" + ("s" if rest == 0 and final else ""))
    if rest or not hundreds:
        word = _below_100(rest)
        if not final and word == "quatre-vingts":
            word = "quatre-vingt"
        parts.append(word)
    return " ".join(parts)


def number_to_words(n):
    if n < 0:
        return "moins " + number_to_words(-n)
    if n < 1000:
        return _below_1000(n)
    out = []
    for value, name in ((10**9, "milliard"), (10**6, "million")):
        if n >= value:
            q, n = divmod(n, value)
            out.append(f"{number_to_words(q)} {name}" + ("s" if q > 1 else ""))
    if n >= 1000:
        q, n = divmod(n, 1000)
        out.append("mille" if q == 1 else f"{_below_1000(q, final=False)} mille")
    if n:
        out.append(_below_1000(n))
    return " ".join(out)


def ordinal_to_words(n):
    if n in ORDINAL_SPECIAL:
        return ORDINAL_SPECIAL[n]
    w = number_to_words(n)
    if w.endswith("e"):
        w = w[:-1]
    if w.endswith("cinq"):
        w += "u"
    if w.endswith("neuf"):
        w = w[:-1] + "v"
    return w + "ième"


def _digits_to_words(digits):
    """'015' -> 'zéro quinze' (leading zeros are read, as in phone numbers)."""
    stripped = digits.lstrip("0")
    zeros = len(digits) - len(stripped)
    if not stripped:
        return " ".join(["zéro"] * max(1, zeros))
    return " ".join(["zéro"] * zeros + [number_to_words(int(stripped))])


def _speak_number(m):
    raw = m.group("int")
    digits = re.sub("[" + NBSP + "]", "", raw)
    suf = m.group("suf") or ""
    if suf in ("er", "re", "e", "ème"):
        n = int(digits)
        return "première" if (n == 1 and suf == "re") else ordinal_to_words(n)
    out = []
    if m.group("approx"):
        out.append("environ")
    if m.group("sign"):
        out.append("plus" if m.group("sign") == "+" else "moins")
    out.append(_digits_to_words(digits))
    if m.group("dec"):
        out.append("virgule " + _digits_to_words(m.group("dec")))
    out.append({"×": "fois", "x": "fois", "%": "pour cent", "h": "heures", "€": "euros", "$": "dollars"}.get(suf, ""))
    return " ".join(p for p in out if p)


def load_dictionary(overrides=None):
    merged = {}
    for source in (json.loads(GLOBAL_DICT.read_text(encoding="utf-8")), overrides or {}):
        for k, v in source.items():
            merged[k.lower()] = v
    return merged


def speak_word(word, dictionary):
    """Spoken form of one displayed word (punctuation kept for prosody)."""
    lead = ""
    while word and word[0] in LEAD_PUNCT:
        lead, word = lead + word[0], word[1:]
    trail = ""
    while word and word[-1] in TRAIL_PUNCT:
        word, trail = word[:-1], word[-1] + trail
    core = _speak_core(word, dictionary) if word else ""
    return (lead + core + trail).strip()


# Words written in capitals for emphasis ("français ET anglais"): read as normal words.
EMPHASIS = {"ET", "OU", "AU", "PAS", "NON", "OUI", "TOUT", "TOUS", "JAMAIS", "AVANT", "APRÈS", "VRAIE", "VRAI", "FAUX"}


def _speak_core(word, dictionary):
    if word in EMPHASIS:
        return word.lower()
    hit = dictionary.get(word.lower())
    if hit is not None:
        return hit
    m = ELISION.match(word)
    if m:
        rest = _speak_core(m.group(2), dictionary)
        return m.group(1) + rest if rest != m.group(2) else word
    m = NUMBER.match(word)
    if m:
        return _speak_number(m)
    m = RANGE.match(word)
    if m:
        return f"{_digits_to_words(m.group(1))} à {_digits_to_words(m.group(2))}"
    return word


def clean_spoken(text):
    """Text actually sent to the voice: no special spaces (they make it read the symbol),
    no ellipsis, colons and semicolons become a comma pause, punctuation glued to its word."""
    t = re.sub("[" + NBSP + "]+(?=[!?:;%.,»])", "", text)
    t = re.sub("[" + NBSP + "]", " ", t)
    t = re.sub(r"…(?=\s*\w)", ",", t)  # mid-sentence ellipsis = hesitation pause
    t = t.replace("…", "").replace("«", "").replace("»", "")
    t = re.sub(r"\s*[:;]\s*", ", ", t)
    t = re.sub(r"\s+([!?.,])", r"\1", t)
    t = re.sub(r"([!?.,]){2,}", r"\1", t)
    t = re.sub(r"^[\s,]+", "", t)
    return re.sub(r"\s{2,}", " ", t).strip()


def normalize_for_match(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(ch for ch in s if ch.isalnum() and not unicodedata.combining(ch))
