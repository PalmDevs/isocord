import { describe, expect, test } from 'bun:test'
import { colorHsl, scaleColor } from '../colors'
import { gradientRules } from './generated/gradients'
import {
    gradientBackground,
    gradientColors,
    gradientPresets,
    gradientStops,
    REFERENCE_DIM,
} from './gradient'
import type { CustomTheme } from './gradient'

const dark = gradientPresets.find(preset => preset.theme === 'darker')!
const light = gradientPresets.find(preset => preset.theme === 'light')!

describe('gradientColors', () => {
    test('base backgrounds turn see-through black or white', () => {
        expect(gradientColors(dark).BACKGROUND_BASE_LOWER).toBe('#000000b3')
        expect(gradientColors(light).BACKGROUND_BASE_LOWER).toBe('#ffffffcc')
    })

    test('a rule sets lightness on the gradient colour', () => {
        const [, , l] = colorHsl(gradientColors(dark).BACKGROUND_SURFACE_HIGH!)
        expect(l).toBeCloseTo(0.1, 1)
    })

    test('a custom theme gives every rule a colour', () => {
        const custom: CustomTheme = {
            colors: ['#ff0000'],
            angle: 90,
            baseMix: 0,
            dim: REFERENCE_DIM,
            base: 'darker',
        }
        const colors = gradientColors(custom)
        // Every rule, plus the tinted surfaces.
        expect(Object.keys(colors)).toEqual(
            expect.arrayContaining(Object.keys(gradientRules)),
        )
        for (const color of Object.values(colors))
            expect(color).toMatch(/^#[0-9a-f]{6,8}$/)
        expect(gradientBackground(custom)).toStartWith('linear-gradient(90deg')
    })

    test("a custom theme's Dim clears or fills the screens' dims", () => {
        const screen = (dim: number) =>
            gradientColors({
                colors: ['#ff0000'],
                angle: 90,
                baseMix: 0,
                dim,
                base: 'darker',
            }).BACKGROUND_BASE_LOWER
        expect(screen(REFERENCE_DIM)).toBe('#000000b3')
        expect(screen(0)).toBe('#00000000')
        expect(screen(100)).toBe('#000000')
    })

    test('gradientStops returns at least two stops', () => {
        const stops = gradientStops({
            colors: ['#ff0000'],
            angle: 90,
            baseMix: 0,
            dim: REFERENCE_DIM,
            base: 'darker',
        })
        expect(stops.colors).toHaveLength(2)
        expect(stops.stops).toEqual([0, 100])
    })
})

test('scaleColor clamps and interpolates', () => {
    const colors = ['#000000', '#ffffff']
    expect(scaleColor(colors, [20, 80], 0)).toBe('#000000')
    expect(scaleColor(colors, [20, 80], 100)).toBe('#ffffff')
    expect(scaleColor(colors, [20, 80], 50)).toBe('rgba(128, 128, 128, 1)')
})
