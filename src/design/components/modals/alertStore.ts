import { create } from 'zustand'
import { nextModalOrder } from '../overlays/modalOrder'
import type { ReactNode } from 'react'

export interface AlertOptions {
    /** False pins the alert: backdrop taps, and back presses leave it open. */
    dismissable?: boolean
}

export interface AlertEntry extends AlertOptions {
    key: string
    node: ReactNode
    /** Place among open alerts and sheets, from `nextModalOrder`. */
    order: number
    /** Runs once the alert has been removed, however it was closed. */
    onDismiss?: () => void
}

/** Open alerts, front-most first. Rendered by ModalStack. */
export const useAlertStore = create<{ alerts: AlertEntry[] }>(() => ({
    alerts: [],
}))

/**
 * Shows `node` (normally an AlertModal) as an alert. Opening a key that is already open replaces it
 * in place; a new key goes in front of the others.
 */
export function openAlert(
    key: string,
    node: ReactNode,
    onDismiss?: () => void,
    options?: AlertOptions,
): void {
    useAlertStore.setState(({ alerts }) => {
        const existing = alerts.find(alert => alert.key === key)
        const entry: AlertEntry = {
            key,
            node,
            onDismiss,
            order: existing?.order ?? nextModalOrder(),
            ...options,
        }
        if (!existing) return { alerts: [entry, ...alerts] }
        return {
            alerts: alerts.map(alert => (alert === existing ? entry : alert)),
        }
    })
}

/** Closes the alert with this key and runs its `onDismiss`. Does nothing if it is not open. */
export function dismissAlert(key: string): void {
    const found = useAlertStore
        .getState()
        .alerts.find(alert => alert.key === key)
    if (!found) return
    useAlertStore.setState(({ alerts }) => ({
        alerts: alerts.filter(alert => alert.key !== key),
    }))
    found.onDismiss?.()
}

/** Closes the front-most alert unless it is pinned. Returns whether there was an alert to handle. */
export function dismissTopAlert(): boolean {
    const top = useAlertStore.getState().alerts[0]
    if (!top) return false
    if (top.dismissable !== false) dismissAlert(top.key)
    return true
}
