"""
Prepares the nanoemoji-built Twemoji font to be a fallback behind the app fonts
(Typeface.CustomFallbackBuilder, see TwemojiFonts.kt), matching what @twemoji/parser turns into emoji:

- Text-presentation characters (▶, ✔, ♥, digits...) leave the main cmap, so on their own they stay text.
  With U+FE0F they still reach the emoji through a cmap format 14 non-default variation sequence.
  Skin tone bases (✌, ☝...) stay, so `✌🏻` without U+FE0F still works.
- Emoji-presentation characters get a default (char, U+FE0F) sequence. Minikin only prefers a
  custom fallback for a variation sequence the font declares (FontCollection::calcCoverageScore);
  otherwise ❤️ and the like go to the system emoji font.

    python twemoji-font.py <font.ttf> <emoji-data.txt>
"""

import re
import sys

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable

font_path, emoji_data = sys.argv[1], sys.argv[2]

props: dict[str, set[int]] = {}
for line in open(emoji_data, encoding="utf-8"):
    m = re.match(r"([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*(\w+)", line)
    if m:
        start, end = int(m[1], 16), int(m[2] or m[1], 16)
        props.setdefault(m[3], set()).update(range(start, end + 1))
presentation = props["Emoji_Presentation"]
modifier_base = props["Emoji_Modifier_Base"]
# Parts of sequences, never shown on their own.
components = props["Emoji_Component"] - props["Emoji_Presentation"] - set(range(0x23, 0x3A)) - {0x2A}

font = TTFont(font_path)
cmap = dict(font.getBestCmap())
default, variant = [], []
for cp, glyph in sorted(cmap.items()):
    if cp in components or 0x1F1E6 <= cp <= 0x1F1FF:  # regional indicators
        continue
    if cp in presentation or cp in modifier_base:
        default.append((cp, None))
    else:
        variant.append((cp, glyph))
        del cmap[cp]

for table in font["cmap"].tables:
    table.cmap = {cp: glyph for cp, glyph in table.cmap.items() if cp in cmap}
uvs = CmapSubtable.newSubtable(14)
uvs.platformID, uvs.platEncID, uvs.language = 0, 5, 0xFF
uvs.cmap = {}
uvs.uvsDict = {0xFE0F: default + variant}
font["cmap"].tables.append(uvs)
font.save(font_path)
print(f"twemoji font: {len(default)} default and {len(variant)} text-presentation sequences")
