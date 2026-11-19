#!/usr/bin/env bash
# Copies individual Discord images out of the xxhdpi resource split.
#   scripts/extract-images.sh <path-to-res.apk>
# Each entry maps an Android resource name to a path under src/.
set -euo pipefail
apk="${1:?usage: scripts/extract-images.sh <path-to-res.apk>}"
src="$(dirname "$0")/../src"

images=(
  "images_native_logo:features/auth/images/logo"
  "modules_auth_native_images_registerbackgrounddark:features/auth/images/background-dark"
  "modules_auth_native_images_registerbackgroundlight:features/auth/images/background-light"
)

for entry in "${images[@]}"; do
  resource="${entry%%:*}"
  target="$src/${entry#*:}@3x.png"
  mkdir -p "$(dirname "$target")"
  unzip -p "$apk" "res/drawable-xxhdpi-v4/$resource.png" > "$target"
done
echo "images: ${#images[@]} files"
