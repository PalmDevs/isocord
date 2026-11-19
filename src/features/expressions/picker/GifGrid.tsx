import { useEffect } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { SheetDrag } from '../../../design/components/sheets/SheetDrag'
import NativeGifGrid from '../../../native/GifGridViewNativeComponent'
import { useChatTheme } from '../../chat/rows/rowEncoder'
import type { ReactNode } from 'react'

/**
 * A tile of `IsocordGifGridView`, the contract shared with GifTiles.kt (GifTile). A GIF is laid out at
 * `width` / `height`; a category is a fixed-height tile with `label` over its image. An empty `src` is a
 * placeholder. `label` is read out.
 */
export interface GifTile {
    key: string
    src: string
    width?: number
    height?: number
    label: string
    category?: boolean
    /** `gifGrid.iconTrending` or `iconFavorites`, before a category's name. */
    icon?: string
    /** Drawn in the bottom corner: the provider, when several are chosen. */
    badge?: string
}

export interface GifGridProps {
    /** The tiles, already serialized, so the grid gets them again only when they change. */
    tiles: string
    /** Shown instead of the grid (no results). */
    empty?: ReactNode
    bottomPadding?: number
    onPressItem: (key: string) => void
    onLongPressItem: (key: string) => void
}

/**
 * The native GIF grid (GIFPickerResultsList, GIFPickerCategoriesPage). The sheet it is in drags from it while
 * it is scrolled to its top.
 */
export function GifGrid({
    tiles,
    empty,
    bottomPadding,
    onPressItem,
    onLongPressItem,
}: GifGridProps) {
    const themeJson = useChatTheme()
    const atTop = useSharedValue(true)
    const shown = empty == null
    // Nothing to scroll: the sheet drags from anywhere again.
    useEffect(() => {
        if (!shown) atTop.set(true)
    }, [shown, atTop])

    return (
        <SheetDrag scrollAtTop={atTop} style={styles.fill}>
            {shown ? (
                <NativeGifGrid
                    style={styles.fill}
                    tiles={tiles}
                    theme={themeJson}
                    bottomPadding={bottomPadding}
                    onPressItem={e => onPressItem(e.nativeEvent.key)}
                    onLongPressItem={e => onLongPressItem(e.nativeEvent.key)}
                    onAtTop={e => atTop.set(e.nativeEvent.atTop)}
                />
            ) : (
                empty
            )}
        </SheetDrag>
    )
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
})
