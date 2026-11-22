import { useMemo } from 'react'
import { ScopedThemeScope } from '../../design/components/overlays/scopedTheme'
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
    active = false,
    children,
}: {
    colors: [number, number] | undefined
    /** Whether overlays inherit this profile's theme. */
    active?: boolean
    children: ReactNode
}) {
    const primary = colors?.[0]
    const name =
        primary !== undefined && profileThemeName(primary) === 'dark'
            ? 'darker'
            : 'light'
    // Stable reference so ScopedThemeScope's effect does not re-run each render.
    const buttonTheme = useMemo(
        () =>
            primary !== undefined
                ? {
                      primaryColor: hexColor(primary),
                      light: name === 'light',
                  }
                : undefined,
        [primary, name],
    )
    if (!colors) {
        return (
            <ScopedThemeScope buttonTheme={null} active={false}>
                {children}
            </ScopedThemeScope>
        )
    }
    return (
        <ScopedThemeScope name={name} buttonTheme={buttonTheme} active={active}>
            {children}
        </ScopedThemeScope>
    )
}
