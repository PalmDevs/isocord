import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { SearchField } from '../../../design/components/inputs/SearchField'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { gifGrid } from '../../../native/NativeIsocordConstants'
import { frecencyStore } from '../../../stores/frecency'
import { toast } from '../../chat/composer/toast'
import { favoriteGifs } from '../gifs/favorites'
import { fetchGifs, fetchTrending, providerNames } from '../gifs/load'
import { GIF_PROVIDER_NAMES } from '../gifs/providers'
import { useGifSettings } from '../gifs/settings'
import { GifGrid } from './GifGrid'
import { openGifProviders } from './gifProvidersSheet'
import type { FavoriteGif } from '../../../core/frecency'
import type { Session } from '../../../core/session'
import type { Gif, GifTrending } from '../gifs/providers'
import type { GifTile } from './GifGrid'

/** The GIF tab's page: the categories or search results, Trending GIFs, or Favorites (GIFPickerResultTypes). */
export type GifView = 'search' | 'trending' | 'favorites'

/** Typing settles this long before a search (GIFPickerActionCreators.search's debounce). */
const SEARCH_DEBOUNCE_MS = 250

/** Placeholder tiles while a list loads, at the reference's random heights made fixed (GIFPickerResultsList). */
const LOADING_TILES: GifTile[] = Array.from({ length: 20 }, (_, index) => ({
    key: `loading:${index}`,
    src: '',
    width: 100,
    height: 90 + ((index * 37) % 91),
    label: '',
}))

interface GifHeaderProps {
    view: GifView
    query: string
    onQueryChange: (query: string) => void
    favoritesQuery: string
    onFavoritesQueryChange: (query: string) => void
    onBack: () => void
    onFocus: () => void
    onBlur: () => void
}

/**
 * The GIF tab's header (GIFPickerHeader): the search field and the providers button, or, on Trending GIFs and
 * Favorites, a back button and the page's name. Back leaves the Favorites search before the page.
 */
export function GifHeader({
    view,
    query,
    onQueryChange,
    favoritesQuery,
    onFavoritesQueryChange,
    onBack,
    onFocus,
    onBlur,
}: GifHeaderProps) {
    const providers = useGifSettings(state => state.providers)
    const [searching, setSearching] = useState(false)
    // The search header's height as laid out (the field is taller than InputHeights on Android): the other
    // headers keep it, so neither the grid nor the back button moves when a search field comes and goes.
    const [searchHeight, setSearchHeight] = useState<number>()
    const back = () => {
        if (view === 'favorites' && searching) {
            // The field goes away focused, so its blur never arrives.
            onBlur()
            onFavoritesQueryChange('')
            setSearching(false)
        } else onBack()
    }
    if (view !== 'search')
        return (
            <View style={[styles.header, { minHeight: searchHeight }]}>
                <IconButton
                    icon="ChevronLargeLeftIcon"
                    variant="icon-only"
                    size="md"
                    accessibilityLabel={t('common.back')}
                    onPress={back}
                />
                {view === 'favorites' ? (
                    <FavoritesSearch
                        searching={searching}
                        onSearchingChange={setSearching}
                        query={favoritesQuery}
                        onQueryChange={onFavoritesQueryChange}
                        onFocus={onFocus}
                        onBlur={onBlur}
                    />
                ) : (
                    <Text
                        variant="text-md/semibold"
                        lineClamp={1}
                        style={styles.title}
                    >
                        {t('expressions.trendingGifs')}
                    </Text>
                )}
            </View>
        )
    return (
        <View
            style={styles.header}
            onLayout={event => setSearchHeight(event.nativeEvent.layout.height)}
        >
            <View style={styles.title}>
                <SearchField
                    size="md"
                    value={query}
                    onChangeText={onQueryChange}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder={t('expressions.searchGifs', {
                        providers: providerNames(providers),
                    })}
                />
            </View>
            <IconButton
                icon="FiltersHorizontalIcon"
                variant="secondary"
                size="md"
                accessibilityLabel={t('expressions.gifProviders')}
                onPress={openGifProviders}
            />
        </View>
    )
}

interface FavoritesSearchProps {
    searching: boolean
    onSearchingChange: (searching: boolean) => void
    query: string
    onQueryChange: (query: string) => void
    onFocus: () => void
    onBlur: () => void
}

/**
 * The Favorites title with a search button that turns into a search field (GIFPickerHeader's favorites search).
 * An empty field turns back into the title when it loses focus.
 */
function FavoritesSearch({
    searching,
    onSearchingChange,
    query,
    onQueryChange,
    onFocus,
    onBlur,
}: FavoritesSearchProps) {
    if (searching)
        return (
            <View style={styles.title}>
                <SearchField
                    size="md"
                    autoFocus
                    value={query}
                    onChangeText={onQueryChange}
                    onFocus={onFocus}
                    onBlur={() => {
                        onBlur()
                        if (query === '') onSearchingChange(false)
                    }}
                    placeholder={t('expressions.searchFavorites')}
                />
            </View>
        )
    return (
        <>
            <Text variant="text-md/semibold" lineClamp={1} style={styles.title}>
                {t('expressions.favorites')}
            </Text>
            <IconButton
                icon="MagnifyingGlassIcon"
                variant="icon-only"
                size="md"
                accessibilityLabel={t('expressions.searchFavorites')}
                onPress={() => onSearchingChange(true)}
            />
        </>
    )
}

export interface GifPickerProps {
    view: GifView
    query: string
    favoritesQuery: string
    /** A category was tapped: its name is searched. */
    onSearch: (query: string) => void
    onView: (view: GifView) => void
    onSelect: (gif: Gif) => void
    /** A GIF was held. */
    onHold: (gif: Gif) => void
}

/** The GIF tab's grid: categories, results, Trending GIFs or Favorites (GIFPicker). */
export function GifPicker({
    view,
    query,
    favoritesQuery,
    onSearch,
    onView,
    onSelect,
    onHold,
}: GifPickerProps) {
    const session = useSession()
    const { bottom } = useSafeAreaInsets()
    const providers = useGifSettings(state => state.providers)
    const categoriesPage = view === 'search' && query.trim() === ''
    const listQuery = view === 'trending' ? '' : query.trim()
    const gifs = useGifList(
        session,
        view === 'favorites' || categoriesPage ? null : listQuery,
    )
    const trending = useTrending(session, categoriesPage)
    const favorites = useSessionStore(
        frecencyStore,
        state => state.favoriteGifs,
    )

    // An explicit memo: the tiles go to the native grid as one JSON string, sent again only when it changes.
    const { json, byKey, empty } = useMemo(() => {
        const byKey = new Map<string, Gif>()
        if (categoriesPage) {
            const json = JSON.stringify(categoryTiles(favorites, trending))
            return { json, byKey, empty: false }
        }
        const list =
            view === 'favorites'
                ? favoriteGifs(favorites, favoritesQuery)
                : gifs
        if (list === undefined)
            return { json: JSON.stringify(LOADING_TILES), byKey, empty: false }
        const badges = providers.length > 1
        const tiles = list.map((gif, index): GifTile => {
            byKey.set(gif.id, gif)
            return {
                key: gif.id,
                src: gif.src,
                width: gif.width,
                height: gif.height,
                label: t('expressions.gifLabel', { index: index + 1 }),
                badge:
                    badges && gif.provider
                        ? GIF_PROVIDER_NAMES[gif.provider]
                        : undefined,
            }
        })
        return { json: JSON.stringify(tiles), byKey, empty: tiles.length === 0 }
    }, [
        categoriesPage,
        view,
        gifs,
        trending,
        favorites,
        favoritesQuery,
        providers,
    ])

    return (
        <GifGrid
            tiles={json}
            bottomPadding={bottom}
            empty={
                empty ? (
                    <View style={styles.empty}>
                        <Text color="TEXT_MUTED">
                            {t('expressions.noGifResults')}
                        </Text>
                    </View>
                ) : undefined
            }
            onPressItem={key => {
                if (key === TRENDING_KEY) return onView('trending')
                if (key === FAVORITES_KEY) return onView('favorites')
                if (key.startsWith(CATEGORY_PREFIX))
                    return onSearch(key.slice(CATEGORY_PREFIX.length))
                const gif = byKey.get(key)
                if (gif) onSelect(gif)
            }}
            onLongPressItem={key => {
                const gif = byKey.get(key)
                if (gif) onHold(gif)
            }}
        />
    )
}

const TRENDING_KEY = 'trending'
const FAVORITES_KEY = 'favorites'
const CATEGORY_PREFIX = 'category:'

/** The categories page (GIFPickerCategoriesPage): Favorites, Trending GIFs, then the providers' categories. */
function categoryTiles(
    favorites: FavoriteGif[],
    trending: GifTrending | undefined,
): GifTile[] {
    if (!trending)
        return LOADING_TILES.map(tile => ({
            ...tile,
            width: 0,
            height: 0,
            category: true,
        }))
    const tiles: GifTile[] = []
    const favorite = favoriteGifs(favorites, '')[0]
    if (favorite)
        tiles.push({
            key: FAVORITES_KEY,
            src: favorite.src,
            label: t('expressions.favorites'),
            category: true,
            icon: gifGrid.iconFavorites,
        })
    if (trending.preview)
        tiles.push({
            key: TRENDING_KEY,
            src: trending.preview,
            label: t('expressions.trendingGifs'),
            category: true,
            icon: gifGrid.iconTrending,
        })
    for (const category of trending.categories)
        tiles.push({
            key: `${CATEGORY_PREFIX}${category.name}`,
            src: category.src,
            label: category.name,
            category: true,
        })
    return tiles
}

/** The settings a list depends on, as one key: a change loads it again. */
function useSettingsKey() {
    const providers = useGifSettings(state => state.providers.join(','))
    const quality = useGifSettings(state => state.quality)
    return `${providers}|${quality}`
}

/** The GIFs for `query` (trending for ''), undefined while loading; null skips loading. */
function useGifList(session: Session, query: string | null): Gif[] | undefined {
    const settings = useSettingsKey()
    const key = query === null ? null : `${settings}|${query}`
    const [result, setResult] = useState<{ key: string; gifs: Gif[] }>()
    useEffect(() => {
        if (key === null || query === null) return
        const controller = new AbortController()
        const timer = setTimeout(
            () => {
                fetchGifs(session, query, controller.signal)
                    .then(gifs => {
                        if (!controller.signal.aborted) setResult({ key, gifs })
                    })
                    .catch(() => {
                        if (controller.signal.aborted) return
                        toast(t('expressions.gifsFailed'), 'gifs-failed')
                        setResult({ key, gifs: [] })
                    })
            },
            query ? SEARCH_DEBOUNCE_MS : 0,
        )
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [session, key, query])
    return result?.key === key ? result.gifs : undefined
}

/** The categories page's data, loaded once per provider choice while it is shown. */
function useTrending(
    session: Session,
    shown: boolean,
): GifTrending | undefined {
    const settings = useSettingsKey()
    const [result, setResult] = useState<{
        key: string
        trending: GifTrending
    }>()
    const loaded = result?.key === settings
    useEffect(() => {
        if (!shown || loaded) return
        const controller = new AbortController()
        fetchTrending(session, controller.signal)
            .then(trending => {
                if (!controller.signal.aborted)
                    setResult({ key: settings, trending })
            })
            .catch(() => {
                if (controller.signal.aborted) return
                toast(t('expressions.gifsFailed'), 'gifs-failed')
                setResult({ key: settings, trending: { categories: [] } })
            })
        return () => controller.abort()
    }, [session, shown, loaded, settings])
    return loaded ? result.trending : undefined
}

const styles = StyleSheet.create(theme => ({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space.PX_12,
        paddingBottom: theme.space.PX_4,
        gap: theme.space.PX_8,
    },
    title: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
}))
