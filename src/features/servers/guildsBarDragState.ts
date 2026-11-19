import { create } from 'zustand'
import { combines, isDragged } from './guildList'
import type { GuildBarRow, Over } from './guildList'
/**
 * The drag on, as in the reference's GuildsBarDnDStore: the rows when it started (drawn until it ends), the row
 * picked up and what it is over. `dropping` once let go, while the preview flies into its slot and the rows finish
 * making room; the list takes the new order when both are done.
 */
export interface DragState {
    rows: GuildBarRow[]
    from: number
    over: Over
    dropping: boolean
    /** The preview shows its icon, so the row can go: until then it stays, or neither would show for a moment. */
    lifted: boolean
}

/** The preview's icon is on screen. */
export function lift() {
    const state = useDrag.getState()
    if (state && !state.lifted)
        useDrag.setState({ ...state, lifted: true }, true)
}
export const useDrag = create<DragState | null>(() => null)

/** What the picked-up item shows: a server, or a folder's tile. */
export interface PreviewItem {
    guildIds: string[]
    color?: number
    folder: boolean
}

/** GuildsBarDragPreview: the item picked up, or over the middle of a server, the folder the two would make. */
/**
 * The drop just taken by the list: the row stays hidden, and the preview over its slot, until the list is drawn
 * with its new sizes.
 */
export const useLanding = create<{ key: string; item: PreviewItem } | null>(
    () => null,
)

export function previewOf(state: DragState): PreviewItem | null {
    const drag = state.rows[state.from]
    const target = state.rows[state.over.index]
    if (
        state.over.state.startsWith('convert') &&
        drag?.type === 'guild' &&
        target?.type === 'guild'
    )
        return { guildIds: [target.guildId, drag.guildId], folder: true }
    if (drag?.type === 'folder')
        return {
            guildIds: drag.item.guildIds,
            color: drag.item.color,
            folder: true,
        }
    return drag ? { guildIds: [drag.guildId], folder: false } : null
}

interface SlotLook {
    /** Picked up and away, or a picked-up folder's server: the slot closes. */
    collapsed: boolean
    /** The drop gap opens above or under the row. */
    gap: 'above' | 'below' | null
    hidden: boolean
}
const NO_LOOK: SlotLook = { collapsed: false, gap: null, hidden: false }

/**
 * The drop gap at row `index`, if it is there, and whether it is outside the folder the row is in (above its
 * header, or under its last server when a folder is dragged): the folder's group draws that one, off its background.
 */
function gapAt(state: DragState, index: number) {
    const { rows, from, over, dropping } = state
    // Let go into a folder: the gap closes as the item flies into the row.
    if (
        over.state === 'self' ||
        over.index !== index ||
        (dropping && combines(over))
    )
        return null
    const row = rows[index]
    const gap: 'above' | 'below' = over.before ? 'above' : 'below'
    const outside =
        row?.type === 'folder'
            ? gap === 'above'
            : row?.folder !== undefined &&
              gap === 'below' &&
              rows[from]?.type === 'folder'
    return { gap, outside }
}

/** GuildsBarAnimatedItemWrapper: how a row is drawn during a drag. */
export function slotLook(state: DragState | null, index: number): SlotLook {
    if (!state) return NO_LOOK
    const { rows, from, over } = state
    if (isDragged(rows, from, index))
        return {
            collapsed: index !== from || over.state !== 'self',
            gap: null,
            hidden: index !== from || state.lifted,
        }
    const at = gapAt(state, index)
    if (!at || at.outside) return NO_LOOK
    return { collapsed: false, gap: at.gap, hidden: false }
}

/** The gaps a folder's group draws outside its background, at its header (`first`) and its last row. */
export function groupLook(
    state: DragState | null,
    first: number,
    last: number,
) {
    const top = state && gapAt(state, first)
    const bottom = state && gapAt(state, last)
    return {
        above: top?.outside === true && top.gap === 'above',
        below: bottom?.outside === true && bottom.gap === 'below',
    }
}
