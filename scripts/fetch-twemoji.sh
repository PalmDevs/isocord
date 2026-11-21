#!/usr/bin/env bash
# Bundles Twemoji as APK assets: the 72x72 PNGs for standalone emoji (the reference ships its Twemoji art
# the same way, as assets/emoji-<codepoints>.png) and a colour font built from the SVGs, the fallback
# behind the app fonts (TwemojiFonts.kt). Keep the version in step with @twemoji/parser in package.json.
# Needs uv (https://docs.astral.sh/uv/) for nanoemoji. Output is gitignored. `bun install` runs this when
# Twemoji.ttf is missing. Rerun it after a version bump.
#   bun run twemoji
set -euo pipefail
version=17.0.3
unicode=17.0.0
scripts="$(cd "$(dirname "$0")" && pwd)"
target="$scripts/../android/app/src/main/assets/twemoji"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "fetching twemoji v$version..."
curl -fsSL "https://github.com/jdecked/twemoji/archive/refs/tags/v$version.tar.gz" |
  tar -xz -C "$tmp" "twemoji-$version/assets/72x72" "twemoji-$version/assets/svg"
echo "fetching unicode $unicode emoji-data..."
curl -fsSL -o "$tmp/emoji-data.txt" "https://www.unicode.org/Public/$unicode/ucd/emoji/emoji-data.txt"
echo "clearing twemoji cache..."
rm -rf "$target"
mkdir -p "$target" "$tmp/svg"
cp "$tmp/twemoji-$version/assets/72x72"/*.png "$target"
echo "twemoji $version: $(ls "$target" | wc -l) images"

# nanoemoji reads code points from emoji_u<hex>_<hex>.svg names. U+FE0F is left out of the ligatures, as in
# Noto Color Emoji: HarfBuzz consumes it with the cmap 14 sequence, so a ligature that lists it never matches.
echo "preparing svgs for font build..."
for svg in "$tmp/twemoji-$version/assets/svg"/*.svg; do
  name="$(basename "$svg" .svg)"
  name="${name//-fe0f/}"
  cp "$svg" "$tmp/svg/emoji_u${name//-/_}.svg"
done
echo "building twemoji font..."
(
  cd "$tmp"
  NINJA_STATUS="[%p] [%f/%t] " \
  uv run -q --python 3.12 --with nanoemoji --with resvg-cli -- \
    nanoemoji --color_format cbdt --bitmap_resolution 72 --family Twemoji --output_file Twemoji.ttf svg/*.svg 2>&1 |
    python3 -u -c '
import re, sys

is_tty = sys.stdout.isatty()
last_pct = -10
prog = re.compile(r"^\[\s*(\d+)%\]\s*\[(\d+/\d+)\]")

with open("nanoemoji.log", "w") as log:
    for line in sys.stdin:
        log.write(line)
        m = prog.match(line)
        if m:
            pct = int(m.group(1))
            current = m.group(2)
            if is_tty:
                sys.stdout.write(f"\r\033[Kbuilding twemoji font: {pct:>3}% ({current})")
                sys.stdout.flush()
            elif pct >= last_pct + 10 or pct == 100:
                last_pct = (pct // 10) * 10
                sys.stdout.write(f"building twemoji font: {pct:>3}% ({current})\n")
                sys.stdout.flush()
        elif "Writing Twemoji.ttf" in line or "Pre-processing glyphs" in line:
            if is_tty:
                sys.stdout.write("\r\033[Kbuilding twemoji font: writing font tables...")
                sys.stdout.flush()
'
) || {
  echo ""
  tail -20 "$tmp/nanoemoji.log"
  exit 1
}
if [ -t 1 ]; then
  printf "\r\033[Kbuilding twemoji font: done\n"
else
  echo "building twemoji font: done"
fi
uv run -q --python 3.12 --with fonttools -- python "$scripts/twemoji-font.py" "$tmp/build/Twemoji.ttf" "$tmp/emoji-data.txt"
cp "$tmp/build/Twemoji.ttf" "$target/Twemoji.ttf"
