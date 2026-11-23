import { MEDIA_BASE } from '../../../core/constants'
import { GifFormat } from '../../../core/frecency'
import { useSessionStore } from '../../../core/react'
import { frecencyStore, updateFavoriteGifs } from '../../../stores/frecency'
import type { FavoriteGif, GifFormatValue } from '../../../core/frecency'
import type { Session } from '../../../core/session'
import type { FavoriteGifsResult } from '../../../stores/frecency'
import type { Gif } from './providers'

/** The favorite GIFs: shown, searched, added and removed (GIFPickerActionCreators, FavoriteGIFHooks). */

/** Favorites from this many on hide the picker's favorite tooltip (addFavoriteGIF). */
const TOOLTIP_HIDDEN_FROM = 3

const GIPHY_PAGE = /(https?:\/\/)(?!media(?:\d+)?\.)(?:[^.]+\.)*giphy\.com/
const TENOR_PAGE = /tenor\.com/
const GIPHY_ID = /-(?:.(?!-))+$/
const STILL_PROXY = /\.(webp|avif|gif)$/i

/**
 * What a favorite shows (transformFavoriteGifUrl): proxied media as animated WebP, Giphy and Tenor pages
 * as their GIF. Others keep their own `src`; a video one stays a placeholder.
 */
function favoriteSrc({ src, url }: FavoriteGif): string {
    if (src.startsWith(`${MEDIA_BASE}/external/`)) {
        const proxied = new URL(src)
        if (STILL_PROXY.test(proxied.pathname))
            proxied.searchParams.set('format', 'webp')
        proxied.searchParams.set('animated', 'true')
        return proxied.toString()
    }
    if (GIPHY_PAGE.test(url)) {
        const id = GIPHY_ID.exec(url)?.[0]?.slice(1)
        if (id) return `https://media.giphy.com/media/${id}/giphy.gif`
    }
    if (TENOR_PAGE.test(url)) return `${url}.gif`
    return src
}

/** The user's favorite GIFs, newest first (useSortedFavoriteGIFs), filtered by `query` (filterFavoriteGIFsByQuery). */
export function favoriteGifs(favorites: FavoriteGif[], query: string): Gif[] {
    const needle = query.toLowerCase().replace(/[-_ ]/g, '')
    return [...favorites]
        .sort((a, b) => b.order - a.order)
        .filter(gif =>
            gif.url.toLowerCase().replace(/[-_]/g, '').includes(needle),
        )
        .map(gif => ({
            id: `favorite:${gif.url}`,
            url: gif.url,
            src: favoriteSrc(gif),
            width: gif.width,
            height: gif.height,
        }))
}

/** Whether the link is a favorite (useIsFavoriteGIF). Links are used as is: provider links carry no signature. */
export const useIsFavoriteGif = (url: string): boolean =>
    useSessionStore(frecencyStore, state =>
        state.favoriteGifs.some(gif => gif.url === url),
    )

/**
 * Adds a GIF as the newest favorite (addFavoriteGIF). Picker GIFs are images, the default; the viewer's GIFVs are videos.
 */
export function addFavoriteGif(
    session: Session,
    gif: Gif,
    format: GifFormatValue = GifFormat.IMAGE,
): Promise<FavoriteGifsResult> {
    return updateFavoriteGifs(session, gifs => {
        const order = Math.max(0, ...gifs.map(favorite => favorite.order)) + 1
        const next = [
            ...gifs.filter(favorite => favorite.url !== gif.url),
            {
                url: gif.url,
                src: gif.src,
                format,
                width: Math.round(gif.width),
                height: Math.round(gif.height),
                order,
            },
        ]
        return { gifs: next, hideTooltip: next.length >= TOOLTIP_HIDDEN_FROM }
    })
}

/** Removes the favorite with this link (removeFavoriteGIF). */
export const removeFavoriteGif = (
    session: Session,
    url: string,
): Promise<FavoriteGifsResult> =>
    updateFavoriteGifs(session, gifs => ({
        gifs: gifs.filter(gif => gif.url !== url),
    }))
