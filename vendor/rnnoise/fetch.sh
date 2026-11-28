#!/usr/bin/env bash
# Fetches RNNoise and its model at pinned versions into src/.
# android/app/src/main/cpp/audio/CMakeLists.txt compiles them into libisocord_audio.so.
# Usage: vendor/rnnoise/fetch.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/src"
COMMIT=70f1d256acd4b34a572f999a05c87bf00b67730d
# The commit's model_version: the model archive's SHA-256.
MODEL=0a8755f8e2d834eff6a54714ecc7d75f9932e845df35f8b59bc52a7cfe6e8b37
ARCHIVE="$SRC/rnnoise_data-$MODEL.tar.gz"

if [ ! -d "$SRC/.git" ]; then
    git init -q "$SRC"
    git -C "$SRC" remote add origin https://github.com/xiph/rnnoise.git
fi
if [ "$(git -C "$SRC" rev-parse -q --verify HEAD)" != "$COMMIT" ]; then
    git -C "$SRC" fetch -q --depth 1 origin "$COMMIT"
    git -C "$SRC" checkout -q --force FETCH_HEAD
fi

if [ ! -f "$ARCHIVE" ]; then
    curl -sSfL -o "$ARCHIVE.part" "https://media.xiph.org/rnnoise/models/rnnoise_data-$MODEL.tar.gz"
    mv "$ARCHIVE.part" "$ARCHIVE"
fi
echo "$MODEL  $ARCHIVE" | sha256sum -c --quiet -
tar -xzmf "$ARCHIVE" -C "$SRC"
echo "fetched rnnoise $COMMIT, model $MODEL"
