/** Colour maths for derived colours, after chroma-js as the reference's Colors.tsx uses it. */

type Rgba = [number, number, number, number]
type Lab = [number, number, number]

/** WCAGContrastRatios.HighContrastText. */
export const HIGH_CONTRAST_TEXT = 7
/** getContrastingColor's default tolerance. */
const DEFAULT_TOLERANCE = 3
/** getContrastingColor's step limit. */
const MAX_STEPS = 99
/** chroma-js darken and brighten: Lab lightness moved per unit. */
const LAB_STEP = 18
/** Lab reference white (D65) and the CIE constants. */
const WHITE_POINT: Lab = [0.95047, 1, 1.08883]
const LAB_EPSILON = 216 / 24389
const LAB_KAPPA_SLOPE = 841 / 108
const LAB_OFFSET = 4 / 29
const BYTE = 255
const SHORT_HEX_RGB = 3
const SHORT_HEX_RGBA = 4
const HEX_RGB_END = 6
const HEX_RGBA_END = 8

/** Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` or `rgba(r, g, b, a)`. */
function parse(color: string): Rgba {
    if (color.startsWith('#')) {
        let hex = color.slice(1)
        if (hex.length === SHORT_HEX_RGB || hex.length === SHORT_HEX_RGBA) {
            hex = hex
                .split('')
                .map(c => c + c)
                .join('')
        }
        const alpha =
            hex.length >= HEX_RGBA_END
                ? Number.parseInt(hex.slice(HEX_RGB_END, HEX_RGBA_END), 16) /
                  BYTE
                : 1
        const rgb = Number.parseInt(hex.slice(0, HEX_RGB_END), 16)
        return [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff, alpha]
    }
    const [r, g, b, a = 1] = color
        .replace(/[^\d.,]/g, '')
        .split(',')
        .map(Number)
    return [r!, g!, b!, a]
}

const format = ([r, g, b, a]: Rgba) =>
    `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`

const clampByte = (value: number) => Math.min(BYTE, Math.max(0, value))

const linear = (channel: number) => {
    const c = channel / BYTE
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const gamma = (channel: number) =>
    BYTE *
    (channel <= 0.0031308
        ? 12.92 * channel
        : 1.055 * channel ** (1 / 2.4) - 0.055)

/** chroma.luminance: the WCAG relative luminance. */
function luminance(color: Rgba): number {
    const [r, g, b] = color
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** chroma.contrast: the WCAG contrast ratio. */
function contrast(a: Rgba, b: Rgba): number {
    const [first, second] = [luminance(a), luminance(b)]
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

const labFunction = (t: number) =>
    t > LAB_EPSILON ? Math.cbrt(t) : LAB_KAPPA_SLOPE * t + LAB_OFFSET
const labInverse = (t: number) =>
    t ** 3 > LAB_EPSILON ? t ** 3 : (t - LAB_OFFSET) / LAB_KAPPA_SLOPE

function toLab([r, g, b]: Rgba): Lab {
    const [lr, lg, lb] = [linear(r), linear(g), linear(b)]
    const x =
        (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / WHITE_POINT[0]
    const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / WHITE_POINT[1]
    const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / WHITE_POINT[2]
    const [fx, fy, fz] = [labFunction(x), labFunction(y), labFunction(z)]
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function fromLab([l, a, b]: Lab, alpha: number): Rgba {
    const fy = (l + 16) / 116
    const x = labInverse(fy + a / 500) * WHITE_POINT[0]
    const y = labInverse(fy) * WHITE_POINT[1]
    const z = labInverse(fy - b / 200) * WHITE_POINT[2]
    const lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
    const lg = -0.969266 * x + 1.8760108 * y + 0.041556 * z
    const lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
    return [
        clampByte(gamma(lr)),
        clampByte(gamma(lg)),
        clampByte(gamma(lb)),
        alpha,
    ]
}

/** chroma.darken, or brighten with a negative amount. */
function shiftLightness(color: Rgba, amount: number): Rgba {
    const [l, a, b] = toLab(color)
    return fromLab([l - LAB_STEP * amount, a, b], color[3])
}

/** darkenColor: Lab lightness down by 18 per unit of `amount`. */
export const darkenColor = (color: string, amount: number) =>
    format(shiftLightness(parse(color), amount))

/** setColorOpacity: the colour at `alpha`. */
export function setColorOpacity(color: string, alpha: number): string {
    const [r, g, b] = parse(color)
    return format([r, g, b, alpha])
}

const OPAQUE_ALPHA = 0.99
const ALPHA_DECIMALS = 3

/** Returns true when `color` is opaque (`alpha >= 0.99`). */
export function isOpaqueColor(color: string): boolean {
    const [, , , a = 1] = parse(color)
    return a >= OPAQUE_ALPHA
}

/** Blends `overlayColor` at `overlayAlpha` over `backgroundColor`, optionally keeping brightness. */
export function blendColors(
    overlayColor: string,
    backgroundColor: string,
    overlayAlpha: number,
    preserveBrightness = true,
): string {
    const [or, og, ob, oa] = parse(overlayColor)
    const [br, bg, bb, ba] = parse(backgroundColor)
    const a = Math.max(0, Math.min(1, overlayAlpha)) * oa
    const outAlpha = a + ba * (1 - a)
    if (outAlpha === 0) return 'rgba(0, 0, 0, 0)'
    const r = Math.round((or * a + br * ba * (1 - a)) / outAlpha)
    const g = Math.round((og * a + bg * ba * (1 - a)) / outAlpha)
    const b = Math.round((ob * a + bb * ba * (1 - a)) / outAlpha)
    const roundedAlpha = Number(outAlpha.toFixed(ALPHA_DECIMALS))
    if (!preserveBrightness || ba === 0) return format([r, g, b, roundedAlpha])

    const [targetL] = toLab([br, bg, bb, ba])
    const [, blendedA, blendedB] = toLab([r, g, b, outAlpha])
    const [pr, pg, pb] = fromLab([targetL, blendedA, blendedB], outAlpha)
    return format([pr, pg, pb, roundedAlpha])
}

/**
 * getContrastingColor: steps the colour's lightness until its contrast with `base` is within `tolerance` above
 * `contrastRatio`.
 */
export function getContrastingColor(
    color: string,
    base: string,
    contrastRatio: number,
    tolerance = DEFAULT_TOLERANCE,
): string {
    const baseRgba = parse(base)
    const baseLuminance = luminance(baseRgba)
    let current = parse(color)
    for (let step = 0; step < MAX_STEPS; step++) {
        const ratio = contrast(baseRgba, current)
        if (ratio >= contrastRatio && ratio <= contrastRatio + tolerance) break
        // Too little contrast moves away from the base, too much moves toward it.
        const away = ratio < contrastRatio
        const lighter = luminance(current) > baseLuminance
        current = shiftLightness(current, away === lighter ? -1 : 1)
    }
    return format(current)
}

/** Returns `color` as `#rrggbb`, or `#rrggbbaa` when not opaque. */
export function toHex(color: string): string {
    const [r, g, b, a] = parse(color)
    const byte = (v: number) =>
        Math.round(clampByte(v)).toString(16).padStart(2, '0')
    return `#${byte(r)}${byte(g)}${byte(b)}${a < 1 ? byte(a * BYTE) : ''}`
}

/** chroma.luminance of a colour string. */
export const relativeLuminance = (color: string) => luminance(parse(color))

/** chroma.contrast of two colour strings. */
export const contrastRatio = (a: string, b: string) =>
    contrast(parse(a), parse(b))

/** chroma.scale(colors).domain(stops)(at): RGB interpolation, clamped to the first and last stop. */
export function scaleColor(colors: string[], stops: number[], at: number) {
    const next = stops.findIndex(stop => stop >= at)
    if (next <= 0) return colors[next === 0 ? 0 : colors.length - 1]!
    const t = (at - stops[next - 1]!) / (stops[next]! - stops[next - 1]!)
    return blendColors(colors[next]!, colors[next - 1]!, t, false)
}

type Hsl = [number, number, number]

/** chroma's rgb2hsl. A grey's hue is 0, not NaN, so a hue slider keeps a number. */
function toHsl([r, g, b]: Rgba): Hsl {
    const [rn, gn, bn] = [r / BYTE, g / BYTE, b / BYTE]
    const max = Math.max(rn, gn, bn)
    const min = Math.min(rn, gn, bn)
    const l = (max + min) / 2
    const d = max - min
    if (d === 0) return [0, 0, l]
    const s = l < 0.5 ? d / (max + min) : d / (2 - max - min)
    const h =
        60 *
        (rn === max
            ? (gn - bn) / d
            : gn === max
              ? 2 + (bn - rn) / d
              : 4 + (rn - gn) / d)
    return [h < 0 ? h + 360 : h, s, l]
}

/** chroma's hsl2rgb, before it rounds. Its arithmetic is kept, since other formulas round differently at .5. */
function fromHsl([h, s, l]: Hsl, alpha: number): Rgba {
    if (s === 0) return [l * BYTE, l * BYTE, l * BYTE, alpha]
    const t2 = l < 0.5 ? l * (1 + s) : l + s - l * s
    const t1 = 2 * l - t2
    const channel = (offset: number) => {
        let t = h / 360 + offset
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (6 * t < 1) return (t1 + (t2 - t1) * 6 * t) * BYTE
        if (2 * t < 1) return t2 * BYTE
        if (3 * t < 2) return (t1 + (t2 - t1) * (2 / 3 - t) * 6) * BYTE
        return t1 * BYTE
    }
    return [channel(1 / 3), channel(0), channel(-1 / 3), alpha]
}

/** Returns a colour's HSV hue (degrees), saturation and value (chroma's hsv). */
export function colorHsv(color: string): Hsl {
    const rgba = parse(color)
    const max = Math.max(rgba[0], rgba[1], rgba[2]) / BYTE
    const min = Math.min(rgba[0], rgba[1], rgba[2]) / BYTE
    return [toHsl(rgba)[0], max === 0 ? 0 : (max - min) / max, max]
}

/** chroma's set('hsl.s' | 'hsl.l'): a number sets the channel, `*k` multiplies it. */
export type HslValue = number | string

// Unclamped, as in chroma: a saturation past 1 still shifts the channels before they clip.
const applyHsl = (current: number, value: HslValue | undefined) => {
    if (value === undefined) return current
    return typeof value === 'number' ? value : current * Number(value.slice(1))
}

/** Returns `color` with its HSL saturation and lightness set or scaled. */
export function setHsl(
    color: string,
    saturation?: HslValue,
    lightness?: HslValue,
): string {
    const rgba = parse(color)
    const [h, s, l] = toHsl(rgba)
    const [r, g, b] = fromHsl(
        [h, applyHsl(s, saturation), applyHsl(l, lightness)],
        rgba[3],
    )
    // Clipped before `format`, since `parse` drops a minus sign.
    return toHex(format([clampByte(r), clampByte(g), clampByte(b), rgba[3]]))
}

/** Returns the opaque colour of a hue (degrees), saturation and lightness. */
export const hslColor = (hue: number, saturation: number, lightness: number) =>
    toHex(format(fromHsl([hue % 360, saturation, lightness], 1)))

/** Returns a colour's HSL hue (degrees), saturation and lightness. */
export const colorHsl = (color: string): Hsl => toHsl(parse(color))
