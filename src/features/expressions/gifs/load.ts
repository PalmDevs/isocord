import { logger } from '../../../core/log'
import {
    GIF_PROVIDER_NAMES,
    loadGifs,
    loadSuggestions,
    loadTrending,
    registerSelect,
} from './providers'
import { gifSettingsStore } from './settings'
import type { Session } from '../../../core/session'
import type {
    Gif,
    GifCategory,
    GifProvider,
    GifTrending,
    ProviderRequest,
} from './providers'

/*
 * The GIF picker's lists from every chosen provider at once (the gif-providers plugin's requests.ts).
 * Results are interleaved; a provider that fails or is slow is left out.
 */

const log = logger('Gifs')

/** GIFs a list asks for (the reference's search limit). */
export const GIF_LIMIT = 50
/** Suggestions shown under the results (fetchSuggestions). */
const SUGGESTION_LIMIT = 5
/** A provider that takes longer is left out of the list. */
const PROVIDER_TIMEOUT_MS = 10_000

function request(
    session: Session,
    query: string,
    limit: number,
    signal: AbortSignal,
): ProviderRequest {
    const { quality } = gifSettingsStore.getState()
    return { session, query, limit, quality, signal }
}

/** A signal aborted with `parent` or after `ms`; `done` clears the timer. */
function withTimeout(parent: AbortSignal | undefined, ms: number) {
    const controller = new AbortController()
    const abort = () => controller.abort()
    const timer = setTimeout(abort, ms)
    parent?.addEventListener('abort', abort)
    if (parent?.aborted) abort()
    const done = () => {
        clearTimeout(timer)
        parent?.removeEventListener('abort', abort)
    }
    return { signal: controller.signal, done }
}

/** Runs `work` for each chosen provider, with a timeout each; rejects only when none answered. */
async function fromEach<T>(
    signal: AbortSignal,
    what: string,
    work: (provider: GifProvider, signal: AbortSignal) => Promise<T>,
): Promise<T[]> {
    const { providers } = gifSettingsStore.getState()
    const results = await Promise.allSettled(
        providers.map(provider => {
            const own = withTimeout(signal, PROVIDER_TIMEOUT_MS)
            return work(provider, own.signal).finally(own.done)
        }),
    )
    const pages: T[] = []
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') pages.push(result.value)
        else if (!signal.aborted)
            log.warn(`${providers[index]} ${what} failed`, result.reason)
    })
    if (!pages.length && !signal.aborted)
        throw new Error(`No GIF provider answered ${what}`)
    return pages
}

/** Takes the pages' GIFs in turn (first of each, then second of each), without repeated links. */
function interleave(pages: Gif[][], limit: number): Gif[] {
    const result: Gif[] = []
    const seen = new Set<string>()
    const longest = Math.max(0, ...pages.map(page => page.length))
    for (let index = 0; index < longest && result.length < limit; index++) {
        for (const page of pages) {
            const gif = page[index]
            if (!gif || seen.has(gif.url)) continue
            seen.add(gif.url)
            result.push(gif)
        }
    }
    return result.slice(0, limit)
}

/** Search results, or the trending GIFs for an empty `query`. */
export async function fetchGifs(
    session: Session,
    query: string,
    signal: AbortSignal,
): Promise<Gif[]> {
    const trending = query === ''
    const pages = await fromEach(
        signal,
        trending ? 'trending GIFs' : 'search',
        (provider, own) =>
            loadGifs(
                provider,
                request(session, query, GIF_LIMIT, own),
                trending,
            ),
    )
    return interleave(pages, GIF_LIMIT)
}

/** The categories page: each provider's categories once by name, and the first Trending GIFs preview. */
export async function fetchTrending(
    session: Session,
    signal: AbortSignal,
): Promise<GifTrending> {
    const pages = await fromEach(signal, 'categories', (provider, own) =>
        loadTrending(provider, request(session, '', GIF_LIMIT, own)),
    )
    const categories = new Map<string, GifCategory>()
    for (const page of pages)
        for (const category of page.categories) {
            const key = category.name.toLowerCase()
            if (!categories.has(key)) categories.set(key, category)
        }
    return {
        categories: [...categories.values()],
        preview: pages.find(page => page.preview)?.preview,
    }
}

export async function fetchSuggestions(
    session: Session,
    query: string,
    signal: AbortSignal,
): Promise<string[]> {
    const pages = await fromEach(signal, 'suggestions', (provider, own) =>
        loadSuggestions(
            provider,
            request(session, query, SUGGESTION_LIMIT, own),
        ),
    )
    return [...new Set(pages.flat())].slice(0, SUGGESTION_LIMIT)
}

/** Tells the GIF's provider it was sent; failures are only logged. */
export function trackGifSelect(session: Session, gif: Gif, query: string) {
    const own = withTimeout(undefined, PROVIDER_TIMEOUT_MS)
    registerSelect(gif, request(session, query, 1, own.signal))
        .catch(error => log.warn(`${gif.provider} select failed`, error))
        .finally(own.done)
}

/** The search placeholder: "Search Klipy", or every chosen provider (GifProvider.getSearchPlaceholder). */
export const providerNames = (providers: GifProvider[]) =>
    providers.map(provider => GIF_PROVIDER_NAMES[provider]).join(', ')
