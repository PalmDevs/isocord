interface Throttled<Args extends unknown[]> {
    (...args: Args): void
    /** Runs a pending call now. */
    flush: () => void
    cancel: () => void
}

/** Leading and trailing throttle: the first call runs at once, later ones within `ms` run once at its end. */
export function throttle<Args extends unknown[]>(
    fn: (...args: Args) => void,
    ms: number,
): Throttled<Args> {
    let last = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: Args | undefined
    const run = () => {
        timer = undefined
        if (!pending) return
        const args = pending
        pending = undefined
        last = Date.now()
        fn(...args)
    }
    const throttled = ((...args: Args) => {
        pending = args
        const wait = last + ms - Date.now()
        if (wait <= 0) {
            clearTimeout(timer)
            run()
        } else timer ??= setTimeout(run, wait)
    }) as Throttled<Args>
    throttled.flush = () => {
        clearTimeout(timer)
        run()
    }
    throttled.cancel = () => {
        clearTimeout(timer)
        timer = undefined
        pending = undefined
    }
    return throttled
}
