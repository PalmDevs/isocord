import { flattenColor } from '../../design/components/avatars/flattenColor'
import { themes } from '../../design/tokens'
import { hexColor } from '../chat/color'
import type { ViewStyle } from 'react-native'

/** Returns the Nitro theme's gradient as a vertical `linear-gradient` from its primary to its accent colour. */
export function profileGradient(colors: [number, number]): string {
    return `linear-gradient(${hexColor(colors[0])}, ${hexColor(colors[1])})`
}

/** getDarkness above this picks the dark theme (getProfileTheme). */
export const DARK_THRESHOLD = 0.5

/** getProfileTheme: dark over a dark primary colour, light over a bright one, by its perceived darkness. */
export function profileThemeName(primary: number): 'dark' | 'light' {
    const r = (primary >> 16) & 0xff
    const g = (primary >> 8) & 0xff
    const b = primary & 0xff
    const darkness = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return darkness > DARK_THRESHOLD ? 'dark' : 'light'
}

/** PROFILE_GRADIENT_OVERLAY of the theme the profile's colours pick, not the app's. */
export const profileOverlay = (colors: [number, number]) =>
    themes[profileThemeName(colors[0])].colors.PROFILE_GRADIENT_OVERLAY

/**
 * useProfileThemeValues: the sheet's background, the theme gradient under PROFILE_GRADIENT_OVERLAY. Set on the
 * sheet itself, so it also fills the sheet's bottom padding.
 */
export function profileBackground(colors: [number, number]): ViewStyle {
    const overlay = profileOverlay(colors)
    return {
        // TODO: experimental_backgroundImage is experimental in RN 0.88
        experimental_backgroundImage: `linear-gradient(${overlay}, ${overlay}), ${profileGradient(colors)}`,
    }
}

/** The opaque colour at the top of the themed sheet, for avatar cutouts over it. */
export const profileTopColor = (colors: [number, number]) =>
    flattenColor(profileOverlay(colors), hexColor(colors[0]))
