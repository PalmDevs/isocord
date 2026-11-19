import { useState } from 'react'
import { View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { useSession, useSessionReady, useSessionStore } from '../../core/react'
import { Skeleton, SkeletonPulse } from '../../design/components/Skeleton'
import { skeletonKeys } from '../../design/components/skeletonUtils'
import { guildsStore } from '../../stores/guilds'
import { settingsStore } from '../../stores/settings/settingsStore'
import { buildGuildList, buildRows } from './guildList'
import { DragPreview, DragSlot, FolderGroup } from './guildsBarDrag'
import { useDrag } from './guildsBarDragState'
import { styles } from './guildsBarStyles'
import { RowsContext } from './rowsContext'
import { serversUiStore } from './store'
import { useGuildsBarDrag } from './useGuildsBarDrag'
import type { GuildFolderItem } from './guildList'

/** Placeholder icons while the first READY is awaited; the reference has none, so this reuses its item metrics. */
function GuildsBarSkeleton() {
    const { GUILD_BAR_ITEM_SIZE: size, GUILD_ITEM_SELECTED_BORDER_RADIUS } =
        useUnistyles().theme.modules.mobile
    return (
        <SkeletonPulse style={styles.bar}>
            {skeletonKeys(8).map(key => (
                <View key={key} style={styles.item}>
                    <Skeleton
                        width={size}
                        height={size}
                        radius={GUILD_ITEM_SELECTED_BORDER_RADIUS}
                    />
                </View>
            ))}
        </SkeletonPulse>
    )
}

/** The vertical server list on the left of the Servers tab. */
export function GuildsBar() {
    const _session = useSession()
    const ready = useSessionReady()
    const guilds = useSessionStore(guildsStore, state => state.guilds)
    const folders = useSessionStore(settingsStore, state => state.folders)
    const expanded = useSessionStore(
        serversUiStore,
        state => state.expandedFolderIds,
    )
    // Folders whose servers are still shrinking away after closing, so their rows stay until they are gone.
    const [closing, setClosing] = useState<string[]>([])
    const [opening, setOpening] = useState<string[]>([])
    const [lastExpanded, setLastExpanded] = useState(expanded)
    if (lastExpanded !== expanded) {
        setLastExpanded(expanded)
        setOpening(expanded.filter(id => !lastExpanded.includes(id)))
        setClosing(ids => [
            ...ids.filter(id => !expanded.includes(id)),
            ...lastExpanded.filter(
                id => !expanded.includes(id) && !ids.includes(id),
            ),
        ])
    }
    const onClosed = (folderId: string) =>
        setClosing(ids => ids.filter(id => id !== folderId))
    const rowsContext = { opening, onClosed }

    const items = buildGuildList(folders, guilds)
    const rows = buildRows(
        items,
        id => expanded.includes(id) || closing.includes(id),
    )
    // Only the start and end of a drag redraw the bar; each row follows what the drag is over itself.
    const dragRows = useDrag(state => state?.rows ?? null)
    const shownRows = dragRows ?? rows
    // A folder's header and its servers' rows go together, over one background.
    const groups: { key: string; folder?: GuildFolderItem; rows: number[] }[] =
        []
    shownRows.forEach((row, index) => {
        const group = groups.at(-1)
        if (row.type === 'folder')
            groups.push({ key: row.key, folder: row.item, rows: [index] })
        else if (group?.folder && row.folder?.id === group.folder.folderId)
            group.rows.push(index)
        else groups.push({ key: row.key, rows: [index] })
    })
    const { theme } = useUnistyles()

    const full =
        theme.modules.mobile.GUILD_BAR_ITEM_SIZE +
        2 * theme.modules.mobile.GUILD_BAR_ITEM_MARGIN
    const shown = (id: string) => expanded.includes(id) || closing.includes(id)
    const { scrollRef, pan, previewY, viewport } = useGuildsBarDrag({
        items,
        rows,
        shown,
        full,
    })

    if (!ready && rows.length === 0) return <GuildsBarSkeleton />

    return (
        <RowsContext value={rowsContext}>
            <View
                style={styles.bar}
                onLayout={event =>
                    viewport.set(event.nativeEvent.layout.height)
                }
            >
                <Animated.ScrollView
                    ref={scrollRef}
                    style={styles.scroller}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={dragRows === null}
                >
                    <GestureDetector gesture={pan}>
                        <View>
                            {groups.map(group => {
                                const slots = group.rows.map(index => {
                                    const row = shownRows[index]
                                    return (
                                        row && (
                                            <DragSlot
                                                key={row.key}
                                                row={row}
                                                index={index}
                                                count={shownRows.length}
                                            />
                                        )
                                    )
                                })
                                return group.folder ? (
                                    <FolderGroup
                                        key={group.key}
                                        item={group.folder}
                                        first={group.rows[0] ?? 0}
                                        last={group.rows.at(-1) ?? 0}
                                        count={shownRows.length}
                                    >
                                        {slots}
                                    </FolderGroup>
                                ) : (
                                    slots
                                )
                            })}
                        </View>
                    </GestureDetector>
                </Animated.ScrollView>
                <DragPreview y={previewY} />
            </View>
        </RowsContext>
    )
}
