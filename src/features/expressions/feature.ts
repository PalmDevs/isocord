import { AppState } from 'react-native'
import { flushFrecency, frecencyStore } from '../../stores/frecency'
import { stickerPacksStore } from '../../stores/stickerPacks'
import type { Feature } from '../../core/feature'

// Saving the usage, on the reference's schedule (FrecencyUserSettingsManager): 10 to 20 s after the
// connection opens, then every 2 hours plus up to 10 minutes, and at once when the app leaves the
// foreground or the connection closes.
const FIRST_SAVE_MS = 10_000
const SAVE_INTERVAL_MS = 2 * 60 * 60 * 1000

export const expressionsFeature: Feature = {
    name: 'expressions',
    stores: [frecencyStore, stickerPacksStore],
    setup(session) {
        let timer: ReturnType<typeof setTimeout> | undefined
        const schedule = (delay: number) => {
            clearTimeout(timer)
            timer = setTimeout(() => {
                flushFrecency(session).finally(() =>
                    schedule(SAVE_INTERVAL_MS + Math.random() * 10 * 60 * 1000),
                )
            }, delay)
        }
        const flushNow = () => {
            clearTimeout(timer)
            flushFrecency(session).finally(() =>
                schedule(SAVE_INTERVAL_MS + Math.random() * 10 * 60 * 1000),
            )
        }
        const offReady = session.gateway.dispatch.on('READY', () =>
            schedule(FIRST_SAVE_MS + Math.random() * 10_000),
        )
        const offState = session.gateway.events.on('state', state => {
            if (state === 'disconnected') flushNow()
        })
        const appState = AppState.addEventListener('change', state => {
            if (state !== 'active') flushNow()
        })
        return () => {
            clearTimeout(timer)
            offReady()
            offState()
            appState.remove()
        }
    },
}
