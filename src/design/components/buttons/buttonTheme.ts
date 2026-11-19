import { createContext, useContext } from 'react'
import {
    darkenColor,
    getContrastingColor,
    HIGH_CONTRAST_TEXT,
    setColorOpacity,
} from '../../colors'
import type { SemanticColor } from '../../tokens'
import type { ButtonVariant } from './buttonVariants'

/** The theme colours buttons draw in, such as a profile's: its primary colour and whether its theme is light. */
export interface ButtonTheme {
    primaryColor: string
    light: boolean
}

export const ButtonThemeContext = createContext<ButtonTheme | undefined>(
    undefined,
)

/** A variant's colours in a theme: raw colours, default then pressed. A missing part keeps the variant's token. */
export interface ThemedSurface {
    background?: [string, string]
    border?: [string, string]
    text?: SemanticColor
}

const WHITE = '#ffffff'
/** useProfileThemedButtonStyles: the pressed primary and tertiary shades. */
const PRIMARY_PRESSED_DARKEN = 0.5
const TERTIARY_PRESSED_DARKEN = 0.3
/** useProfileThemedButtonStyles: white over the theme, default then pressed, for a light and a dark theme. */
const SECONDARY_ALPHAS = { light: [0.72, 0.62], dark: [0.24, 0.34] } as const
const TERTIARY_DARK_ALPHAS = [0.1, 0.2] as const
const TERTIARY_LIGHT_ALPHA = 0.4

function themedSurface(
    variant: ButtonVariant,
    { primaryColor, light }: ButtonTheme,
): ThemedSurface | undefined {
    switch (variant) {
        case 'primary': {
            const base = getContrastingColor(
                primaryColor,
                WHITE,
                HIGH_CONTRAST_TEXT,
            )
            const pair: [string, string] = [
                base,
                darkenColor(base, PRIMARY_PRESSED_DARKEN),
            ]
            return { background: pair, border: pair, text: 'WHITE' }
        }
        case 'secondary': {
            const [rest, pressed] = SECONDARY_ALPHAS[light ? 'light' : 'dark']
            return {
                background: [
                    setColorOpacity(WHITE, rest),
                    setColorOpacity(WHITE, pressed),
                ],
            }
        }
        case 'tertiary': {
            const rest = light
                ? setColorOpacity(primaryColor, TERTIARY_LIGHT_ALPHA)
                : setColorOpacity(WHITE, TERTIARY_DARK_ALPHAS[0])
            const pressed = light
                ? darkenColor(rest, TERTIARY_PRESSED_DARKEN)
                : setColorOpacity(WHITE, TERTIARY_DARK_ALPHAS[1])
            return { background: [rest, pressed] }
        }
        default:
            return undefined
    }
}

/** useProfileThemedButtonStyles: the variant's colours in the button theme above, undefined without one. */
export function useThemedSurface(
    variant: ButtonVariant | undefined,
): ThemedSurface | undefined {
    const theme = useContext(ButtonThemeContext)
    return theme && variant ? themedSurface(variant, theme) : undefined
}
