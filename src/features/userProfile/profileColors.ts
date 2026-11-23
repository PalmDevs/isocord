import { flattenColor } from '../../design/components/avatars/flattenColor'
import { themes } from '../../design/tokens'
import { hexColor } from '../chat/color'
import type { ViewStyle } from 'react-native'

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

/** useUserProfileGradientColors: blends the overlay into both stops for a single background draw. */
export function profileBackground(colors: [number, number]): ViewStyle {
    const overlay = profileOverlay(colors)
    const [primary, accent] = colors
    const start = flattenColor(overlay, hexColor(primary))
    const end = flattenColor(overlay, hexColor(accent))
    return {
        // TODO: experimental_backgroundImage is experimental in RN 0.88
        experimental_backgroundImage: `linear-gradient(${start}, ${end})`,
    }
}

/** The opaque colour at the top of the themed sheet, for avatar cutouts over it. */
export const profileTopColor = (colors: [number, number]) =>
    flattenColor(profileOverlay(colors), hexColor(colors[0]))
