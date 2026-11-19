import { useContext, useEffect } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { useSession, useSessionStore } from '../../core/react'
import { GuildIcon } from '../../design/components/avatars/GuildIcon'
import { Badge } from '../../design/components/Badge'
import { Icon } from '../../design/icons/Icon'
import {
    GUILDS_FOLDER_ICON_SPRING,
    GUILDS_FOLDER_TRANSITION_SPRING,
    GUILDS_SELECTION_BAR_SPRING,
} from '../../design/tokens/motion'
import { guildsStore } from '../../stores/guilds'
import { readStatesStore } from '../../stores/readStates'
import { useFolderColors } from './guildsBarColors'
import { styles } from './guildsBarStyles'
import { RowsContext } from './rowsContext'
import { serversUiStore } from './store'
import type { GuildBarRow, GuildFolderItem } from './guildList'

/** GuildIconSizes.XXSMALL, the mini icons in a closed folder. */
const PREVIEW_ICON_SIZE = 16

/** The bar at the left edge: a small pill for unread, a tall one for the selection. */
function SelectionBar({ selected }: { selected: boolean }) {
    const height = useSharedValue(selected ? 40 : 8)
    useEffect(() => {
        height.set(withSpring(selected ? 40 : 8, GUILDS_SELECTION_BAR_SPRING))
    }, [selected, height])
    const style = useAnimatedStyle(() => ({ height: height.get() }))
    return <Animated.View style={[styles.pill, style]} />
}

function GuildItem({
    guildId,
    hidden = false,
    ring = 'BACKGROUND_BASE_LOWEST',
}: {
    guildId: string
    /** Picked up: its slot stays, empty. */
    hidden?: boolean
    /** Colour behind the item, for the badge cut-out. */
    ring?: 'BACKGROUND_BASE_LOWEST' | `#${string}`
}) {
    const session = useSession()
    const { theme } = useUnistyles()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const selected = useSessionStore(
        serversUiStore,
        state => state.selectedGuildId === guildId,
    )
    const badge = useSessionStore(
        readStatesStore,
        state => state.guildBadges[guildId],
    )
    if (!guild) return null
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={guild.name}
            accessibilityState={{ selected }}
            onPress={() =>
                session
                    .get(serversUiStore)
                    .setState({ selectedGuildId: guildId })
            }
            style={[styles.item, hidden && styles.hidden]}
        >
            {(selected || badge?.unread) && (
                <SelectionBar selected={selected} />
            )}
            <GuildIcon
                guild={guild}
                radius={theme.modules.mobile.GUILD_ITEM_SELECTED_BORDER_RADIUS}
            />
            {badge && badge.mentions > 0 && (
                <View style={styles.badge}>
                    <Badge
                        count={badge.mentions}
                        ring={ring}
                        lowImportance={badge.lowImportance}
                    />
                </View>
            )}
        </Pressable>
    )
}

/**
 * A server's row, at the top level or in an open folder. In a folder it grows in as the folder opens and shrinks
 * away as it closes (the reference's GuildsBarAnimatedItemWrapper); the folder's group draws the background.
 */
export function GuildRow({
    row,
    hidden,
}: {
    row: Extract<GuildBarRow, { type: 'guild' }>
    /** Picked up: only the icon goes, the folder's background stays. */
    hidden: boolean
}) {
    const { theme } = useUnistyles()
    const { opening, onClosed } = useContext(RowsContext)
    const { folder } = row
    const folderId = folder?.id
    const colors = useFolderColors(folder?.color)
    const expanded = useSessionStore(serversUiStore, state =>
        folderId === undefined
            ? true
            : state.expandedFolderIds.includes(folderId),
    )
    const { GUILD_BAR_ITEM_SIZE: size, GUILD_BAR_ITEM_MARGIN: margin } =
        theme.modules.mobile
    const full = size + 2 * margin
    // Added as its folder opens: grows in. Drawn with the list (in batches, so possibly later): already open.
    const height = useSharedValue(
        folderId !== undefined && opening.includes(folderId) ? 0 : full,
    )
    useEffect(() => {
        if (folderId === undefined) {
            height.set(full)
            return
        }
        height.set(
            withSpring(
                expanded ? full : 0,
                GUILDS_FOLDER_TRANSITION_SPRING,
                finished => {
                    if (finished && !expanded) scheduleOnRN(onClosed, folderId)
                },
            ),
        )
    }, [expanded, folderId, full, height, onClosed])
    const style = useAnimatedStyle(() => ({ height: height.get() }))
    // GuildsBarGuildFolder: a folder's servers fade and scale in from 0.3 as it opens, and away as it closes, so the
    // icon isn't cut off by the row while the row grows or shrinks.
    const itemStyle = useAnimatedStyle(() => {
        const shown = Math.min(1, Math.max(0, height.get() / full))
        return { opacity: shown, transform: [{ scale: 0.3 + 0.7 * shown }] }
    })
    return (
        <Animated.View style={[styles.row, style]}>
            {/* Shrinking away over the rows below: not pressable. */}
            <Animated.View
                pointerEvents={expanded ? 'auto' : 'none'}
                style={itemStyle}
            >
                <GuildItem
                    guildId={row.guildId}
                    hidden={hidden}
                    ring={folder ? colors.ring : undefined}
                />
            </Animated.View>
        </Animated.View>
    )
}

function FolderPreviewIcon({
    guildId,
    corner,
    selected,
}: {
    guildId: string
    corner: number
    selected: boolean
}) {
    const { theme } = useUnistyles()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    if (!guild) return null
    return (
        <View style={styles.previewIcon(corner)}>
            <GuildIcon
                guild={guild}
                size={PREVIEW_ICON_SIZE}
                radius={selected ? PREVIEW_ICON_SIZE / 3 : theme.radii.sm}
            />
        </View>
    )
}

/** The mini icons of a closed folder's tile: its first four servers. */
export function FolderTileIcons({
    guildIds,
    selectedGuildId,
}: {
    guildIds: string[]
    selectedGuildId: string | null
}) {
    return guildIds
        .slice(0, 4)
        .map((guildId, index) => (
            <FolderPreviewIcon
                key={guildId}
                guildId={guildId}
                corner={index}
                selected={guildId === selectedGuildId}
            />
        ))
}

/** The folder's row: its icon when open, a tile of mini server icons when closed. */
export function FolderHeader({
    item,
    hidden,
}: {
    item: GuildFolderItem
    /** Picked up: its slot stays, empty. */
    hidden: boolean
}) {
    const session = useSession()
    const colors = useFolderColors(item.color)
    const expanded = useSessionStore(serversUiStore, state =>
        state.expandedFolderIds.includes(item.folderId),
    )
    const open = useSharedValue(expanded ? 1 : 0)
    useEffect(() => {
        open.set(withSpring(expanded ? 1 : 0, GUILDS_FOLDER_ICON_SPRING))
    }, [expanded, open])
    const selectedGuildId = useSessionStore(
        serversUiStore,
        state => state.selectedGuildId,
    )
    const containsSelected =
        selectedGuildId !== null && item.guildIds.includes(selectedGuildId)
    // The closed folder stands in for its servers' unread state.
    const unread = useSessionStore(readStatesStore, state =>
        item.guildIds.some(id => state.guildBadges[id]?.unread),
    )
    const mentions = useSessionStore(readStatesStore, state =>
        item.guildIds.reduce(
            (sum, id) => sum + (state.guildBadges[id]?.mentions ?? 0),
            0,
        ),
    )
    // GuildsBarGuildFolder: low importance only when no server in it has an important mention.
    const lowImportance = useSessionStore(readStatesStore, state =>
        item.guildIds.every(id => {
            const badge = state.guildBadges[id]
            return !badge || badge.mentions === 0 || badge.lowImportance
        }),
    )
    const toggle = () =>
        session.get(serversUiStore).setState(state => ({
            expandedFolderIds: expanded
                ? state.expandedFolderIds.filter(id => id !== item.folderId)
                : [...state.expandedFolderIds, item.folderId],
        }))
    // GuildsBarGuildFolder: the icon grows in from 0.3 as the tile leaves at 1.3.
    const tileStyle = useAnimatedStyle(() => ({
        opacity: 1 - open.get(),
        transform: [{ scale: 1 + 0.3 * open.get() }],
    }))
    const iconStyle = useAnimatedStyle(() => ({
        opacity: open.get(),
        transform: [{ scale: 0.3 + 0.7 * open.get() }],
    }))

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            accessibilityState={{ expanded }}
            onPress={toggle}
            style={[styles.item, hidden && styles.hidden]}
        >
            {!expanded && (containsSelected || unread) && (
                <SelectionBar selected={containsSelected} />
            )}
            <View style={styles.shape}>
                <Animated.View
                    style={[
                        styles.tile,
                        { backgroundColor: colors.preview },
                        tileStyle,
                    ]}
                >
                    <FolderTileIcons
                        guildIds={item.guildIds}
                        selectedGuildId={selectedGuildId}
                    />
                </Animated.View>
                <Animated.View style={[styles.folderIcon, iconStyle]}>
                    <Icon
                        name="FolderIcon"
                        color="ICON_BRAND"
                        style={{ tintColor: colors.icon }}
                    />
                </Animated.View>
            </View>
            {!expanded && mentions > 0 && (
                <View style={styles.badge}>
                    <Badge
                        count={mentions}
                        ring="BACKGROUND_BASE_LOWEST"
                        lowImportance={lowImportance}
                    />
                </View>
            )}
        </Pressable>
    )
}
