import { useEffect } from 'react'
import { logger } from '../../core/log'
import NativeShare from '../../native/NativeIsocordShare'
import type { SharedContent } from '../../native/NativeIsocordShare'

const log = logger('Share')

/**
 * Hands each share from another app to `open`: the one the app was started with, then those that arrive.
 * A share waits natively until this is mounted, so one made before login opens after it.
 */
export function useSharedContent(open: (content: SharedContent) => void) {
    // biome-ignore lint/correctness/useExhaustiveDependencies: `open` is read when a share arrives
    useEffect(() => {
        const take = () =>
            void NativeShare.takeShared()
                .then(json => {
                    if (json) open(JSON.parse(json) as SharedContent)
                })
                .catch(error => log.warn(`Reading a share failed: ${error}`))
        take()
        const subscription = NativeShare.onShared(take)
        return () => subscription.remove()
    }, [])
}
