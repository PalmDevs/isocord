module.exports = {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
        'babel-plugin-react-compiler',
        ['react-native-unistyles/plugin', { root: 'src' }],
        'react-native-worklets/plugin',
    ],
}
