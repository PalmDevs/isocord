#!/usr/bin/env bash
# Copies Discord's UI fonts out of a Discord base.apk into the Android assets.
#   scripts/extract-fonts.sh <path-to-base.apk>
set -euo pipefail
apk="${1:?usage: scripts/extract-fonts.sh <path-to-base.apk>}"
out="$(dirname "$0")/../android/app/src/main/assets/fonts"
mkdir -p "$out"
unzip -joq "$apk" \
  'assets/fonts/ggsans-*' 'assets/fonts/ggmono-*' 'assets/fonts/NotoSans-*' \
  'assets/fonts/SourceCodePro-*' 'assets/fonts/ABCGinto*' -d "$out"
echo "fonts: $(ls "$out" | wc -l) files -> $out"
