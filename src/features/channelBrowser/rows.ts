import { ChannelType } from '../../core/discord/channelType'
import { Permission } from '../../core/discord/permissions'
import { isThread } from '../../stores/channels/channels'
import { can } from '../../stores/permissions'
import { fuzzysearch } from '../chat/composer/suggestions/search'
import { sortChannels } from '../servers/channelList'
import type { Session } from '../../core/session'
import type { Channel } from '../../stores/channels/channels'

export type BrowserRow =
    /** A category's header, or the top of the uncategorised channels when `id` is null. */
    | { type: 'category'; id: string | null }
    | {
          type: 'channel'
          id: string
          parentId: string | undefined
          first: boolean
          last: boolean
      }

/** Returns the channels the browser lists: what the user can see, without categories, threads and directories. */
export function browsableChannels(
    ids: readonly string[],
    channels: Record<string, Channel>,
    session: Session,
): Channel[] {
    return ids.flatMap(id => {
        const channel = channels[id]
        if (
            !channel ||
            isThread(channel) ||
            channel.type === ChannelType.GUILD_CATEGORY ||
            channel.type === ChannelType.GUILD_DIRECTORY ||
            !can(session, id, Permission.VIEW_CHANNEL)
        )
            return []
        return [channel]
    })
}

/** useFilterCategoriesByQuery: the name matches fuzzily, or the topic has the query. */
function matches(channel: Channel, query: string): boolean {
    if (!query) return true
    return (
        fuzzysearch(query, (channel.name ?? '').toLowerCase()) ||
        (channel.topic ?? '').toLowerCase().includes(query)
    )
}

/**
 * ChannelBrowser's list: the uncategorised channels, then each category with its channels (useChannelBrowserSections).
 * Categories left without a channel are dropped.
 */
export function buildBrowserRows(
    ids: readonly string[],
    channels: Record<string, Channel>,
    session: Session,
    query: string,
): BrowserRow[] {
    const lowered = query.toLowerCase()
    const byParent = new Map<string | null, Channel[]>()
    for (const channel of browsableChannels(ids, channels, session)) {
        if (!matches(channel, lowered)) continue
        const key = channel.parent_id ?? null
        const list = byParent.get(key)
        if (list) list.push(channel)
        else byParent.set(key, [channel])
    }
    const categories = sortChannels(
        ids.flatMap(id => {
            const channel = channels[id]
            return channel?.type === ChannelType.GUILD_CATEGORY ? [channel] : []
        }),
    )
    const rows: BrowserRow[] = []
    for (const categoryId of [null, ...categories.map(c => c.id)]) {
        const list = byParent.get(categoryId)
        if (!list?.length) continue
        rows.push({ type: 'category', id: categoryId })
        for (const [index, channel] of sortChannels(list).entries())
            rows.push({
                type: 'channel',
                id: channel.id,
                parentId: channel.parent_id ?? undefined,
                first: index === 0,
                last: index === list.length - 1,
            })
    }
    return rows
}
