import { expect, test } from 'bun:test'
import { setHsl } from '../../design/colors'
import { burstColors } from './burstColors'

// Expected values come from chroma-js 2.6, the reference's colour library.

/** A palette as ARGB hex: light accent, light fill, dark accent, dark fill. */
function paletteHex(colors: string[]) {
    const palette = burstColors(colors)
    if (!palette) return undefined
    const hex = (argb?: number) =>
        argb === undefined ? '' : (argb >>> 0).toString(16).padStart(8, '0')
    const { light, dark } = palette
    return [light.accent, light.background, dark.accent, dark.background].map(
        hex,
    )
}

test('burstColors matches chroma', () => {
    expect(paletteHex(['#ff0000'])).toEqual([
        'ffb40000',
        '1aff4d4d',
        'ffffd0d0',
        '33ff3636',
    ])
    // A grey fill is more opaque.
    expect(paletteHex(['#808080'])).toEqual([
        'ff595959',
        '598b8b8b',
        'ffcecece',
        '809c9c9c',
    ])
    expect(paletteHex(['5865f2'])).toEqual([
        'ff2839ee',
        '1a707bf3',
        'ffd0d3fc',
        '332630ec',
    ])
    // The most vivid colour wins.
    expect(paletteHex(['#123456', '#00ff88'])).toEqual([
        'ff00502a',
        '1a00cd6c',
        'ff00ff88',
        '3300ce69',
    ])
    expect(burstColors(['nope'])).toBeUndefined()
    expect(burstColors(undefined)).toBeUndefined()
})

test('setHsl scales saturation past 1 before the channels clip, as chroma', () => {
    expect(setHsl('#4fdefc', '*1.46')).toBe('#27f8ff')
    expect(setHsl('#ff0000', undefined, 0.25)).toBe('#800000')
})
