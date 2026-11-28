#!/usr/bin/env bash
# Cross-compiles BoringSSL, mlspp and libdave as static libraries for Android.
# Reads NDK, API and default ABIs from android/build.gradle and android/gradle.properties unless overridden via env/args.
# Usage: vendor/dave/build.sh [abi...]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SRC="$HERE/src"
OUT="$HERE/out"
BUILD_GRADLE="$ROOT/android/build.gradle"
GRADLE_PROPS="$ROOT/android/gradle.properties"

if [ -z "${API:-}" ]; then
    API="$(sed -n 's/.*minSdkVersion = \([0-9][0-9]*\).*/\1/p' "$BUILD_GRADLE" | head -n1)"
fi
if [ -z "${NDK:-}" ]; then
    NDK_VERSION="$(sed -n 's/.*ndkVersion = "\([^"]*\)".*/\1/p' "$BUILD_GRADLE" | head -n1)"
    NDK="${ANDROID_HOME:?ANDROID_HOME is not set}/ndk/$NDK_VERSION"
else
    NDK_VERSION="$(basename "$NDK")"
fi
[ -d "$NDK" ] || { echo "NDK not found: $NDK" >&2; exit 1; }

if [ -z "${CMAKE_DIR:-}" ] && [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME/cmake" ]; then
    CMAKE_DIR="$(ls -1d "$ANDROID_HOME/cmake"/*/bin 2>/dev/null | sort -V | tail -n1 || true)"
fi
CMAKE_BIN="${CMAKE_DIR:+$CMAKE_DIR/}cmake"
NINJA_BIN="${CMAKE_DIR:+$CMAKE_DIR/}ninja"
command -v "$CMAKE_BIN" >/dev/null 2>&1 || { echo "cmake not found: $CMAKE_BIN" >&2; exit 1; }
command -v "$NINJA_BIN" >/dev/null 2>&1 || { echo "ninja not found: $NINJA_BIN" >&2; exit 1; }

ANDROID_STL="${ANDROID_STL:-c++_shared}"
ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES="${ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES:-ON}"

ABIS=()
for arg in "$@"; do
    IFS=',' read -ra parts <<<"$arg"
    for part in "${parts[@]}"; do
        [ -n "$part" ] && ABIS+=("$part")
    done
done
if [ ${#ABIS[@]} -eq 0 ]; then
    ARCH_PROP="$(sed -n 's/^reactNativeArchitectures=//p' "$GRADLE_PROPS" | head -n1)"
    IFS=',' read -ra ABIS <<<"${ARCH_PROP:-arm64-v8a,armeabi-v7a,x86_64}"
fi

STAMP="${NDK_VERSION}|${API}|${ANDROID_STL}|${ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES}|$(sha256sum "$0" | cut -d' ' -f1)"
PENDING_ABIS=()
for ABI in "${ABIS[@]}"; do
    if [ -f "$OUT/$ABI/.build-stamp" ] && [ "$(cat "$OUT/$ABI/.build-stamp")" = "$STAMP" ] && [ -f "$OUT/$ABI/lib/libdave.a" ]; then
        continue
    fi
    PENDING_ABIS+=("$ABI")
done
[ ${#PENDING_ABIS[@]} -eq 0 ] && exit 0

# Pinned sources, fetched once into src/.
fetch() { # name url commit
    local dir="$SRC/$1"
    if [ ! -d "$dir/.git" ]; then
        git init -q "$dir"
        git -C "$dir" remote add origin "$2"
    fi
    if [ "$(git -C "$dir" rev-parse -q --verify HEAD 2>/dev/null || true)" != "$3" ]; then
        git -C "$dir" fetch -q --depth 1 origin "$3"
        git -C "$dir" checkout -q --force FETCH_HEAD
    fi
}
fetch libdave https://github.com/discord/libdave.git b5463c443df74db75a713c775b09a847621e6d62 # v1.3.0/cpp
fetch mlspp https://github.com/cisco/mlspp.git 1cc50a124a3bc4e143a787ec934280dc70c1034d
fetch boringssl https://boringssl.googlesource.com/boringssl 5ec099107553142e9cb34dfe52f3c5bb42c9b7fb
fetch json https://github.com/nlohmann/json.git 322063822f66533bb81ef8e938fd07e5f6394917

# libdave's vcpkg port drops these mlspp targets; they fail under -Werror.
sed -i '/add_subdirectory(mls_ds)/d;/add_subdirectory(mls_vectors)/d' "$SRC/mlspp/lib/CMakeLists.txt"

build() { # name source-dir prefix extra-args...
    local name=$1 src=$2 prefix=$3
    shift 3
    local dir="$OUT/build/$ABI/$name"
    "$CMAKE_BIN" -S "$src" -B "$dir" -G Ninja \
        -DCMAKE_MAKE_PROGRAM="$NINJA_BIN" \
        -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
        -DANDROID_ABI="$ABI" -DANDROID_PLATFORM="android-$API" \
        -DANDROID_STL="$ANDROID_STL" \
        -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES="$ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
        -DCMAKE_INSTALL_PREFIX="$prefix" \
        -DCMAKE_PREFIX_PATH="$prefix" -DCMAKE_FIND_ROOT_PATH="$prefix" \
        -DBUILD_SHARED_LIBS=OFF -DBUILD_TESTING=OFF \
        "$@" >"$dir.configure.log" 2>&1 || { tail -40 "$dir.configure.log"; return 1; }
    # libdave sets CMAKE_SKIP_INSTALL_ALL_DEPENDENCY, so build before installing.
    { "$CMAKE_BIN" --build "$dir" && "$CMAKE_BIN" --install "$dir"; } >"$dir.build.log" 2>&1 ||
        { tail -60 "$dir.build.log"; return 1; }
    echo "built $name ($ABI)"
}

for ABI in "${PENDING_ABIS[@]}"; do
    rm -rf "$OUT/build/$ABI" "$OUT/$ABI"
    mkdir -p "$OUT/build/$ABI"
    PREFIX="$OUT/$ABI"
    build json "$SRC/json" "$PREFIX" -DJSON_BuildTests=OFF
    build boringssl "$SRC/boringssl" "$PREFIX"
    build mlspp "$SRC/mlspp" "$PREFIX" \
        -DREQUIRE_BORINGSSL=ON -DDISABLE_GREASE=ON -DMLS_CXX_NAMESPACE=mlspp \
        -DOPENSSL_ROOT_DIR="$PREFIX" -DOPENSSL_USE_STATIC_LIBS=ON
    build libdave "$SRC/libdave/cpp" "$PREFIX" \
        -DREQUIRE_BORINGSSL=ON -DOPENSSL_ROOT_DIR="$PREFIX" -DOPENSSL_USE_STATIC_LIBS=ON
    printf '%s\n' "$STAMP" >"$OUT/$ABI/.build-stamp"
done
