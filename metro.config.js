const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withUnistylesConfig } = require('react-native-unistyles/metro')

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname)
const config = withUnistylesConfig({
    serializer: {
        // expo ~58.1 expects ReadableStream from Metro, injected by @expo/cli.
        // See node_modules/expo/build/winter/runtime.native.js and
        // node_modules/@expo/cli/build/src/start/server/metro/withMetroMultiPlatform.js.
        getPolyfills: ctx => [
            ...defaultConfig.serializer.getPolyfills(ctx),
            require.resolve('expo/virtual/streams.js'),
        ],
    },
})

module.exports = mergeConfig(defaultConfig, config)
