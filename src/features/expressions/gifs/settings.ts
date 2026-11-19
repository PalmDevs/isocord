import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { deviceStorage, readJson, writeJson } from '../../../core/storage'
import { GIF_PROVIDERS, GIF_QUALITIES } from './providers'
import type { GifProvider, GifQuality } from './providers'

/** The GIF picker's providers and quality, for the device (the gif-providers plugin's storage). */
export interface GifSettings {
    /** At least one, in GIF_PROVIDERS order. */
    providers: GifProvider[]
    quality: GifQuality
}

const STORAGE_KEY = 'gifPicker'

/** Klipy alone, as the reference: nothing goes to another service until the user picks it. */
const DEFAULTS: GifSettings = { providers: ['klipy'], quality: 'tinygif' }

function sanitize(saved: Partial<GifSettings> | undefined): GifSettings {
    const providers = GIF_PROVIDERS.filter(provider =>
        saved?.providers?.includes(provider),
    )
    const quality = GIF_QUALITIES.find(value => value === saved?.quality)
    return {
        providers: providers.length ? providers : DEFAULTS.providers,
        quality: quality ?? DEFAULTS.quality,
    }
}

export const gifSettingsStore = createStore<GifSettings>(() =>
    sanitize(readJson<Partial<GifSettings>>(deviceStorage, STORAGE_KEY)),
)

gifSettingsStore.subscribe(state =>
    writeJson(deviceStorage, STORAGE_KEY, state),
)

export const useGifSettings = <T>(selector: (state: GifSettings) => T): T =>
    useStore(gifSettingsStore, selector)

/** Turns a provider on or off; the last one stays on. */
export function toggleGifProvider(provider: GifProvider): void {
    const { providers } = gifSettingsStore.getState()
    const next = providers.includes(provider)
        ? providers.filter(value => value !== provider)
        : [...providers, provider]
    if (next.length)
        gifSettingsStore.setState(
            sanitize({ ...gifSettingsStore.getState(), providers: next }),
        )
}

export function setGifQuality(quality: GifQuality): void {
    gifSettingsStore.setState({ quality })
}
