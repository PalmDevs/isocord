/**
 * Colours cross the bridge as signed 32-bit ARGB integers (`Color(int)` on the Kotlin side).
 * Absent or zero colours are omitted by callers.
 */

/** `#rrggbb` or `#rrggbbaa` to ARGB. */
export function argb(color: string): number {
    const rgb = Number.parseInt(color.slice(1, 7), 16)
    const alpha =
        color.length >= 9 ? Number.parseInt(color.slice(7, 9), 16) : 255
    return (alpha << 24) | rgb | 0
}

/** Discord's 0xRRGGBB integer to opaque ARGB; 0 means "no colour". */
export function rgbInt(color: number | null | undefined): number | undefined {
    return color ? 0xff000000 | color | 0 : undefined
}

/** An RGB or ARGB integer to `#rrggbb`, dropping any alpha. */
export const hexColor = (color: number) =>
    `#${(color & 0xffffff).toString(16).padStart(6, '0')}`
