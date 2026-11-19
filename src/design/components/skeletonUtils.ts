import { createContext } from 'react'

/**
 * True where skeletons are mounted but not on screen, such as a tab page that is not selected: their pulses stop.
 * Each pulse animates its view on every frame until it unmounts, wherever it is.
 */
export const SkeletonPausedContext = createContext(false)

/** Deterministic width in [min, max] percent for row `index`, the reference's sin hash. */
export function skeletonWidth(index: number, min: number, max: number) {
    const x = 10000 * Math.sin(index)
    return `${min + (max - min) * (x - Math.floor(x))}%` as const
}

/** Stable keys for `count` placeholder rows. */
export function skeletonKeys(count: number) {
    return Array.from({ length: count }, (_, index) => `skeleton-${index}`)
}
