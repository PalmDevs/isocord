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

curl -fsSL "https://github.com/jdecked/twemoji/archive/refs/tags/v$version.tar.gz" |
  tar -xz -C "$tmp" "twemoji-$version/assets/72x72" "twemoji-$version/assets/svg"
curl -fsSL -o "$tmp/emoji-data.txt" "https://www.unicode.org/Public/$unicode/ucd/emoji/emoji-data.txt"
rm -rf "$target"
mkdir -p "$target" "$tmp/svg"
cp "$tmp/twemoji-$version/assets/72x72"/*.png "$target"
echo "twemoji $version: $(ls "$target" | wc -l) images"

# nanoemoji reads code points from emoji_u<hex>_<hex>.svg names. U+FE0F is left out of the ligatures, as in
# Noto Color Emoji: HarfBuzz consumes it with the cmap 14 sequence, so a ligature that lists it never matches.
for svg in "$tmp/twemoji-$version/assets/svg"/*.svg; do
  name="$(basename "$svg" .svg)"
  name="${name//-fe0f/}"
  cp "$svg" "$tmp/svg/emoji_u${name//-/_}.svg"
done
(
  cd "$tmp"
  uv run -q --python 3.12 --with nanoemoji --with resvg-cli -- \
    nanoemoji --color_format cbdt --bitmap_resolution 72 --family Twemoji --output_file Twemoji.ttf svg/*.svg > nanoemoji.log 2>&1 ||
    { tail -20 nanoemoji.log; exit 1; }
)
uv run -q --python 3.12 --with fonttools -- python "$scripts/twemoji-font.py" "$tmp/build/Twemoji.ttf" "$tmp/emoji-data.txt"
cp "$tmp/build/Twemoji.ttf" "$target/Twemoji.ttf"
