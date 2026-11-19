import type { BurstColors } from './rows/rows'

/**
 * EmojiColorUtils.buildPlatformedThemedEmojiColorPalette: a super reaction's colours from its `burst_colors`, for
 * the light and dark themes. The helpers follow ColorUtils (chroma-js in the reference).
 */

interface Rgb {
    r: number
    g: number
    b: number
}
interface Hsl {
    h: number
    s: number
    l: number
}

/** The surfaces the reference measures contrast against (c3 and c4 in EmojiColorUtils). */
const LIGHT_SURFACE: Rgb = { r: 0xff, g: 0xff, b: 0xff }
const DARK_SURFACE: Rgb = { r: 0x36, g: 0x39, b: 0x3e }
/** getAccessibleForegroundColor: steps of lightness, and how many it tries. */
const LIGHTNESS_STEP = 0.05
const MAX_STEPS = 10
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

function parseHex(hex: string): Rgb | undefined {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!match) return undefined
    const [, r = '0', g = '0', b = '0'] = match
    return {
        r: Number.parseInt(r, 16),
        g: Number.parseInt(g, 16),
        b: Number.parseInt(b, 16),
    }
}

/** hex2rgb2hsv: saturation and value from 0 to 100. */
function saturationPlusValue({ r, g, b }: Rgb): number {
    const max = Math.max(r, g, b) / 255
    const min = Math.min(r, g, b) / 255
    const saturation = max === 0 ? 0 : (max - min) / max
    return saturation * 100 + max * 100
}

function toHsl({ r, g, b }: Rgb): Hsl {
    const [red, green, blue] = [r / 255, g / 255, b / 255]
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)
    const l = (max + min) / 2
    if (max === min) return { h: 0, s: 0, l }
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    const h =
        max === red
            ? (green - blue) / d + (green < blue ? 6 : 0)
            : max === green
              ? (blue - red) / d + 2
              : (red - green) / d + 4
    return { h: h / 6, s, l }
}

function toRgb({ h, s, l }: Hsl): Rgb {
    if (s === 0) {
        const v = Math.round(l * 255)
        return { r: v, g: v, b: v }
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const channel = (offset: number) => {
        let x = h + offset
        if (x < 0) x += 1
        if (x > 1) x -= 1
        const v =
            x < 1 / 6
                ? p + (q - p) * 6 * x
                : x < 1 / 2
                  ? q
                  : x < 2 / 3
                    ? p + (q - p) * (2 / 3 - x) * 6
                    : p
        return Math.round(v * 255)
    }
    return { r: channel(1 / 3), g: channel(0), b: channel(-1 / 3) }
}

/** WCAG relative luminance. */
function luminance({ r, g, b }: Rgb): number {
    const linear = (c: number) => {
        const v = c / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function contrast(a: Rgb, b: Rgb): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}

/** getColorLightnessAdjusted: lighter or darker by LIGHTNESS_SHIFT, within LIGHTEST and DARKEST. */
function lightnessAdjusted(color: Rgb, lighter: boolean): Rgb {
    const hsl = toHsl(color)
    const l = lighter
        ? hsl.l + LIGHTNESS_SHIFT <= 1
            ? hsl.l + LIGHTNESS_SHIFT
            : LIGHTEST
        : hsl.l - LIGHTNESS_SHIFT >= 0
          ? hsl.l - LIGHTNESS_SHIFT
          : DARKEST
    return toRgb({ ...hsl, l })
}

/** getAccessibleForegroundColor: moves the lightness away from the surface until the contrast reaches `ratio`. */
function accessible(foreground: Rgb, surface: Rgb, ratio: number): Rgb {
    const lighten = luminance(surface) <= 0.5
    let color = foreground
    for (let step = 0; step < MAX_STEPS; step++) {
        if (contrast(color, surface) >= ratio) break
        const hsl = toHsl(color)
        if (lighten ? hsl.l >= 0.95 : hsl.l <= 0.05) break
        color = toRgb({
            ...hsl,
            l: hsl.l + (lighten ? LIGHTNESS_STEP : -LIGHTNESS_STEP),
        })
    }
    return color
}

const opaque = ({ r, g, b }: Rgb) => (0xff << 24) | (r << 16) | (g << 8) | b
const withOpacity = ({ r, g, b }: Rgb, opacity: number) =>
    (Math.round(opacity * 255) << 24) | (r << 16) | (g << 8) | b

/** One theme's palette: the accent against the surface, the fill as a tint of the colour at its opacity. */
function palette(color: Rgb, dark: boolean, grey: boolean): BurstColors {
    const theme = dark ? 'dark' : 'light'
    const surface = dark ? DARK_SURFACE : LIGHT_SURFACE
    const fill = accessible(
        lightnessAdjusted(color, !dark),
        surface,
        FILL_CONTRAST[theme],
    )
    return {
        accent: opaque(accessible(color, surface, ACCENT_CONTRAST)),
        background: withOpacity(
            fill,
            FILL_OPACITY[theme][grey ? 'grey' : 'colour'],
        ),
    }
}

/** The light and dark palettes of a super reaction, from the most vivid of its first three colours (findColorByHsv). */
export function burstColors(
    colors: string[] | undefined,
): { light: BurstColors; dark: BurstColors } | undefined {
    const candidates = (colors ?? [])
        .slice(0, 3)
        .map(parseHex)
        .filter(color => color !== undefined)
    const color = candidates.sort(
        (a, b) => saturationPlusValue(b) - saturationPlusValue(a),
    )[0]
    if (!color) return undefined
    const grey = toHsl(color).s < GREY_SATURATION
    return {
        light: palette(color, false, grey),
        dark: palette(color, true, grey),
    }
}
