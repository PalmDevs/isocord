import { useState } from 'react'

export interface DockMode {
    /** The dock shows as the PIP. */
    minimized: boolean
    /** The user minimized it by hand: it stays the PIP over the tab bar too. */
    userMinimized: boolean
    /** A fast swipe down on the docked card. */
    minimize: () => void
    /** A tap on the PIP over the tab bar. */
    restore: () => void
}

/**
 * Returns whether the dock shows as the card or the PIP. It is the PIP while `auto` (no tab bar to dock on), and
 * after the user minimizes it by hand. A manual minimize holds until the PIP is tapped on the tabs, or the call ends.
 */
export function useDockMode(auto: boolean): DockMode {
    const [userMinimized, setUserMinimized] = useState(false)
    return {
        minimized: auto || userMinimized,
        userMinimized,
        minimize: () => setUserMinimized(true),
        restore: () => setUserMinimized(false),
    }
}
