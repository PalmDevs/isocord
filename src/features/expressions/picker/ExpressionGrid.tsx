import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { SheetDrag } from '../../../design/components/sheets/SheetDrag'
import NativeExpressionGrid, {
    Commands,
} from '../../../native/ExpressionGridViewNativeComponent'
import { useChatTheme } from '../../chat/rows/rowEncoder'
import { CategoryRail } from './CategoryRail'
import type { ComponentRef, ReactNode } from 'react'
import type { RailSection } from './CategoryRail'

/*
 * The `sections` prop of `IsocordExpressionGridView`, the contract shared with ExpressionGrid.kt (GridSection,
 * GridItem). Items are arrays to keep the thousands of emojis in a grid short to send.
 */

/**
 * `[key, image url, flags, label]`; flags are `expressionGrid.itemAnimated` (it moves) and `itemLocked` (it can't be
 * used here). The key comes back in the press events, the label is read out. */
export type GridItem = [key: string, url: string, flags: number, label: string]

export interface GridSection {
    key: string
    /** Drawn as the section's header; empty for none (search results). */
    title: string
    items: GridItem[]
}

export interface ExpressionGridProps {
    /** `expressionGrid.kindEmoji` or `kindSticker`. */
    kind: string
    /** The sections, already serialized, so the grid gets them again only when they change. */
    sections: string
    /** The category rail under the grid, one entry per section in the same order; omitted, no rail. */
    rail?: RailSection[]
    /** The user's `animate_emoji`. */
    animate: boolean
    /** Shown instead of the grid (no results, still loading). */
    empty?: ReactNode
    bottomPadding?: number
    onPressItem: (key: string, flightId: string) => void
    onLongPressItem?: (key: string) => void
}

/**
 * A native grid of emojis or stickers (reference: EmojiPickerView, the Android emoji picker's native list), with
 * the category rail under it. It is drawn by rows, each row one image draw per item, with a circle in place of
 * an image not loaded yet; the sheet it is in drags from it while it is scrolled to its top.
 */
export function ExpressionGrid({
    kind,
    sections,
    rail,
    animate,
    empty,
    bottomPadding,
    onPressItem,
    onLongPressItem,
}: ExpressionGridProps) {
    const themeJson = useChatTheme()
    const grid = useRef<ComponentRef<typeof NativeExpressionGrid>>(null)
    const atTop = useSharedValue(true)
    // The rail keeps the active category itself, so the grid is not drawn again when it changes.
    const setActive = useRef<(index: number) => void>(undefined)

    // Nothing to scroll: the sheet drags from anywhere again.
    const shown = empty == null
    useEffect(() => {
        if (!shown) atTop.set(true)
    }, [shown, atTop])

    return (
        <View style={styles.fill}>
            <SheetDrag scrollAtTop={atTop} style={styles.fill}>
                {shown ? (
                    <NativeExpressionGrid
                        ref={grid}
                        style={styles.fill}
                        kind={kind}
                        sections={sections}
                        theme={themeJson}
                        animate={animate}
                        bottomPadding={bottomPadding}
                        onPressItem={e =>
                            onPressItem(
                                e.nativeEvent.key,
                                e.nativeEvent.flightId,
                            )
                        }
                        onLongPressItem={e =>
                            onLongPressItem?.(e.nativeEvent.key)
                        }
                        onActiveSection={e =>
                            setActive.current?.(e.nativeEvent.index)
                        }
                        onAtTop={e => atTop.set(e.nativeEvent.atTop)}
                    />
                ) : (
                    empty
                )}
            </SheetDrag>
            {rail && rail.length > 0 && (
                <GridRail
                    sections={rail}
                    setActive={setActive}
                    onPress={index => {
                        if (grid.current)
                            Commands.scrollToSection(grid.current, index)
                    }}
                />
            )}
        </View>
    )
}

/** The category rail with the active category as its own state, set by the grid as it scrolls. */
function GridRail({
    sections,
    setActive,
    onPress,
}: {
    sections: RailSection[]
    setActive: { current: ((index: number) => void) | undefined }
    onPress: (index: number) => void
}) {
    const [active, set] = useState(0)
    useEffect(() => {
        setActive.current = set
        return () => {
            setActive.current = undefined
        }
    }, [setActive])
    return (
        <CategoryRail sections={sections} active={active} onPress={onPress} />
    )
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
})
