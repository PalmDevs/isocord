import { Endpoint } from '../../../core/api/paths'
import type { Session } from '../../../core/session'

/*
 * The GIF providers (reference: GIFPickerActionCreators for Klipy, the gif-providers plugin's providers.ts for
 * Tenor and Giphy). Klipy is Discord's own, behind `/gifs`. Tenor and Giphy are asked directly.
 */

export const GIF_PROVIDERS = ['klipy', 'tenor', 'giphy'] as const
export type GifProvider = (typeof GIF_PROVIDERS)[number]

/** Brand names, not translated (GifProvider.GIF_PROVIDER_EMBED_NAME). */
export const GIF_PROVIDER_NAMES: Record<GifProvider, string> = {
    klipy: 'Klipy',
    tenor: 'Tenor',
    giphy: 'GIPHY',
}

/** Tenor's renditions, largest first: `gif`, `tinygif`, `nanogif`. */
export const GIF_QUALITIES = ['gif', 'tinygif', 'nanogif'] as const
export type GifQuality = (typeof GIF_QUALITIES)[number]

/** Giphy's rendition for each quality. */
const GIPHY_RENDITIONS: Record<GifQuality, string> = {
    gif: 'original',
    tinygif: 'fixed_width',
    nanogif: 'fixed_width_small',
}

/** Klipy's media format (GIFPickerViewStore.getSelectedFormat). */
const KLIPY_FORMAT = 'tinywebp'

const TENOR_API = 'https://api.tenor.com/v1/'
const GIPHY_API = 'https://api.giphy.com/v1/'
/** Tenor's public web key, the plugin's. */
const TENOR_KEY = '3Z0688EVWYKH'
/** The public key giphy.com uses. */
const GIPHY_KEY = 'Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g'
/** Giphy pages by offset, at most this many a request. */
const GIPHY_PAGE = 50
/** Pages asked of one provider for one list. */
const MAX_PAGES = 5

/**
 * A GIF of any provider, or a favorite (no provider). `id` is prefixed with its source; `url` is what is sent;
 * `src` is shown.
 */
export interface Gif {
    id: string
    provider?: GifProvider
    url: string
    src: string
    width: number
    height: number
}

export interface GifCategory {
    name: string
    src: string
}

/** `/gifs/trending`: the categories and a GIF for the Trending GIFs tile. */
export interface GifTrending {
    categories: GifCategory[]
    preview?: string
}

export interface ProviderRequest {
    session: Session
    query: string
    limit: number
    quality: GifQuality
    signal: AbortSignal
}

type Json = Record<string, unknown>

const record = (value: unknown): Json =>
    value && typeof value === 'object' ? (value as Json) : {}
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const text = (value: unknown): string =>
    typeof value === 'string' ? value : ''

const locale = (session: Session) => session.rest.identity.locale

async function external(
    provider: 'tenor' | 'giphy',
    { session, signal }: ProviderRequest,
    path: string,
    params: Record<string, string> = {},
): Promise<Json> {
    const language = locale(session).toLowerCase()
    const query: Record<string, string> =
        provider === 'tenor'
            ? { key: TENOR_KEY, locale: language.replace('-', '_') }
            : {
                  api_key: GIPHY_KEY,
                  lang: language.startsWith('zh')
                      ? language.includes('tw')
                          ? 'zh-TW'
                          : 'zh-CN'
                      : (language.split('-')[0] ?? language),
              }
    const base = provider === 'tenor' ? TENOR_API : GIPHY_API
    const response = await fetch(
        `${base}${path}?${new URLSearchParams({ ...query, ...params })}`,
        { signal },
    )
    if (!response.ok)
        throw new Error(`${provider} ${path} failed (${response.status})`)
    return record(await response.json())
}

function size(width: unknown, height: unknown) {
    const w = Number(width)
    const h = Number(height)
    return w > 0 && h > 0 ? { width: w, height: h } : undefined
}

/** A Tenor result at the quality's rendition. */
function tenorGif(value: unknown, quality: GifQuality): Gif | undefined {
    const item = record(value)
    const media = record(list(item.media)[0])
    const format = record(media[quality] ?? media.tinygif ?? media.gif)
    const dims = list(format.dims)
    const box = size(dims[0], dims[1])
    const id = text(item.id)
    const url = text(item.itemurl)
    const src = text(format.url)
    if (!id || !url || !src || !box) return undefined
    return { id: `tenor:${id}`, provider: 'tenor', url, src, ...box }
}

/** A Giphy result at the quality's rendition, as animated WebP when Giphy has it (a fraction of the GIF). */
function giphyGif(value: unknown, quality: GifQuality): Gif | undefined {
    const item = record(value)
    const images = record(item.images)
    const format = record(images[GIPHY_RENDITIONS[quality]] ?? images.original)
    const box = size(format.width, format.height)
    const id = text(item.id)
    const url = text(item.url)
    const src = text(format.webp) || text(format.url)
    if (!id || !url || !src || !box) return undefined
    return { id: `giphy:${id}`, provider: 'giphy', url, src, ...box }
}

/** A Klipy result (`/gifs/search`). */
function klipyGif(value: unknown): Gif | undefined {
    const item = record(value)
    const box = size(item.width, item.height)
    const id = text(item.id)
    const url = text(item.url)
    const src = text(item.src)
    if (!id || !url || !src || !box) return undefined
    return { id: `klipy:${id}`, provider: 'klipy', url, src, ...box }
}

const defined = <T>(value: T | undefined): value is T => value !== undefined

/** Search results, or the trending GIFs when `trending`. */
export async function loadGifs(
    provider: GifProvider,
    request: ProviderRequest,
    trending: boolean,
): Promise<Gif[]> {
    const { session, query, limit, quality, signal } = request
    if (provider === 'klipy') {
        const body = await session.rest.get<unknown>(
            trending ? Endpoint.gifsTrendingGifs : Endpoint.gifsSearch,
            {
                query: {
                    q: trending ? undefined : query,
                    media_format: KLIPY_FORMAT,
                    locale: locale(session),
                    limit,
                },
                signal,
            },
        )
        return list(body).map(klipyGif).filter(defined)
    }
    const gifs = new Map<string, Gif>()
    let cursor = ''
    for (let page = 0; page < MAX_PAGES && gifs.size < limit; page++) {
        const params: Record<string, string> = {
            limit: String(Math.min(GIPHY_PAGE, limit - gifs.size)),
        }
        if (!trending) params.q = query
        if (provider === 'tenor' && cursor) params.pos = cursor
        if (provider === 'giphy') params.offset = String(page * GIPHY_PAGE)
        const endpoint = trending ? 'trending' : 'search'
        const body = await external(
            provider,
            request,
            provider === 'tenor' ? endpoint : `gifs/${endpoint}`,
            params,
        )
        const results = list(provider === 'tenor' ? body.results : body.data)
        for (const value of results) {
            const gif =
                provider === 'tenor'
                    ? tenorGif(value, quality)
                    : giphyGif(value, quality)
            if (gif) gifs.set(gif.id, gif)
        }
        if (!results.length) break
        if (provider === 'giphy' && results.length < Number(params.limit)) break
        if (provider === 'tenor') {
            const next = text(body.next)
            if (!next || next === cursor || next === '0') break
            cursor = next
        }
    }
    return [...gifs.values()].slice(0, limit)
}

/** The categories page: Klipy's `/gifs/trending`, Tenor's featured categories, Giphy's categories. */
export async function loadTrending(
    provider: GifProvider,
    request: ProviderRequest,
): Promise<GifTrending> {
    const { session, signal, quality } = request
    if (provider === 'klipy') {
        const body = record(
            await session.rest.get<unknown>(Endpoint.gifsTrending, {
                query: { media_format: KLIPY_FORMAT, locale: locale(session) },
                signal,
            }),
        )
        return {
            categories: list(body.categories).flatMap(value => {
                const item = record(value)
                const name = text(item.name)
                const src = text(item.src)
                return name && src ? [{ name, src }] : []
            }),
            preview: text(record(list(body.gifs)[0]).src) || undefined,
        }
    }
    const tenor = provider === 'tenor'
    const [categories, preview] = await Promise.allSettled([
        external(
            provider,
            request,
            tenor ? 'categories' : 'gifs/categories',
            tenor ? { type: 'featured' } : {},
        ),
        loadGifs(provider, { ...request, limit: 1 }, true),
    ])
    if (categories.status === 'rejected' && preview.status === 'rejected')
        throw categories.reason
    const items =
        categories.status === 'fulfilled'
            ? list(tenor ? categories.value.tags : categories.value.data)
            : []
    return {
        categories: items.flatMap(value => {
            const item = record(value)
            const name = text(tenor ? item.searchterm : item.name)
            const src = tenor
                ? text(item.image)
                : giphyGif(item.gif, quality)?.src
            return name && src ? [{ name, src }] : []
        }),
        preview:
            preview.status === 'fulfilled' ? preview.value[0]?.src : undefined,
    }
}

/** Search suggestions for a query (`/gifs/suggest`). */
export async function loadSuggestions(
    provider: GifProvider,
    request: ProviderRequest,
): Promise<string[]> {
    const { session, query, limit, signal } = request
    if (provider === 'klipy') {
        const body = await session.rest.get<unknown>(Endpoint.gifsSuggest, {
            query: { q: query, limit, locale: locale(session) },
            signal,
        })
        return list(body).map(text).filter(Boolean)
    }
    const tenor = provider === 'tenor'
    const body = await external(
        provider,
        request,
        tenor ? 'search_suggestions' : 'gifs/search/tags',
        { q: query, limit: String(limit) },
    )
    return list(tenor ? body.results : body.data)
        .map(value =>
            typeof value === 'string' ? value : text(record(value).name),
        )
        .filter(Boolean)
}

/** Tells the provider a GIF was sent (GIFPickerActionCreators.trackSelectGIF, Tenor's registershare). */
export async function registerSelect(
    gif: Gif,
    request: ProviderRequest,
): Promise<void> {
    if (!gif.provider) return
    const id = gif.id.slice(gif.provider.length + 1)
    if (gif.provider === 'klipy')
        await request.session.rest.post(Endpoint.gifsSelect, {
            body: { id, q: request.query },
        })
    else if (gif.provider === 'tenor')
        await external('tenor', request, 'registershare', {
            id,
            q: request.query,
        })
}
