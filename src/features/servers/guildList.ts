import type { Guild } from '../../stores/guilds'
import type { GuildFolder } from '../../stores/settings/settingsProto'

export type GuildListItem =
    | { type: 'guild'; key: string; guildId: string }
    | {
          type: 'folder'
          key: string
          folderId: string
          name?: string
          color?: number
          guildIds: string[]
      }

/** The server list in the user's order. Servers missing from the synced order (just joined) come first. */
export function buildGuildList(
    folders: GuildFolder[],
    guilds: Record<string, Guild>,
): GuildListItem[] {
    const items: GuildListItem[] = []
    const placed = new Set<string>()
    for (const folder of folders) {
        const guildIds = folder.guildIds.filter(
            id => guilds[id] && !placed.has(id),
        )
        for (const id of guildIds) placed.add(id)
        if (folder.id === undefined) {
            for (const guildId of guildIds)
                items.push({ type: 'guild', key: guildId, guildId })
        } else if (guildIds.length > 0) {
            items.push({
                type: 'folder',
                key: `folder-${folder.id}`,
                folderId: folder.id,
                name: folder.name,
                color: folder.color,
                guildIds,
            })
        }
    }
    const unplaced = Object.values(guilds)
        .filter(guild => !placed.has(guild.id))
        .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
        .map(
            (guild): GuildListItem => ({
                type: 'guild',
                key: guild.id,
                guildId: guild.id,
            }),
        )
    return [...unplaced, ...items]
}

export type GuildFolderItem = Extract<GuildListItem, { type: 'folder' }>

/** Turns the list back into the synced folder list, in order. */
export function itemsToFolders(items: GuildListItem[]): GuildFolder[] {
    return items.map(item =>
        item.type === 'guild'
            ? { guildIds: [item.guildId] }
            : {
                  id: item.folderId,
                  name: item.name,
                  color: item.color,
                  guildIds: item.guildIds,
              },
    )
}

/**
 * A row of the server bar. Like the reference's flattened guild list (`getFlattenedGuildFolderList`), an open
 * folder's servers are rows of their own after the folder's, so each can be dragged on its own.
 */
export type GuildBarRow =
    | {
          type: 'guild'
          /** The server's id, the same in and out of a folder, so moving it keeps its row. */
          key: string
          guildId: string
          /** The folder it is in; absent at the top level. */
          folder?: { id: string; color?: number }
      }
    | {
          type: 'folder'
          key: string
          item: GuildFolderItem
          /** Whether its servers follow as rows (open, or still closing). */
          showsGuilds: boolean
      }

/** The bar's rows: `shown` says which folders' servers are rows. */
export function buildRows(
    items: GuildListItem[],
    shown: (folderId: string) => boolean,
): GuildBarRow[] {
    const rows: GuildBarRow[] = []
    for (const item of items) {
        if (item.type === 'guild') {
            rows.push(item)
            continue
        }
        const showsGuilds = shown(item.folderId)
        rows.push({ type: 'folder', key: item.key, item, showsGuilds })
        if (!showsGuilds) continue
        item.guildIds.forEach(guildId =>
            rows.push({
                type: 'guild',
                key: guildId,
                guildId,
                folder: { id: item.folderId, color: item.color },
            }),
        )
    }
    return rows
}

/**
 * Where a dragged row is over, as in the reference's GuildsBarDnDStore `overSpecs`: on itself (`self`), next to a
 * row (`before`/`after`), over the middle of a top-level server to make a folder of the two (`convert-*`), or over
 * the middle of a closed folder to go into it (`drop-into`). `before` says the gap opens above the row.
 */
export type OverState =
    | 'self'
    | 'before'
    | 'after'
    | 'convert-before'
    | 'convert-after'
    | 'drop-into'

export interface Over {
    index: number
    state: OverState
    /** The gap opens above the row (it was hovered from below), else under it. */
    before: boolean
}

/** Part of the drag of row `from`: the row itself, and a dragged folder's open servers. */
export function isDragged(rows: GuildBarRow[], from: number, index: number) {
    if (index === from) return true
    const drag = rows[from]
    const row = rows[index]
    return (
        drag?.type === 'folder' &&
        row?.type === 'guild' &&
        row.folder?.id === drag.item.folderId
    )
}

/** Where the drop gap is during a drag: above or under row `index`; over itself, the dragged row's own slot. */
function gapOf(from: number, over: Over) {
    return over.state === 'self'
        ? { index: from, above: true }
        : { index: over.index, above: over.before }
}

/**
 * Whether dropping row `from` before or after `over.index` leaves it where it is: that row is its neighbour, and
 * for a server, the slot next to it is in the server's own folder (or outside any, as the server is).
 */
function inPlace(rows: GuildBarRow[], from: number, over: Over) {
    if (over.state !== 'before' && over.state !== 'after') return false
    const step = over.state === 'before' ? 1 : -1
    let neighbour = from + step
    while (isDragged(rows, from, neighbour)) neighbour += step
    if (neighbour !== over.index) return false
    const drag = rows[from]
    const target = rows[over.index]
    if (drag?.type !== 'guild' || !target) return true
    const folderId =
        target.type === 'guild'
            ? target.folder?.id
            : over.state === 'after' && target.showsGuilds
              ? target.item.folderId
              : undefined
    return folderId === drag.folder?.id
}

/**
 * Returns what the drag of row `from` is over with the finger at `y` (reference: useGuildsBarGesture).
 * The list is measured as drawn now, with the dragged rows gone and the gap open.
 * - Over the gap: nothing changes.
 * - Top or bottom half of a row: the gap moves above or under it.
 * - Middle 35-65% of a top-level server: makes a folder of the two.
 * - Middle of a closed folder: drops into it.
 * A dragged folder never goes into a folder, and an open folder counts as one row.
 * A drop that leaves the row where it was is `self`.
 */
export function computeOver(
    rows: GuildBarRow[],
    from: number,
    y: number,
    current: Over,
    full: number,
): Over {
    const self: Over = { index: from, state: 'self', before: false }
    const drag = rows[from]
    if (!drag) return self
    const gap = gapOf(from, current)
    const blocks: { first: number; last: number; top: number }[] = []
    let top = 0
    let gapTop = 0
    rows.forEach((row, index) => {
        if (index === gap.index && gap.above) {
            gapTop = top
            top += full
        }
        if (!isDragged(rows, from, index)) {
            const block = blocks.at(-1)
            if (
                drag.type === 'folder' &&
                row.type === 'guild' &&
                row.folder &&
                block
            )
                block.last = index
            else blocks.push({ first: index, last: index, top })
            top += full
        }
        if (index === gap.index && !gap.above) {
            gapTop = top
            top += full
        }
    })
    const at = Math.max(2, Math.min(y, top - 2))
    if (at >= gapTop && at < gapTop + full) return current
    const block = blocks.filter(candidate => candidate.top <= at).at(-1)
    const target = block && rows[block.first]
    if (!block || !target) return current
    const fraction = (at - block.top) / ((block.last - block.first + 1) * full)
    const above = gapTop < block.top
    const middle = fraction > 0.35 && fraction < 0.65
    let over: Over
    if (
        middle &&
        drag.type === 'guild' &&
        target.type === 'guild' &&
        !target.folder
    )
        over = {
            index: block.first,
            state: above ? 'convert-before' : 'convert-after',
            before: above,
        }
    else if (
        middle &&
        drag.type === 'guild' &&
        target.type === 'folder' &&
        !target.showsGuilds
    )
        over = { index: block.first, state: 'drop-into', before: above }
    else if (fraction < 0.5)
        over = { index: block.first, state: 'before', before: true }
    else over = { index: block.last, state: 'after', before: false }
    return inPlace(rows, from, over) ? self : over
}

/** Whether the drop goes into a folder (a closed one, or one a server makes with another) rather than into the gap. */
export const combines = (over: Over) =>
    over.state === 'drop-into' || over.state.startsWith('convert')

/**
 * Where the dragged row lands when let go (list coordinates): the gap, or the row it goes into, with the gap closed.
 */
export function dropTop(
    rows: GuildBarRow[],
    from: number,
    over: Over,
    full: number,
): number {
    const gap = gapOf(from, over)
    let count = 0
    for (let index = 0; index < gap.index; index++)
        if (!isDragged(rows, from, index)) count++
    if (over.state === 'after') count++
    return count * full
}

type Node = { type: 'guild'; id: string } | { type: 'folder'; id: string }

/** A new folder's id: the reference's GuildsTree.convertToFolder, a random 32-bit number. */
const newFolderId = () => String(Math.floor(4294967296 * Math.random()))

/**
 * The reference's SortedGuildStore moveById: `drag` taken out and put next to `target` (`moveNextTo`: in the folder
 * of a server in one), or with `combine` into the folder `target` is, or that a server `target` becomes
 * (`convertToFolder` + `moveInto`). A folder left without servers is removed.
 */
function moveById(
    items: GuildListItem[],
    drag: Node,
    target: Node,
    below: boolean,
    combine: boolean,
): GuildListItem[] {
    let moving: GuildListItem = {
        type: 'guild',
        key: drag.id,
        guildId: drag.id,
    }
    let list = items.flatMap((item): GuildListItem[] => {
        if (drag.type === 'folder') {
            if (item.type === 'folder' && item.folderId === drag.id) {
                moving = item
                return []
            }
            return [item]
        }
        if (item.type === 'guild') return item.guildId === drag.id ? [] : [item]
        return [
            { ...item, guildIds: item.guildIds.filter(id => id !== drag.id) },
        ]
    })
    const place = (ids: string[], at: number) => [
        ...ids.slice(0, at),
        drag.id,
        ...ids.slice(at),
    ]
    if (combine) {
        list = list.map((item): GuildListItem => {
            if (
                target.type === 'folder' &&
                item.type === 'folder' &&
                item.folderId === target.id
            )
                return {
                    ...item,
                    guildIds: place(
                        item.guildIds,
                        below ? item.guildIds.length : 0,
                    ),
                }
            if (
                target.type === 'guild' &&
                item.type === 'guild' &&
                item.guildId === target.id
            ) {
                const folderId = newFolderId()
                return {
                    type: 'folder',
                    key: `folder-${folderId}`,
                    folderId,
                    guildIds: place([target.id], below ? 1 : 0),
                }
            }
            return item
        })
    } else {
        const parent =
            target.type === 'guild'
                ? list.find(
                      (item): item is GuildFolderItem =>
                          item.type === 'folder' &&
                          item.guildIds.includes(target.id),
                  )
                : undefined
        if (parent && drag.type === 'guild') {
            list = list.map(item =>
                item === parent
                    ? {
                          ...parent,
                          guildIds: place(
                              parent.guildIds,
                              parent.guildIds.indexOf(target.id) +
                                  (below ? 1 : 0),
                          ),
                      }
                    : item,
            )
        } else {
            const at = list.findIndex(item =>
                parent
                    ? item === parent
                    : target.type === 'guild'
                      ? item.type === 'guild' && item.guildId === target.id
                      : item.type === 'folder' && item.folderId === target.id,
            )
            if (at === -1) return items
            list.splice(at + (below ? 1 : 0), 0, moving)
        }
    }
    return list.filter(
        item => item.type === 'guild' || item.guildIds.length > 0,
    )
}

/**
 * The list after the drag of row `from` is dropped `over` a row (the reference's handleGestureEnd), or null when it
 * goes nowhere. A server dropped right under an open folder's header becomes its first server.
 */
export function dropRow(
    items: GuildListItem[],
    rows: GuildBarRow[],
    from: number,
    over: Over,
): GuildListItem[] | null {
    const drag = rows[from]
    const target = rows[over.index]
    if (!drag || !target || over.state === 'self') return null
    let combine = over.state === 'drop-into' || over.state.startsWith('convert')
    let below = combine || over.state === 'after'
    const dragNode: Node =
        drag.type === 'folder'
            ? { type: 'folder', id: drag.item.folderId }
            : { type: 'guild', id: drag.guildId }
    let targetNode: Node =
        target.type === 'folder'
            ? { type: 'folder', id: target.item.folderId }
            : { type: 'guild', id: target.guildId }
    if (drag.type === 'folder' && target.type === 'guild' && target.folder)
        targetNode = { type: 'folder', id: target.folder.id }
    else if (
        drag.type === 'guild' &&
        target.type === 'folder' &&
        target.showsGuilds &&
        over.state === 'after'
    ) {
        combine = true
        below = false
    }
    if (dragNode.type === targetNode.type && dragNode.id === targetNode.id)
        return null
    return moveById(items, dragNode, targetNode, below, combine)
}
