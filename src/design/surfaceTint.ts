import { useContext } from 'react'
import { useUnistyles } from 'react-native-unistyles'
import { blendColors, isOpaqueColor, toHex } from './colors'
import { ButtonThemeContext } from './components/buttons/buttonTheme'
import type { ButtonTheme } from './components/buttons/buttonTheme'

/** Material 3 surface tint alpha for dark theme surfaces. */
export const SURFACE_TINT_ALPHA_DARK = 0.2
/** Material 3 surface tint alpha for light theme surfaces. */
export const SURFACE_TINT_ALPHA_LIGHT = 0.75

/** Returns `baseColor` tinted with the active button theme colour. */
export function useSurfaceColor(
    baseColor: string,
    customAlpha?: number,
    themeOverride?: ButtonTheme | null,
): string {
    const contextTheme = useContext(ButtonThemeContext)
    const { theme: appTheme } = useUnistyles()
    // A floating surface is opaque: on a gradient theme a see-through colour is flattened over the backdrop.
    if (!isOpaqueColor(baseColor) && appTheme.backdrop)
        baseColor = toHex(blendColors(baseColor, appTheme.backdrop, 1, false))
    const theme =
        themeOverride === null ? undefined : (themeOverride ?? contextTheme)
    if (!theme || !isOpaqueColor(baseColor)) return baseColor
    const alpha =
        customAlpha ??
        (theme.light ? SURFACE_TINT_ALPHA_LIGHT : SURFACE_TINT_ALPHA_DARK)
    return blendColors(theme.primaryColor, baseColor, alpha)
}
