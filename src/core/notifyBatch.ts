import type { StoreApi } from 'zustand/vanilla'

type Listener = (state: unknown, prev: unknown) => void

/**
 * Holds UI store notifications during a gateway slice, then notifies each changed store once.
 * Flux Emitter `batched` and `pause`. Only listeners of a `view` wait. Direct `subscribe` stays synchronous.
 */
export class NotifyBatch {
    private depth = 0
    private paused = false
    private pauseTimer: ReturnType<typeof setTimeout> | undefined
    /** Changed stores and their state when the batch started. */
    private changed = new Map<StoreApi<unknown>, unknown>()
    private listeners = new Map<StoreApi<unknown>, Set<Listener>>()
    private views = new Map<StoreApi<unknown>, StoreApi<unknown>>()

    /** Returns a stable copy of `store` whose listeners wait for the end of a batch. */
    view<S>(store: StoreApi<S>): StoreApi<S> {
        const key = store as StoreApi<unknown>
        let view = this.views.get(key)
        if (!view) {
            const listeners = new Set<Listener>()
            this.listeners.set(key, listeners)
            store.subscribe((state, prev) => {
                if (this.depth > 0 || this.paused) {
                    if (!this.changed.has(key)) this.changed.set(key, prev)
                } else for (const listener of listeners) listener(state, prev)
            })
            view = {
                ...key,
                subscribe: listener => {
                    listeners.add(listener as Listener)
                    return () => listeners.delete(listener as Listener)
                },
            }
            this.views.set(key, view)
        }
        return view as StoreApi<S>
    }

    /** Runs `work` and notifies the stores it changed once it returns. */
    batched(work: () => void): void {
        this.depth++
        try {
            work()
        } finally {
            this.depth--
            this.flush()
        }
    }

    /** Holds notifications for `ms`. GatewaySocketDispatcher pauses the Emitter while resuming. */
    pause(ms: number): void {
        this.paused = true
        clearTimeout(this.pauseTimer)
        this.pauseTimer = setTimeout(() => {
            this.paused = false
            this.flush()
        }, ms)
    }

    dispose(): void {
        clearTimeout(this.pauseTimer)
        this.changed.clear()
    }

    private flush(): void {
        if (this.depth > 0 || this.paused || this.changed.size === 0) return
        const changed = [...this.changed]
        this.changed.clear()
        for (const [store, prev] of changed) {
            const state = store.getState()
            if (state === prev) continue
            for (const listener of this.listeners.get(store) ?? [])
                listener(state, prev)
        }
    }
}
