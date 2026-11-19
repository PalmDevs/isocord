import native from '../native/NativeIsocordStartup'

let shown = false
const waiting: (() => void)[] = []

const afterFrames = (frames: number, callback: () => void) =>
    requestAnimationFrame(() =>
        frames > 1 ? afterFrames(frames - 1, callback) : callback(),
    )

/**
 * Dismisses the launch splash after the next frame, so the real UI is on screen underneath first.
 * Runs on every mount. A new activity in a surviving JS runtime shows a fresh splash.
 */
export function hideSplashAfterFrame(): void {
    afterFrames(2, () => {
        native.hideSplash()
        if (shown) return
        // A couple more frames so the first visible frame is drawn before deferred work starts.
        afterFrames(2, () => {
            shown = true
            for (const callback of waiting.splice(0)) callback()
        })
    })
}

/** Runs `callback` once the real UI has replaced the splash; returns a cancel function. */
export function afterSplash(callback: () => void): () => void {
    if (shown) {
        callback()
        return () => {}
    }
    waiting.push(callback)
    return () => {
        const index = waiting.indexOf(callback)
        if (index !== -1) waiting.splice(index, 1)
    }
}
