import { create } from 'zustand'
import { nextToastOrder } from './modalOrder'
import { resolveScopedButtonTheme, resolveScopedTheme } from './scopedTheme'
import type { UnistylesThemes } from 'react-native-unistyles'
import type { IconName } from '../../icons/Icon'
import type { SemanticColor } from '../../tokens'
import type { ButtonTheme } from '../buttons/buttonTheme'

/** ToastVariant in the reference: the border/background tint and the default icon. */
export type ToastVariant = 'default' | 'success' | 'critical'

export interface ToastOptions {
    /**
     * Identifies the toast. Showing a key that is already visible or queued updates that toast in
     * place and restarts its timer instead of adding another. Generated when omitted.
     */
    key?: string
    /** The text (the reference's `text`). */
    content: string
    variant?: ToastVariant
    /** Leading icon. Success and critical have their own, which this overrides. */
    icon?: IconName
    iconColor?: SemanticColor
    secondaryIconColor?: SemanticColor
    /** Leading image (the reference's image ToastEntity, 24x24). Wins over `icon`. */
    iconUrl?: string
    /** Milliseconds before the toast leaves, counted while it is in front. 0 keeps it until dismissed. */
    duration?: number
    /** Theme override, or `null` to keep the app theme. */
    theme?: keyof UnistylesThemes | null
    /** Button theme override, or `null` to keep the app theme. */
    buttonTheme?: ButtonTheme | null
}

export interface ToastEntry extends ToastOptions {
    key: string
    /** Place among open overlays, from `nextToastOrder`. */
    order: number
    /** Bumped each time the key is shown again, so the host restarts the timer and re-announces. */
    revision: number
}

/** The default auto-dismiss time in the reference's toast container. */
export const DEFAULT_TOAST_DURATION = 3000
/** At most this many toasts are drawn, as a pile; the rest wait in the queue. */
export const MAX_VISIBLE_TOASTS = 3

/** Every toast in arrival order. The first MAX_VISIBLE_TOASTS are on screen, the rest are queued. */
export const useToastStore = create<{ toasts: ToastEntry[] }>(() => ({
    toasts: [],
}))

let counter = 0

/**
 * Shows a toast and returns its key (pass it to `hideToast`). A key that is already visible or
 * queued is updated where it is: new content/icon, and the timer starts over.
 */
export function showToast(options: ToastOptions): string {
    const key = options.key ?? `toast-${++counter}`
    const order = nextToastOrder()
    const theme = resolveScopedTheme(options.theme)
    const buttonTheme = resolveScopedButtonTheme(options.buttonTheme)
    useToastStore.setState(({ toasts }) => {
        const index = toasts.findIndex(toast => toast.key === key)
        if (index === -1)
            return {
                toasts: [
                    ...toasts,
                    { ...options, key, revision: 0, order, theme, buttonTheme },
                ],
            }
        return {
            toasts: toasts.map((toast, i) =>
                i === index
                    ? {
                          ...options,
                          key,
                          revision: toast.revision + 1,
                          order,
                          theme:
                              options.theme === undefined ? toast.theme : theme,
                          buttonTheme:
                              options.buttonTheme === undefined
                                  ? toast.buttonTheme
                                  : buttonTheme,
                      }
                    : toast,
            ),
        }
    })
    return key
}

/** Removes the toast with this key, visible or queued. Does nothing if there is none. */
export function hideToast(key: string): void {
    useToastStore.setState(({ toasts }) => {
        if (!toasts.some(toast => toast.key === key)) return { toasts }
        return { toasts: toasts.filter(toast => toast.key !== key) }
    })
}
