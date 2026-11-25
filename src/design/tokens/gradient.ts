import {
    blendColors,
    relativeLuminance,
    scaleColor,
    setColorOpacity,
    setHsl,
    toHex,
} from '../colors'
import {
    SURFACE_TINT_ALPHA_DARK,
    SURFACE_TINT_ALPHA_LIGHT,
} from '../surfaceTint'
import { gradientPresets, gradientRules } from './generated/gradients'
import { rawColors } from './generated/rawColors'
import { semanticColors } from './generated/semanticColors'
import type { GradientPreset } from './generated/gradients'
import type { SemanticColor, ThemeId } from './generated/semanticColors'

export { gradientPresets }
export type { GradientPreset }

/** CustomUserThemeSettings: colours spread evenly, `baseMix` 0 to 100. Kept on the device only. */
export interface CustomTheme {
    colors: string[]
    angle: number
    baseMix: number
    /** Our own, 0 to 100: scales the black or white over the gradient. */
    dim: number
    base: 'light' | 'darker'
}

export type GradientSource = GradientPreset | CustomTheme

/** ClientThemesUtils GradientPercentage, GRADIENT_ANGLE_BREAKPOINT and OverlayOpacity. */
const START = 0
const MID = 50
const END = 100
const ANGLE_BREAKPOINT = 128
const PRESET_ALPHA = { dark: 0.2, light: 0.4 }
/** calculateGradientValueWithOpacity: a custom theme's alpha, raised by its base mix. */
const CUSTOM_ALPHA = { dark: 0.12, light: 0.3 }
const CUSTOM_ALPHA_MIX = 0.2
/** getGradientThemeMetadata: a custom theme's secondary colour. */
const CUSTOM_SECONDARY = { saturation: 0.2, dark: 0.9, light: 0.7 }
/** CustomThemesGradient: the drawn colours under black or white, less of it as base mix rises. */
const CUSTOM_DRAW_OVERLAY = 0.5
const CUSTOM_DRAW_MIX = { dark: 0.25, light: 0.2 }
const PERCENT = 100
/** The Dim that keeps the reference's dims. 0 clears them and 100 makes them opaque. */
export const REFERENCE_DIM = 50
/** The see-through black or white the screens draw over the gradient, scaled by Dim. */
const SCREEN_DIMS = new Set<string>([
    'BACKGROUND_BASE_LOW',
    'BACKGROUND_BASE_LOWER',
    'BACKGROUND_BASE_LOWEST',
    'CHANNEL_BACKGROUND_DEFAULT',
])
/** Opaque surfaces with no gradient rule, tinted like useSurfaceColor: sheets, alerts, the tab bar and the screens drawn like sheets. */
const TINTED_SURFACES = [
    'MOBILE_ACTIONSHEET_BACKGROUND',
    'MOBILE_ALERT_BACKGROUND_DEFAULT',
    'TAB_BAR_BACKGROUND',
] as const

const isPreset = (source: GradientSource): source is GradientPreset =>
    'id' in source

function stopsOf(source: GradientSource) {
    if (isPreset(source))
        return {
            colors: source.colors.map(stop => stop.color),
            stops: source.colors.map(stop => stop.stop),
        }
    const last = Math.max(1, source.colors.length - 1)
    return {
        colors: source.colors,
        stops: source.colors.map((_, index) => (index / last) * PERCENT),
    }
}

/** getCustomBackgroundGradient's base theme. */
export const baseThemeOf = (source: GradientSource): ThemeId =>
    isPreset(source) ? source.theme : source.base

/** The gradient rules' mode: Discord's gradient `theme`. */
const modeOf = (source: GradientSource) =>
    baseThemeOf(source) === 'light' ? 'light' : 'dark'

/** The colour laid over the gradient to dim it. */
const dimColorOf = (mode: 'light' | 'dark') =>
    mode === 'dark' ? rawColors.BLACK_500 : rawColors.WHITE_500

/** Returns a dim layer's alpha under a custom theme's Dim. Presets keep the reference's. */
function dimmed(alpha: number, source: GradientSource) {
    if (isPreset(source)) return alpha
    return source.dim <= REFERENCE_DIM
        ? (alpha * source.dim) / REFERENCE_DIM
        : alpha +
              ((1 - alpha) * (source.dim - REFERENCE_DIM)) /
                  (PERCENT - REFERENCE_DIM)
}

/** getGradientThemeMetadata: the `gradient.*` colours the rules read. */
function gradientSlots(source: GradientSource): Record<string, string> {
    const mode = modeOf(source)
    const { colors, stops } = stopsOf(source)
    const overlay = dimColorOf(mode)
    const alpha = isPreset(source)
        ? PRESET_ALPHA[mode]
        : CUSTOM_ALPHA[mode] + (CUSTOM_ALPHA_MIX * source.baseMix) / PERCENT
    const mixed = (at: number) =>
        blendColors(scaleColor(colors, stops, at), overlay, alpha, false)
    const start = mixed(START)
    const end = mixed(END)
    const flipped = source.angle > ANGLE_BREAKPOINT
    return {
        'gradient.start': start,
        'gradient.mid': mixed(isPreset(source) ? source.midpoint : MID),
        'gradient.end': end,
        'gradient.top': flipped ? start : end,
        'gradient.bottom': flipped ? end : start,
        'gradient.secondary': isPreset(source)
            ? colors[colors.length - 1]!
            : customSecondary(source.colors, mode),
    }
}

function customSecondary(colors: string[], mode: 'light' | 'dark') {
    const luminances = colors.map(relativeLuminance)
    const pick =
        mode === 'dark' ? Math.max(...luminances) : Math.min(...luminances)
    return setHsl(
        colors[luminances.indexOf(pick)]!,
        CUSTOM_SECONDARY.saturation,
        CUSTOM_SECONDARY[mode],
    )
}

/** SemanticColorContext with a gradient: each rule's colour, saturation, lightness and opacity. */
export function gradientColors(
    source: GradientSource,
): Partial<Record<SemanticColor, string>> {
    const mode = modeOf(source)
    const slots = gradientSlots(source)
    const colors: Partial<Record<SemanticColor, string>> = {}
    for (const [name, rules] of Object.entries(gradientRules)) {
        const rule = rules[mode]
        const color = setHsl(
            slots[rule.color] ?? rule.color,
            rule.saturation,
            rule.lightness,
        )
        colors[name as SemanticColor] =
            rule.opacity === undefined
                ? color
                : toHex(
                      setColorOpacity(
                          color,
                          SCREEN_DIMS.has(name)
                              ? dimmed(rule.opacity, source)
                              : rule.opacity,
                      ),
                  )
    }
    const tint = gradientTint(source)
    const alpha = tint.light
        ? SURFACE_TINT_ALPHA_LIGHT
        : SURFACE_TINT_ALPHA_DARK
    // Hex like every other theme colour: the chat's `argb` reads only hex.
    for (const name of TINTED_SURFACES)
        colors[name] = toHex(
            blendColors(
                tint.primaryColor,
                semanticColors[baseThemeOf(source)][name],
                alpha,
            ),
        )
    return colors
}

/**
 * Returns the CSS gradient stops and angle drawn behind every screen (ThemedGradient). A custom theme's colours sit
 * under black or white (CustomThemesGradient `mix`), scaled by its Dim.
 */
export function gradientStops(source: GradientSource): {
    angle: number
    colors: string[]
    stops: number[]
} {
    const mode = modeOf(source)
    const { colors, stops } = stopsOf(source)
    const drawn = isPreset(source)
        ? colors
        : colors.map(color =>
              blendColors(
                  dimColorOf(mode),
                  color,
                  dimmed(
                      CUSTOM_DRAW_OVERLAY +
                          CUSTOM_DRAW_MIX[mode] *
                              (1 - source.baseMix / PERCENT),
                      source,
                  ),
                  false,
              ),
          )
    // A single colour still needs two stops.
    if (drawn.length === 1)
        return {
            angle: source.angle,
            colors: [drawn[0]!, drawn[0]!],
            stops: [START, END],
        }
    return { angle: source.angle, colors: drawn, stops }
}

/**
 * Returns the CSS gradient drawn behind every screen (ThemedGradient).
 * shortcut: CSS angles, not the reference's start and end points, upgrade if the direction looks off.
 */
export function gradientBackground(source: GradientSource): string {
    const { angle, colors, stops } = gradientStops(source)
    const parts = colors.map((color, index) => `${color} ${stops[index]}%`)
    return `linear-gradient(${angle}deg, ${parts.join(', ')})`
}

/**
 * What a floating surface (toast, menu, alert) sits over on a gradient theme: the gradient's midpoint under the
 * screens' dim `mix`. Their see-through colours are flattened over it.
 */
export const gradientBackdrop = (source: GradientSource, mix: string) =>
    toHex(blendColors(mix, gradientTint(source).primaryColor, 1, false))

/** The gradient's colour at its midpoint, the tint of surfaces drawn over it. */
function gradientTint(source: GradientSource) {
    const { colors, stops } = stopsOf(source)
    return {
        primaryColor: toHex(
            scaleColor(colors, stops, isPreset(source) ? source.midpoint : MID),
        ),
        light: modeOf(source) === 'light',
    }
}

/** ChatInputScrimGradient on a gradient theme: the gradient's end colour (useGradientValue END). */
export const gradientScrim = (source: GradientSource) =>
    toHex(gradientSlots(source)['gradient.end']!)
