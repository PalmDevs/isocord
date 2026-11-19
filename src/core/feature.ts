import { logger } from './log'
import type { ComponentType } from 'react'
import type { Session, StoreDefinition } from './session'

const log = logger('Features')

/**
 * The unit of extension. Built-in features and external plugins are declared
 * the same way and registered with `registerFeature` before the app renders.
 */
export interface Feature {
    name: string
    /** Session stores to create eagerly, before the gateway connects. */
    stores?: StoreDefinition<any>[]
    /** Runs once per session. Subscribe to gateway events here; return a cleanup. */
    setup?: (session: Session) => (() => void) | undefined
    /** Screens added to the root stack, by route name. */
    screens?: Record<string, ComponentType<any>>
    /** Components mounted above the navigator for the whole app lifetime (modals, toasts), by unique key. */
    overlays?: Record<string, ComponentType>
}

export const features: Feature[] = []

export function registerFeature(feature: Feature): void {
    const index = features.findIndex(existing => existing.name === feature.name)
    if (index === -1) {
        features.push(feature)
        log.debug(`Registered ${feature.name}`)
        return
    }
    // Fast Refresh re-runs the module that registers features; take the new definition.
    if (__DEV__) features[index] = feature
    else throw new Error(`Feature "${feature.name}" is already registered`)
}
