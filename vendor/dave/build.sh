#!/usr/bin/env bash
# Cross-compiles BoringSSL, mlspp and libdave as static libraries for Android.
# Usage: vendor/dave/build.sh [abi...]   (default: arm64-v8a armeabi-v7a x86_64)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/src"
OUT="$HERE/out"
NDK="$ANDROID_HOME/ndk/27.1.12297006"
CMAKE_DIR="$ANDROID_HOME/cmake/3.22.1/bin"
API=24
ABIS=("$@")
[ ${#ABIS[@]} -eq 0 ] && ABIS=(arm64-v8a armeabi-v7a x86_64)

# Pinned sources, fetched once into src/.
fetch() { # name url commit
    local dir="$SRC/$1"
    if [ ! -d "$dir/.git" ]; then
        git init -q "$dir"
        git -C "$dir" remote add origin "$2"
    fi
    if [ "$(git -C "$dir" rev-parse -q --verify HEAD)" != "$3" ]; then
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
    "$CMAKE_DIR/cmake" -S "$src" -B "$dir" -G Ninja \
        -DCMAKE_MAKE_PROGRAM="$CMAKE_DIR/ninja" \
        -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
        -DANDROID_ABI="$ABI" -DANDROID_PLATFORM="android-$API" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
        -DCMAKE_INSTALL_PREFIX="$prefix" \
        -DCMAKE_PREFIX_PATH="$prefix" -DCMAKE_FIND_ROOT_PATH="$prefix" \
        -DBUILD_SHARED_LIBS=OFF -DBUILD_TESTING=OFF \
        "$@" >"$dir.configure.log" 2>&1 || { tail -40 "$dir.configure.log"; return 1; }
    # libdave sets CMAKE_SKIP_INSTALL_ALL_DEPENDENCY, so build before installing.
    { "$CMAKE_DIR/cmake" --build "$dir" && "$CMAKE_DIR/cmake" --install "$dir"; } >"$dir.build.log" 2>&1 ||
        { tail -60 "$dir.build.log"; return 1; }
    echo "built $name ($ABI)"
}

for ABI in "${ABIS[@]}"; do
    mkdir -p "$OUT/build/$ABI"
    PREFIX="$OUT/$ABI"
    build json "$SRC/json" "$PREFIX" -DJSON_BuildTests=OFF
    build boringssl "$SRC/boringssl" "$PREFIX"
    build mlspp "$SRC/mlspp" "$PREFIX" \
        -DREQUIRE_BORINGSSL=ON -DDISABLE_GREASE=ON -DMLS_CXX_NAMESPACE=mlspp \
        -DOPENSSL_ROOT_DIR="$PREFIX" -DOPENSSL_USE_STATIC_LIBS=ON
    build libdave "$SRC/libdave/cpp" "$PREFIX" \
        -DREQUIRE_BORINGSSL=ON -DOPENSSL_ROOT_DIR="$PREFIX" -DOPENSSL_USE_STATIC_LIBS=ON
done
