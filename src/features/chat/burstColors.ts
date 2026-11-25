import {
    colorHsl,
    colorHsv,
    contrastRatio,
    hslColor,
    relativeLuminance,
    setColorOpacity,
    toHex,
} from '../../design/colors'
import { argb } from './color'
import type { BurstColors } from './rows/rows'

/**
 * EmojiColorUtils.buildPlatformedThemedEmojiColorPalette: a super reaction's colours from its `burst_colors`, for
 * the light and dark themes. The helpers follow ColorUtils (chroma-js in the reference).
 */

/** A `burst_colors` entry: six hex digits, with or without `#`. */
const HEX_COLOR = /^#?([a-f\d]{6})$/i
/** The surfaces the reference measures contrast against (c3 and c4 in EmojiColorUtils). */
const LIGHT_SURFACE = '#ffffff'
const DARK_SURFACE = '#36393e'
/** getAccessibleForegroundColor: steps of lightness, and how many it tries. */
const LIGHTNESS_STEP = 0.05
const MAX_STEPS = 10
/** getAccessibleForegroundColor: it lightens on a surface this dark, and stops at these lightnesses. */
const DARK_SURFACE_LUMINANCE = 0.5
const MAX_LIGHTNESS = 0.95
const MIN_LIGHTNESS = 0.05
/** Below this saturation the fill is drawn more opaque. */
const GREY_SATURATION = 0.1
/** How far the fill's lightness moves from the colour, and its limits. */
const LIGHTNESS_SHIFT = 0.6
const LIGHTEST = 0.9
const DARKEST = 0.1
/** The contrast the accent and the fill need against the surface. */
const ACCENT_CONTRAST = 7
const FILL_CONTRAST = { light: 3, dark: 5 }
/** The fill's opacity, by theme, for a colourful and a greyish colour. */
const FILL_OPACITY = {
    light: { colour: 0.1, grey: 0.35 },
    dark: { colour: 0.2, grey: 0.5 },
}

/** hex2rgb2hsv: saturation and value from 0 to 100. */
function saturationPlusValue(color: string): number {
    const [, saturation, value] = colorHsv(color)
    return saturation * 100 + value * 100
}

/** getColorLightnessAdjusted: lighter or darker by LIGHTNESS_SHIFT, within LIGHTEST and DARKEST. */
function lightnessAdjusted(color: string, lighter: boolean): string {
    const [h, s, l] = colorHsl(color)
    const adjusted = lighter
        ? l + LIGHTNESS_SHIFT <= 1
            ? l + LIGHTNESS_SHIFT
            : LIGHTEST
        : l - LIGHTNESS_SHIFT >= 0
          ? l - LIGHTNESS_SHIFT
          : DARKEST
    return hslColor(h, s, adjusted)
}

/** getAccessibleForegroundColor: moves the lightness away from the surface until the contrast reaches `ratio`. */
function accessible(
    foreground: string,
    surface: string,
    ratio: number,
): string {
    const lighten = relativeLuminance(surface) <= DARK_SURFACE_LUMINANCE
    let color = foreground
    for (let step = 0; step < MAX_STEPS; step++) {
        if (contrastRatio(color, surface) >= ratio) break
        const [h, s, l] = colorHsl(color)
        if (lighten ? l >= MAX_LIGHTNESS : l <= MIN_LIGHTNESS) break
        color = hslColor(h, s, l + (lighten ? LIGHTNESS_STEP : -LIGHTNESS_STEP))
    }
    return color
}

/** One theme's palette: the accent against the surface, the fill as a tint of the colour at its opacity. */
function palette(color: string, dark: boolean, grey: boolean): BurstColors {
    const theme = dark ? 'dark' : 'light'
    const surface = dark ? DARK_SURFACE : LIGHT_SURFACE
    const fill = accessible(
        lightnessAdjusted(color, !dark),
        surface,
        FILL_CONTRAST[theme],
    )
    return {
        accent: argb(accessible(color, surface, ACCENT_CONTRAST)),
        background: argb(
            toHex(
                setColorOpacity(
                    fill,
                    FILL_OPACITY[theme][grey ? 'grey' : 'colour'],
                ),
            ),
        ),
    }
}

/** The light and dark palettes of a super reaction, from the most vivid of its first three colours (findColorByHsv). */
export function burstColors(
    colors: string[] | undefined,
): { light: BurstColors; dark: BurstColors } | undefined {
    const candidates = (colors ?? [])
        .slice(0, 3)
        .map(color => HEX_COLOR.exec(color)?.[1])
        .filter(hex => hex !== undefined)
        .map(hex => `#${hex}`)
    const color = candidates.sort(
        (a, b) => saturationPlusValue(b) - saturationPlusValue(a),
    )[0]
    if (!color) return undefined
    const [, saturation] = colorHsl(color)
    const grey = saturation < GREY_SATURATION
    return {
        light: palette(color, false, grey),
        dark: palette(color, true, grey),
    }
}
