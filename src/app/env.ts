// Expo modules read process.env.EXPO_OS, which babel-preset-expo normally sets

import { Platform } from 'expo'

process.env.EXPO_OS ??= Platform.OS
