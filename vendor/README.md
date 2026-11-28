# React Navigation Native Stack preview

`react-navigation-native-stack-55c1d647.tgz` contains `@react-navigation/native-stack` from [upstream commit `55c1d647`](https://github.com/react-navigation/react-navigation/tree/55c1d647e5d1e2e67025cc0118be3393e946d454) ([PR #13115](https://github.com/react-navigation/react-navigation/pull/13115)).
The `/next` entry point uses the Screens v5 stack with Android predictive back.

The archive contains upstream source, the MIT license, and the JavaScript and TypeScript declarations built with React Native Builder Bob 0.44.1.
Workspace dependency ranges were resolved to the corresponding upstream package versions. Replace the archive with the npm package when it ships the `/next` entry point.

# libdave

`dave/build.sh` fetches [libdave](https://github.com/discord/libdave) and its dependencies (mlspp, BoringSSL,
nlohmann/json) at pinned commits into `dave/src/` and cross-compiles them as static libraries into
`dave/out/<abi>/` with the NDK. `android/app/src/main/cpp/dave/CMakeLists.txt` links them into
`libisocord_dave.so`. Both folders are ignored by git. Needs `ANDROID_HOME`.

# RNNoise

`rnnoise/fetch.sh` fetches [RNNoise](https://github.com/xiph/rnnoise) (BSD-3) at a pinned commit into
`rnnoise/src/`, with its model archive from media.xiph.org checked by SHA-256. `android/app/src/main/cpp/audio/CMakeLists.txt`
compiles it into `libisocord_audio.so` for every ABI. The folder is ignored by git. Run it once before building.
