import { createContext, useContext, useEffect } from 'react'
import { ScopedTheme } from 'react-native-unistyles'
import { create } from 'zustand'
import { ButtonThemeContext } from '../buttons/buttonTheme'
import type { ReactNode } from 'react'
import type { UnistylesThemes } from 'react-native-unistyles'
import type { ButtonTheme } from '../buttons/buttonTheme'

export type ThemeName = keyof UnistylesThemes

export interface ScopedThemeEntry {
    theme?: ThemeName
    buttonTheme?: ButtonTheme
}

interface ScopedThemeState {
    stack: ScopedThemeEntry[]
}

const ScopedThemeNameContext = createContext<ThemeName | undefined>(undefined)

export const useScopedThemeStore = create<ScopedThemeState>(() => ({
    stack: [],
}))

/** Returns the nearest React-tree scoped theme, if any. */
export function useScopedTheme(): ThemeName | undefined {
    return useContext(ScopedThemeNameContext)
}

/** Returns the active overlay scoped theme, if any. */
export function getScopedTheme(): ThemeName | undefined {
    return useScopedThemeStore.getState().stack.at(-1)?.theme
}

/** Returns the active overlay button theme, if any. */
export function getScopedButtonTheme(): ButtonTheme | undefined {
    return useScopedThemeStore.getState().stack.at(-1)?.buttonTheme
}

/** Resolves a theme option, where `null` keeps the app theme. */
export function resolveScopedTheme(
    theme?: ThemeName | null,
    fallback?: ThemeName | null,
): ThemeName | undefined {
    if (theme === null) return undefined
    return theme ?? fallback ?? getScopedTheme()
}

/** Resolves a button theme option, where `null` keeps the app theme. */
export function resolveScopedButtonTheme(
    buttonTheme?: ButtonTheme | null,
    fallback?: ButtonTheme | null,
): ButtonTheme | undefined {
    if (buttonTheme === null) return undefined
    return buttonTheme ?? fallback ?? getScopedButtonTheme()
}

/** Pushes a scoped theme and returns its cleanup callback. */
export function pushScopedTheme(
    theme?: ThemeName,
    buttonTheme?: ButtonTheme,
): () => void {
    const entry: ScopedThemeEntry = { theme, buttonTheme }
    useScopedThemeStore.setState(state => ({ stack: [...state.stack, entry] }))
    return () => {
        useScopedThemeStore.setState(state => {
            const index = state.stack.lastIndexOf(entry)
            if (index === -1) return state
            const next = [...state.stack]
            next.splice(index, 1)
            return { stack: next }
        })
    }
}

/** Applies a scoped theme and optionally tracks it for overlays. */
export function ScopedThemeScope({
    name,
    buttonTheme,
    active = true,
    children,
}: {
    name?: ThemeName | null
    buttonTheme?: ButtonTheme | null
    /** Whether overlays inherit this scope. */
    active?: boolean
    children: ReactNode
}) {
    const resolvedName = name ?? undefined
    const resolvedButtonTheme = buttonTheme ?? undefined

    useEffect(() => {
        if (!active || (!resolvedName && !resolvedButtonTheme)) return
        return pushScopedTheme(resolvedName, resolvedButtonTheme)
    }, [active, resolvedName, resolvedButtonTheme])

    let content = children
    if (buttonTheme !== undefined) {
        content = (
            <ButtonThemeContext.Provider value={resolvedButtonTheme}>
                {content}
            </ButtonThemeContext.Provider>
        )
    }
    if (!resolvedName) return content
    return (
        <ScopedThemeNameContext.Provider value={resolvedName}>
            <ScopedTheme name={resolvedName}>{content}</ScopedTheme>
        </ScopedThemeNameContext.Provider>
    )
}
