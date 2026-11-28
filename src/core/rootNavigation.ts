import type { NavigationContainerRef } from '@react-navigation/native'

type RootNavigation = NavigationContainerRef<Record<string, object | undefined>>

/** The root stack's container, set by App. Overlays live outside it, so they navigate through this. */
let current: RootNavigation | null = null

/**
 * Sets the root navigation container. Returns the function that unsets it. A recreated activity mounts its new App
 * before the old one unmounts, so the unset only clears its own container.
 */
export function setRootNavigation(navigation: RootNavigation): () => void {
    current = navigation
    return () => {
        if (current === navigation) current = null
    }
}

/** Opens a root stack screen from outside the navigator. Does nothing before the container is ready. */
export function navigateRoot(screen: string, params?: object): void {
    if (current?.isReady()) current.navigate(screen, params)
}
