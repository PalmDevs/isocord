import { useSyncExternalStore } from 'react'
import { MINUTE } from '../../core/time'

const listeners = new Set<() => void>()
let now = Date.now()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(listener: () => void) {
    listeners.add(listener)
    if (!timer) {
        now = Date.now()
        timer = setInterval(() => {
            now = Date.now()
            for (const l of listeners) l()
        }, MINUTE)
    }
    return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && timer) {
            clearInterval(timer)
            timer = undefined
        }
    }
}

/** Current time, refreshed once a minute while at least one component uses it. */
export function useMinute(): number {
    return useSyncExternalStore(subscribe, () => now)
}
