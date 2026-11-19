import { ScopedTheme } from 'react-native-unistyles'
import { ButtonThemeContext } from '../../design/components/buttons/buttonTheme'
import { hexColor } from '../chat/color'
import { profileThemeName } from './profileColors'
import type { ReactNode } from 'react'

/**
 * The reference's profile ThemeContext: the children draw in the theme the gradient picks, not the app's.
 * Without theme colours they keep the app's theme. Buttons draw from the colours' primary, as
 * useProfileThemedButtonStyles does.
 */
export function ProfileThemeScope({
    colors,
    children,
}: {
    colors: [number, number] | undefined
    children: ReactNode
}) {
    if (!colors) return children
    const name = profileThemeName(colors[0])
    return (
        <ScopedTheme name={name}>
            <ButtonThemeContext.Provider
                value={{
                    primaryColor: hexColor(colors[0]),
                    light: name === 'light',
                }}
            >
                {children}
            </ButtonThemeContext.Provider>
        </ScopedTheme>
    )
}
