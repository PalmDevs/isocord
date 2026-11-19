import { create } from 'zustand'
import type { ReactNode } from 'react'

/**
 * Overlay an alert draws in. Sheets draw over `belowSheets` alerts, so a sheet opened from an alert
 * stays visible. `aboveSheets` alerts draw over open sheets.
 */
export type AlertLayer = 'belowSheets' | 'aboveSheets'

export interface AlertOptions {
    /** False pins the alert: backdrop taps, and back presses leave it open. */
    dismissable?: boolean
    /** Defaults to `belowSheets`. */
    layer?: AlertLayer
}

export interface AlertEntry extends AlertOptions {
    key: string
    node: ReactNode
    /** Runs once the alert has been removed, however it was closed. */
    onDismiss?: () => void
}

/** Open alerts, front-most first. Rendered by AlertHost. */
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
    const entry: AlertEntry = { key, node, onDismiss, ...options }
    useAlertStore.setState(({ alerts }) => {
        const index = alerts.findIndex(alert => alert.key === key)
        if (index === -1) return { alerts: [entry, ...alerts] }
        return {
            alerts: alerts.map((alert, i) => (i === index ? entry : alert)),
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

/** Returns whether the alert draws in `layer`. */
export function isInLayer(alert: AlertEntry, layer: AlertLayer): boolean {
    return (alert.layer ?? 'belowSheets') === layer
}

/**
 * Closes the front-most alert of `layer` unless it is pinned. Returns whether there was an alert to
 * handle.
 */
export function dismissTopAlert(layer: AlertLayer): boolean {
    const top = useAlertStore
        .getState()
        .alerts.find(alert => isInLayer(alert, layer))
    if (!top) return false
    if (top.dismissable !== false) dismissAlert(top.key)
    return true
}
