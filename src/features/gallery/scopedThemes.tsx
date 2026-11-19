import { ScrollView, View } from 'react-native'
import { ScopedTheme, StyleSheet } from 'react-native-unistyles'
import { create } from 'zustand'
import { Button } from '../../design/components/buttons/Button'
import { profileBackground } from '../userProfile/profileColors'
import { ProfileThemeScope } from '../userProfile/profileTheme'
import type { ReactNode } from 'react'

type BaseTheme = 'dark' | 'darker' | 'midnight' | 'light'

interface ScopedExample {
    id: string
    label: string
    /** A base theme the page draws in, whatever the app's. */
    theme?: BaseTheme
    /** Nitro theme colours: the gradient behind the page, and the theme it picks (profileThemeName). */
    colors?: [number, number]
}

/** The example scopes: each base theme, then gradients over a dark and a light primary colour. */
const EXAMPLES: ScopedExample[] = [
    { id: 'light', label: 'Light', theme: 'light' },
    { id: 'dark', label: 'Ash', theme: 'dark' },
    { id: 'darker', label: 'Dark', theme: 'darker' },
    { id: 'midnight', label: 'Onyx', theme: 'midnight' },
    {
        id: 'gradient-dark',
        label: 'Dark gradient',
        colors: [0x1f2a6b, 0x7a3fb0],
    },
    {
        id: 'gradient-light',
        label: 'Light gradient',
        colors: [0xf7c6d9, 0xc9d8ff],
    },
]

/** The example picked, undefined for the app's own theme. Kept across pages. */
const useScopedExample = create<{
    id: string | undefined
    pick: (id: string | undefined) => void
}>(set => ({ id: undefined, pick: id => set({ id }) }))

/** A scope picker above the page: off, or one of the examples. Draws in the app's theme. */
export function ScopedThemePicker() {
    const { id, pick } = useScopedExample()
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickerScroll}
            contentContainerStyle={styles.picker}
        >
            <Button
                size="sm"
                text="App theme"
                variant={id === undefined ? 'primary' : 'secondary'}
                onPress={() => pick(undefined)}
            />
            {EXAMPLES.map(example => (
                <Button
                    key={example.id}
                    size="sm"
                    text={example.label}
                    variant={id === example.id ? 'primary' : 'secondary'}
                    onPress={() => pick(example.id)}
                />
            ))}
        </ScrollView>
    )
}

/**
 * Draws the page inside the picked example's scope, over its gradient when it has one. Sheets, alerts and menus
 * open outside it, so they keep the app's theme.
 */
export function ScopedThemeExample({ children }: { children: ReactNode }) {
    const id = useScopedExample(state => state.id)
    const example = EXAMPLES.find(item => item.id === id)
    if (!example) return <View style={styles.page}>{children}</View>
    if (example.colors)
        return (
            <View style={[styles.page, profileBackground(example.colors)]}>
                <ProfileThemeScope colors={example.colors}>
                    {children}
                </ProfileThemeScope>
            </View>
        )
    return (
        <ScopedTheme name={example.theme!}>
            <View style={styles.themed}>{children}</View>
        </ScopedTheme>
    )
}

const styles = StyleSheet.create(theme => ({
    picker: {
        gap: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_16,
        paddingVertical: theme.space.PX_8,
    },
    // A ScrollView grows to fill its column by default.
    pickerScroll: { flexGrow: 0 },
    page: { flex: 1 },
    themed: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
}))
