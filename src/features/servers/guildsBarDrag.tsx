import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { useShallow } from 'zustand/react/shallow'
import { useSessionStore } from '../../core/react'
import { GuildIcon } from '../../design/components/avatars/GuildIcon'
import {
    GUILDS_FOLDER_ICON_SPRING,
    GUILDS_TRANSITION_SPRING,
} from '../../design/tokens/motion'
import { guildsStore } from '../../stores/guilds'
import { useFolderColors } from './guildsBarColors'
import {
    groupLook,
    lift,
    previewOf,
    slotLook,
    useDrag,
    useLanding,
} from './guildsBarDragState'
import { FolderHeader, FolderTileIcons, GuildRow } from './guildsBarRows'
import { styles } from './guildsBarStyles'
import { serversUiStore } from './store'
import type { ReactNode } from 'react'
import type { SharedValue } from 'react-native-reanimated'
import type { GuildBarRow, GuildFolderItem } from './guildList'

/**
 * A slot's size (a gap, or a row closing while picked up), springing to `to` with the rows' layout transition during
 * a drag. When the drag ends the list is already laid out as it was drawn, the dropped row in the gap, so the sizes
 * go straight there: springing, the row would start a gap too low and slide up after the preview landed.
 */
function useSlotSize(to: number, initial = to) {
    const size = useSharedValue(initial)
    useEffect(() => {
        size.set(
            useDrag.getState() ? withSpring(to, GUILDS_TRANSITION_SPRING) : to,
        )
    }, [to, size])
    return size
}

/**
 * GuildsBarGuildFolder's background (GuildsBarGuildFolderBG): one rounded background behind the folder's header and
 * its servers' rows, from the folder icon's top to the bottom of the last row, growing and shrinking with them and
 * with the drop gaps inside the folder. The group is drawn over the rows below it like a row.
 */
export function FolderGroup({
    item,
    first,
    last,
    count,
    children,
}: {
    item: GuildFolderItem
    /** The rows of the header and of its last server. */
    first: number
    last: number
    count: number
    children: ReactNode
}) {
    const { GUILD_BAR_ITEM_SIZE: size, GUILD_BAR_ITEM_MARGIN: margin } =
        useUnistyles().theme.modules.mobile
    const full = size + 2 * margin
    const colors = useFolderColors(item.color)
    const expanded = useSessionStore(serversUiStore, state =>
        state.expandedFolderIds.includes(item.folderId),
    )
    const open = useSharedValue(expanded ? 1 : 0)
    useEffect(() => {
        open.set(withSpring(expanded ? 1 : 0, GUILDS_FOLDER_ICON_SPRING))
    }, [expanded, open])
    const look = useDrag(useShallow(state => groupLook(state, first, last)))
    const above = useSlotSize(look.above ? full : 0)
    const below = useSlotSize(look.below ? full : 0)
    const groupStyle = useAnimatedStyle(() => ({
        paddingTop: Math.max(0, above.get()),
        paddingBottom: Math.max(0, below.get()),
    }))
    const backgroundStyle = useAnimatedStyle(() => ({
        top: Math.max(0, above.get()) + margin,
        bottom: Math.max(0, below.get()),
        opacity: open.get(),
    }))
    return (
        <Animated.View style={[{ zIndex: count - first }, groupStyle]}>
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.folderBackground,
                    { backgroundColor: colors.background },
                    backgroundStyle,
                ]}
            />
            {children}
        </Animated.View>
    )
}

/**
 * A row of the bar with its drag look: the gap it opens, or its slot closing while picked up. The changes spring
 * like GuildsBarGuild's layout transition, so the rows make room and close up instead of jumping. Each row is drawn
 * over the rows below it, so an icon reaching past its row stays above their folder backgrounds.
 */
export function DragSlot({
    row,
    index,
    count,
}: {
    row: GuildBarRow
    index: number
    /** How many rows the bar has. */
    count: number
}) {
    const { GUILD_BAR_ITEM_SIZE: size, GUILD_BAR_ITEM_MARGIN: margin } =
        useUnistyles().theme.modules.mobile
    const full = size + 2 * margin
    const look = useDrag(useShallow(state => slotLook(state, index)))
    const landing = useLanding(state => state?.key === row.key)
    const hidden = look.hidden || landing
    const above = useSlotSize(look.gap === 'above' ? full : 0)
    const below = useSlotSize(look.gap === 'below' ? full : 0)
    // Dropped into or out of a folder, the row is drawn anew: it starts as the gap it fills, closed until the gap
    // is, so the rows below don't move for that frame.
    const height = useSlotSize(
        look.collapsed ? 0 : full,
        landing ? 0 : undefined,
    )
    const slotStyle = useAnimatedStyle(() => ({
        paddingTop: Math.max(0, above.get()),
        paddingBottom: Math.max(0, below.get()),
    }))
    const rowStyle = useAnimatedStyle(() => ({
        maxHeight: Math.max(0, height.get()),
    }))
    return (
        <Animated.View style={[{ zIndex: count - index }, slotStyle]}>
            <Animated.View style={[hidden && styles.slot, rowStyle]}>
                {row.type === 'folder' ? (
                    <FolderHeader item={row.item} hidden={hidden} />
                ) : (
                    <GuildRow row={row} hidden={hidden} />
                )}
            </Animated.View>
        </Animated.View>
    )
}

function PreviewGuild({ guildId }: { guildId: string }) {
    const { theme } = useUnistyles()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    if (!guild) return null
    return (
        <GuildIcon
            guild={guild}
            radius={theme.modules.mobile.GUILD_ITEM_SELECTED_BORDER_RADIUS}
            onDisplay={lift}
        />
    )
}

function PreviewFolder({
    guildIds,
    color,
}: {
    guildIds: string[]
    color?: number
}) {
    const colors = useFolderColors(color)
    return (
        <View style={styles.shape}>
            <View style={[styles.tile, { backgroundColor: colors.preview }]}>
                <FolderTileIcons guildIds={guildIds} selectedGuildId={null} />
            </View>
        </View>
    )
}

/**
 * GuildsBarDragPreview: the picked-up item under the finger, and flying into its slot when let go. Always mounted,
 * so it never shows for a frame where the last drag left it.
 */
export function DragPreview({ y }: { y: SharedValue<number> }) {
    const state = useDrag()
    const landing = useLanding()
    const style = useAnimatedStyle(() => ({
        transform: [{ translateY: y.get() }],
    }))
    const item = state ? previewOf(state) : landing?.item
    const [guildId] = item?.guildIds ?? []
    return (
        <Animated.View pointerEvents="none" style={[styles.preview, style]}>
            {item && guildId && (
                <View style={styles.item}>
                    {item.folder ? (
                        <PreviewFolder
                            guildIds={item.guildIds}
                            color={item.color}
                        />
                    ) : (
                        <PreviewGuild guildId={guildId} />
                    )}
                </View>
            )}
        </Animated.View>
    )
}
