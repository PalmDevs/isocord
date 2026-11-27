import { useEffect } from 'react'
import { logger } from '../../core/log'
import IsocordShare from '../../native/IsocordShare'
import type { SharedContent } from '../../native/IsocordShare'

const log = logger('Share')

/**
 * Hands each share from another app to `open`: the one the app was started with, then those that arrive.
 * A share waits natively until this is mounted, so one made before login opens after it.
 */
export function useSharedContent(open: (content: SharedContent) => void) {
    // biome-ignore lint/correctness/useExhaustiveDependencies: `open` is read when a share arrives
    useEffect(() => {
        const take = () =>
            void IsocordShare.takeShared()
                .then(json => {
                    if (json) open(JSON.parse(json) as SharedContent)
                })
                .catch(error => log.warn(`Reading a share failed: ${error}`))
        take()
        return IsocordShare.onShared(take)
    }, [])
}
