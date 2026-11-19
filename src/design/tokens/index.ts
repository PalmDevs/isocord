import { Appearance } from 'react-native'
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles'
import { createStore } from 'zustand/vanilla'
import { deviceStorage } from '../../core/storage'
import { modules } from './generated/modules'
import { radii } from './generated/radii'
import { rawColors } from './generated/rawColors'
import { semanticColors } from './generated/semanticColors'
import { shadows } from './generated/shadows'
import { space } from './generated/space'
import { textVariants } from './generated/typography'
import type { SemanticColor, ThemeId } from './generated/semanticColors'
import type { TextVariant } from './generated/typography'

export type { SemanticColor, TextVariant, ThemeId }

const THEME_KEY = 'theme'
const SAME_AS_DEVICE_KEY = 'theme.sameAsDevice'
const MODE_KEYS = { light: 'theme.light', dark: 'theme.dark' } as const

export type SystemTheme = keyof typeof MODE_KEYS

/**
 * ThemeStore's device state. `synced` is the account's theme as last applied; with Same as Device Theme on,
 * the device's light or dark mode picks `light` or `dark` instead (UnsyncedUserSettingsStore.useSystemTheme
 * and the per-mode preferences, THEME_PREFERENCES_MOBILE by default).
 */
export interface ThemeState {
    synced: ThemeId
    sameAsDevice: boolean
    light: ThemeId
    dark: ThemeId
}

const readTheme = (key: string) =>
    deviceStorage.getString(key) as ThemeId | undefined

export const themeStore = createStore<ThemeState>(() => ({
    synced: readTheme(THEME_KEY) ?? 'dark',
    sameAsDevice: deviceStorage.getBoolean(SAME_AS_DEVICE_KEY) ?? false,
    light: readTheme(MODE_KEYS.light) ?? 'light',
    dark: readTheme(MODE_KEYS.dark) ?? 'darker',
}))

// resolveTheme: the device's mode picks the theme when Same as Device Theme is on.
function resolveTheme(state: ThemeState): ThemeId {
    if (!state.sameAsDevice) return state.synced
    return Appearance.getColorScheme() === 'light' ? state.light : state.dark
}

/**
 * Replaces MENTION_* with the native chat's mention colours (chat_mentions_{background,foreground}_{dark,light}
 * in the official APK's resources), more saturated than the generated tokens.
 */
function mentionColors(isDark: boolean) {
    return {
        MENTION_BACKGROUND: isDark
            ? `${rawColors.BRAND_500}4D`
            : rawColors.BRAND_160,
        MENTION_FOREGROUND: isDark ? rawColors.BRAND_260 : rawColors.BRAND_530,
    }
}

function makeTheme(id: ThemeId) {
    const isDark = id !== 'light'
    return {
        id,
        isDark,
        colors: { ...semanticColors[id], ...mentionColors(isDark) },
        shadows: shadows[id]!,
        text: textVariants,
        // Component tokens at the default chat density, with mobile-visual-refresh applied.
        modules: modules.default,
        radii,
        space,
    }
}

/** Discord's four base themes. `dark` is Ash, `darker` is the legacy Dark, `midnight` is Onyx. */
export const themes = {
    dark: makeTheme('dark'),
    darker: makeTheme('darker'),
    midnight: makeTheme('midnight'),
    light: makeTheme('light'),
}

type AppThemes = typeof themes
declare module 'react-native-unistyles' {
    export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
    themes,
    settings: {
        initialTheme: () => resolveTheme(themeStore.getState()),
    },
})

const applyTheme = () =>
    UnistylesRuntime.setTheme(resolveTheme(themeStore.getState()))

themeStore.subscribe(state => {
    deviceStorage.set(THEME_KEY, state.synced)
    deviceStorage.set(SAME_AS_DEVICE_KEY, state.sameAsDevice)
    deviceStorage.set(MODE_KEYS.light, state.light)
    deviceStorage.set(MODE_KEYS.dark, state.dark)
    applyTheme()
})
// ThemeActionCreators.setSystemThemeIfNeeded on the device's mode changing.
Appearance.addChangeListener(applyTheme)

/** The account's theme, from its settings. */
export const setSyncedTheme = (synced: ThemeId) =>
    themeStore.setState({ synced })

/** SameAsDeviceThemeSetting: enableSameAsDeviceTheme / disableSameAsDeviceTheme. */
export const setSameAsDeviceTheme = (sameAsDevice: boolean) =>
    themeStore.setState({ sameAsDevice })

/** handleSaveSyncedModeTheme: the theme one device mode uses. Kept on the device only. */
export const setModeTheme = (mode: SystemTheme, theme: ThemeId) =>
    themeStore.setState({ [mode]: theme })

export { ON_PRESS_SPRING } from './motion'
