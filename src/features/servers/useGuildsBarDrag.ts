import { useRef } from 'react'
import { usePanGesture } from 'react-native-gesture-handler'
import {
    scrollTo,
    useAnimatedReaction,
    useAnimatedRef,
    useFrameCallback,
    useScrollOffset,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSession } from '../../core/react'
import { GUILDS_DRAG_SPRING } from '../../design/tokens/motion'
import { guildsStore } from '../../stores/guilds'
import { saveGuildFolders } from '../../stores/settings/settingsActions'
import {
    buildRows,
    combines,
    computeOver,
    dropRow,
    dropTop,
    itemsToFolders,
} from './guildList'
import { previewOf, useDrag, useLanding } from './guildsBarDragState'
import { serversUiStore } from './store'
import type Animated from 'react-native-reanimated'
import type { GuildBarRow, GuildListItem } from './guildList'
import type { DragState } from './guildsBarDragState'

/**
 * How long the rows take to finish springing (GUILDS_TRANSITION_SPRING to within half a pixel) after the drag last
 * changed what it is over: the list takes the new order after that, so nothing has to jump.
 */
const ROWS_SETTLE_MS = 400
/**
 * How long the dropped row stays hidden under the preview after the list takes the new order: the slots get their
 * new sizes a frame or two after the rows are redrawn, and until then the row can be drawn a slot off.
 */
const LANDING_MS = 100
/** How long a server or folder is held before it is picked up. */
const LONG_PRESS_MS = 500
/** useGuildsBarGesture: the band at each end of the bar where a drag scrolls it, up to 1000 px/s at the edge. */
const PUSH_SCROLL_EDGE = 160
const PUSH_SCROLL_SPEED = 1000

/** Runs the long-press drag of the bar's rows: the pan gesture, edge scrolling, and the drop. */
export function useGuildsBarDrag({
    items,
    rows,
    shown,
    full,
}: {
    items: GuildListItem[]
    rows: GuildBarRow[]
    shown: (id: string) => boolean
    full: number
}) {
    const session = useSession()
    const scrollRef = useAnimatedRef<Animated.ScrollView>()
    const scroll = useScrollOffset(scrollRef)
    /** The bar's height, the finger and where the drag started (bar coordinates), and the preview's top. */
    const viewport = useSharedValue(0)
    const finger = useSharedValue(0)
    const start = useSharedValue(0)
    const previewY = useSharedValue(0)
    const active = useSharedValue(false)
    /** Where the preview flies to when let go (bar coordinates). */
    const dropAt = useSharedValue<number | null>(null)

    const latest = useRef({ items, rows, shown })
    latest.current = { items, rows, shown }
    /** When the drag last changed what it is over, so when the rows are done making room. */
    const changedAt = useRef(0)

    const move = (y: number) => {
        const state = useDrag.getState()
        if (!state || state.dropping) return
        const over = computeOver(state.rows, state.from, y, state.over, full)
        if (
            over.index !== state.over.index ||
            over.state !== state.over.state ||
            over.before !== state.over.before
        ) {
            changedAt.current = Date.now()
            useDrag.setState({ ...state, over }, true)
        }
    }
    /** The new order, once the drop is drawn as the list will be. Returns the new list, if it changed. */
    const commit = (state: DragState) => {
        const next = dropRow(
            latest.current.items,
            state.rows,
            state.from,
            state.over,
        )
        if (next) saveGuildFolders(session, itemsToFolders(next))
        const item = previewOf(state)
        const key = state.rows[state.from]?.key
        const landing = item && key ? { key, item } : null
        useLanding.setState(landing, true)
        useDrag.setState(null, true)
        setTimeout(() => {
            if (landing && useLanding.getState() === landing)
                useLanding.setState(null, true)
        }, LANDING_MS)
        return next
    }
    // The preview landed: once the rows are done springing too, the list takes the new order. It is then laid out
    // as it is drawn, so nothing moves.
    const land = () => {
        const state = useDrag.getState()
        if (!state?.dropping) return
        setTimeout(
            () => {
                if (useDrag.getState() === state) commit(state)
            },
            Math.max(0, changedAt.current + ROWS_SETTLE_MS - Date.now()),
        )
    }
    const begin = (y: number) => {
        // Picked up again before the last drop finished: it is done now.
        const pending = useDrag.getState()
        const next = pending?.dropping ? commit(pending) : null
        const rows = next
            ? buildRows(next, latest.current.shown)
            : latest.current.rows
        useLanding.setState(null, true)
        changedAt.current = Date.now()
        const from = Math.min(rows.length - 1, Math.floor(y / full))
        const row = rows[from]
        if (!row) return
        // useGuildsBarGesture: a folder picked up open closes.
        if (row.type === 'folder' && row.showsGuilds)
            session.get(serversUiStore).setState(state => ({
                expandedFolderIds: state.expandedFolderIds.filter(
                    id => id !== row.item.folderId,
                ),
            }))
        useDrag.setState(
            {
                rows,
                from,
                over: { index: from, state: 'self', before: false },
                dropping: false,
                // A folder's tile and a server without an icon show at once.
                lifted:
                    row.type === 'folder' ||
                    !session.get(guildsStore).getState().guilds[row.guildId]
                        ?.icon,
            },
            true,
        )
        pushScroll.setActive(true)
    }
    // Let go: the preview flies into the slot it drops into, the gap, or the row it goes into as that gap closes.
    const end = () => {
        pushScroll.setActive(false)
        const state = useDrag.getState()
        if (!state || state.dropping) return
        const at =
            dropTop(state.rows, state.from, state.over, full) - scroll.get()
        if (combines(state.over)) changedAt.current = Date.now()
        useDrag.setState({ ...state, dropping: true }, true)
        dropAt.set(at)
        previewY.set(withSpring(at, GUILDS_DRAG_SPRING))
    }
    // The drag spring is overdamped and takes seconds to settle completely; within a pixel it has landed.
    useAnimatedReaction(
        () => {
            const at = dropAt.get()
            return at !== null && Math.abs(previewY.get() - at) < 1
        },
        (landed, was) => {
            if (landed && !was) scheduleOnRN(land)
        },
    )

    // Held near either end of the bar, a drag scrolls it; not at the end it started in until it moves further in.
    const pushScroll = useFrameCallback(({ timeSincePreviousFrame }) => {
        if (!active.get() || !timeSincePreviousFrame) return
        const y = finger.get()
        const top = Math.min(start.get(), PUSH_SCROLL_EDGE)
        const bottom = Math.max(start.get(), viewport.get() - PUSH_SCROLL_EDGE)
        const push =
            y < top
                ? -Math.min((top - y) / PUSH_SCROLL_EDGE, 1)
                : y > bottom
                  ? Math.min((y - bottom) / PUSH_SCROLL_EDGE, 1)
                  : 0
        if (push === 0) return
        const offset = Math.max(
            0,
            scroll.get() +
                (timeSincePreviousFrame / 1000) * PUSH_SCROLL_SPEED * push,
        )
        scrollTo(scrollRef, 0, offset, false)
        scheduleOnRN(move, y + offset)
    }, false)

    const pan = usePanGesture({
        activateAfterLongPress: LONG_PRESS_MS,
        onActivate: event => {
            'worklet'
            dropAt.set(null)
            const y = event.y - scroll.get()
            start.set(y)
            finger.set(y)
            previewY.set(y - (event.y % full))
            active.set(true)
            scheduleOnRN(begin, event.y)
        },
        onUpdate: event => {
            'worklet'
            if (!active.get()) return
            const y = event.y - scroll.get()
            previewY.set(previewY.get() + (y - finger.get()))
            finger.set(y)
            scheduleOnRN(move, event.y)
        },
        onFinalize: () => {
            'worklet'
            if (!active.get()) return
            active.set(false)
            scheduleOnRN(end)
        },
    })
    return { scrollRef, pan, previewY, viewport }
}
