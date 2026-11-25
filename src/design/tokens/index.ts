import { Appearance } from 'react-native'
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles'
import { createStore } from 'zustand/vanilla'
import { logger } from '../../core/log'
import { deviceStorage } from '../../core/storage'
import { modules } from './generated/modules'
import { radii } from './generated/radii'
import { rawColors } from './generated/rawColors'
import { semanticColors } from './generated/semanticColors'
import { shadows } from './generated/shadows'
import { space } from './generated/space'
import { textVariants } from './generated/typography'
import {
    baseThemeOf,
    gradientBackdrop,
    gradientBackground,
    gradientColors,
    gradientPresets,
    gradientScrim,
    gradientStops,
    REFERENCE_DIM,
} from './gradient'
import type { SemanticColor, ThemeId } from './generated/semanticColors'
import type { TextVariant } from './generated/typography'
import type { CustomTheme, GradientSource } from './gradient'

export { gradientBackground, gradientPresets }
export type { CustomTheme, GradientSource, SemanticColor, TextVariant, ThemeId }

const THEME_KEY = 'theme'
const SAME_AS_DEVICE_KEY = 'theme.sameAsDevice'
const MODE_KEYS = { light: 'theme.light', dark: 'theme.dark' } as const
const CUSTOM_KEY = 'theme.customs'
/** Starts a saved custom theme's id, which is also its theme choice. */
const CUSTOM_ID_PREFIX = 'custom-'

/** A base theme id, a gradient preset id or a saved custom theme's id. */
export type ThemeChoice = string

/** Saved custom themes by id, in the order they were made. */
export type CustomThemes = Record<string, CustomTheme>

export type SystemTheme = keyof typeof MODE_KEYS

/**
 * ThemeStore's state, kept on the device only. With Same as Device Theme on, the device's light or dark mode
 * picks `light` or `dark` (UnsyncedUserSettingsStore.useSystemTheme, THEME_PREFERENCES_MOBILE by default).
 */
export interface ThemeState {
    theme: ThemeChoice
    sameAsDevice: boolean
    light: ThemeChoice
    dark: ThemeChoice
    customs: CustomThemes
}

/** Each slot's choice on first launch, and after its custom theme is deleted. */
const DEFAULT_CHOICES = { theme: 'dark', light: 'light', dark: 'darker' }

const firstPreset = gradientPresets[0]!
/** A new custom theme starts from the first preset. */
export const NEW_CUSTOM_THEME: CustomTheme = {
    colors: firstPreset.colors.map(stop => stop.color),
    angle: firstPreset.angle,
    baseMix: 50,
    dim: REFERENCE_DIM,
    base: 'darker',
}

/** Returns the stored custom themes. Corrupt ones are dropped instead of failing startup. */
function readCustoms(): CustomThemes {
    const stored = deviceStorage.getString(CUSTOM_KEY)
    if (!stored) return {}
    try {
        const customs = JSON.parse(stored) as CustomThemes
        return Object.fromEntries(
            Object.entries(customs)
                .filter(
                    ([, custom]) =>
                        Array.isArray(custom?.colors) &&
                        custom.colors.length > 0,
                )
                // Themes saved before Dim keep the reference's dims.
                .map(([id, custom]) => [
                    id,
                    { ...custom, dim: custom.dim ?? REFERENCE_DIM },
                ]),
        )
    } catch (error) {
        logger('Theme').warn('Unreadable custom themes', error)
        return {}
    }
}

export const themeStore = createStore<ThemeState>(() => ({
    theme: deviceStorage.getString(THEME_KEY) ?? DEFAULT_CHOICES.theme,
    sameAsDevice: deviceStorage.getBoolean(SAME_AS_DEVICE_KEY) ?? false,
    light: deviceStorage.getString(MODE_KEYS.light) ?? DEFAULT_CHOICES.light,
    dark: deviceStorage.getString(MODE_KEYS.dark) ?? DEFAULT_CHOICES.dark,
    customs: readCustoms(),
}))

// resolveTheme: the device's mode picks the theme when Same as Device Theme is on.
function resolveChoice(state: ThemeState): ThemeChoice {
    if (!state.sameAsDevice) return state.theme
    return Appearance.getColorScheme() === 'light' ? state.light : state.dark
}

/** Returns the gradient a choice draws, undefined for a base theme or an unknown id. */
export function gradientOf(
    choice: ThemeChoice,
    customs: CustomThemes,
): GradientSource | undefined {
    return (
        customs[choice] ?? gradientPresets.find(preset => preset.id === choice)
    )
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
        /** The CSS gradient behind every screen, set on the gradient theme only. */
        background: undefined as string | undefined,
        /** The chat input scrim's colour (ChatInputScrimGradient), set on the gradient theme only. */
        scrim: undefined as string | undefined,
        /** The gradient stops and angle behind every screen, set on the gradient theme only. */
        gradient: undefined as ReturnType<typeof gradientStops> | undefined,
        /** The opaque colour floating surfaces are flattened over, set on the gradient theme only. */
        backdrop: undefined as string | undefined,
        shadows: shadows[id]!,
        text: textVariants,
        // Component tokens at the default chat density, with mobile-visual-refresh applied.
        modules: modules.default,
        radii,
        space,
    }
}

/** A base theme with a gradient's colours over it (SemanticColorContext `gradient`). */
function makeGradientTheme(source: GradientSource) {
    const base = makeTheme(baseThemeOf(source))
    const colors = { ...base.colors, ...gradientColors(source) }
    return {
        ...base,
        colors,
        background: gradientBackground(source),
        scrim: gradientScrim(source),
        gradient: gradientStops(source),
        backdrop: gradientBackdrop(source, colors.BACKGROUND_BASE_LOWEST),
    }
}

const initialState = themeStore.getState()

/**
 * Discord's four base themes, and the slot the active gradient theme is built into.
 * `dark` is Ash, `darker` is the legacy Dark, `midnight` is Onyx.
 */
export const themes = {
    dark: makeTheme('dark'),
    darker: makeTheme('darker'),
    midnight: makeTheme('midnight'),
    light: makeTheme('light'),
    gradient: makeGradientTheme(
        gradientOf(resolveChoice(initialState), initialState.customs) ??
            firstPreset,
    ),
    /** The custom theme builder's draft, drawn only in its preview. */
    preview: makeGradientTheme(NEW_CUSTOM_THEME),
}

type AppThemes = typeof themes
declare module 'react-native-unistyles' {
    export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
    themes,
    settings: {
        initialTheme: () => themeKey(initialState),
    },
})

function themeKey(state: ThemeState): keyof typeof themes {
    const choice = resolveChoice(state)
    if (gradientOf(choice, state.customs)) return 'gradient'
    return choice in semanticColors ? (choice as ThemeId) : 'dark'
}

/** The gradient last built into the `gradient` slot, so unrelated changes skip rebuilding it. */
let builtGradient = gradientOf(
    resolveChoice(initialState),
    initialState.customs,
)

function applyTheme() {
    const state = themeStore.getState()
    const gradient = gradientOf(resolveChoice(state), state.customs)
    if (gradient && gradient !== builtGradient) {
        builtGradient = gradient
        UnistylesRuntime.updateTheme('gradient', () =>
            makeGradientTheme(gradient),
        )
    }
    UnistylesRuntime.setTheme(themeKey(state))
}

themeStore.subscribe(state => {
    deviceStorage.set(THEME_KEY, state.theme)
    deviceStorage.set(SAME_AS_DEVICE_KEY, state.sameAsDevice)
    deviceStorage.set(MODE_KEYS.light, state.light)
    deviceStorage.set(MODE_KEYS.dark, state.dark)
    deviceStorage.set(CUSTOM_KEY, JSON.stringify(state.customs))
    applyTheme()
})
// ThemeActionCreators.setSystemThemeIfNeeded on the device's mode changing.
Appearance.addChangeListener(applyTheme)

/** The theme used while Same as Device Theme is off. */
export const setTheme = (theme: ThemeChoice) => themeStore.setState({ theme })

/** Returns an id for a new custom theme. */
export const newCustomThemeId = () =>
    `${CUSTOM_ID_PREFIX}${Date.now().toString(36)}`

/** Saves a custom theme under `id` and picks it, for the app or for one device mode. */
export const applyCustomTheme = (
    id: string,
    custom: CustomTheme,
    mode?: SystemTheme,
) =>
    themeStore.setState(state => ({
        customs: { ...state.customs, [id]: custom },
        [mode ?? 'theme']: id,
    }))

/** Deletes a custom theme. Each slot that used it goes back to its default. */
export function deleteCustomTheme(id: string) {
    const state = themeStore.getState()
    const { [id]: _deleted, ...customs } = state.customs
    themeStore.setState({
        customs,
        theme: state.theme === id ? DEFAULT_CHOICES.theme : state.theme,
        light: state.light === id ? DEFAULT_CHOICES.light : state.light,
        dark: state.dark === id ? DEFAULT_CHOICES.dark : state.dark,
    })
}

/** Rebuilds the `preview` slot from the builder's draft. Restyles every view, so call it when an edit ends. */
export const setPreviewTheme = (source: GradientSource) =>
    UnistylesRuntime.updateTheme('preview', () => makeGradientTheme(source))

/** SameAsDeviceThemeSetting: enableSameAsDeviceTheme / disableSameAsDeviceTheme. */
export const setSameAsDeviceTheme = (sameAsDevice: boolean) =>
    themeStore.setState({ sameAsDevice })

/** handleSaveSyncedModeTheme: the theme one device mode uses. Kept on the device only. */
export const setModeTheme = (mode: SystemTheme, theme: ThemeChoice) =>
    themeStore.setState({ [mode]: theme })

export { ON_PRESS_SPRING } from './motion'
