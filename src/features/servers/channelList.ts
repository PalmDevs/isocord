import { ChannelFlags } from '../../core/discord/channelFlags'
import { ChannelType } from '../../core/discord/channelType'
import { GuildFeature } from '../../core/discord/guild'
import { UnreadSetting } from '../../core/discord/notificationSettings'
import { Permission } from '../../core/discord/permissions'
import { compareSnowflakes } from '../../core/discord/snowflake'
import { autoArchiveTime } from '../../core/discord/threads'
import { isThread, isVoice } from '../../stores/channels/channels'
import { can } from '../../stores/permissions'
import { isUnread } from '../../stores/readStates'
import { isFavorite } from '../../stores/settings/userGuildSettings'
import {
    isChannelMuted,
    isChannelOrParentOptedIn,
    isOptInEnabledForGuild,
    isThreadMuted,
    resolveUnreadSetting,
} from '../../stores/unreadPolicy'
import type { Session } from '../../core/session'
import type { Channel } from '../../stores/channels/channels'
import type { Guild } from '../../stores/guilds'
import type { ReadStatesState } from '../../stores/readStates'
import type { GuildSettings } from '../../stores/settings/userGuildSettings'
import type { BarRow } from './useUnreadBars'

export type ChannelRow =
    | { type: 'category'; id: string; collapsed: boolean }
    | { type: 'channel'; id: string }
    | { type: 'thread'; id: string; first: boolean; last: boolean }
    /** GuildRolesAndChannelsRow, the "Browse Channels" row of community servers. */
    | { type: 'browse'; id: 'browse' }
    /** The Divider under the guild actions, and under the pinned channels when more channels follow. */
    | { type: 'divider'; id: 'actionsDivider' | 'pinnedDivider' }
    /** ChannelListState's FAVORITES section header ("Pinned Channels"), over the channels pinned to the top. */
    | { type: 'pinned'; id: 'pinnedHeader' }
    /** A spacer row, between the guild header and the actions. */
    | { type: 'spacer'; id: 'actionsSpacer' }

const byPosition = (a: Channel, b: Channel) =>
    (a.position ?? 0) - (b.position ?? 0) || compareSnowflakes(a.id, b.id)

/** Orders the channels of one category: text channels, then voice, each by position. */
export const sortChannels = (list: readonly Channel[]) => [
    ...list.filter(c => !isVoice(c)).sort(byPosition),
    ...list.filter(isVoice).sort(byPosition),
]

// The reference's GUILD_SELECTABLE_CHANNEL_TYPES, minus threads (GuildChannelStore only
// sorts the guild's own channels), store/directory, and forum/media, which the chat
// panel can't show yet (add them back with the post list).
const SELECTABLE_TYPES: ReadonlySet<number> = new Set([
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
])

/**
 * The channel a server opens on when none was selected in it: the first selectable
 * channel by raw `position` the user can view, as the reference's
 * GuildChannelStore.getDefaultChannel (SelectedChannelStore.getChannelId falls back to it).
 */
export function defaultChannelId(
    _guild: Guild,
    ids: string[],
    channels: Record<string, Channel>,
    session: Session,
): string | undefined {
    let best: Channel | undefined
    for (const id of ids) {
        const channel = channels[id]
        if (!channel || !SELECTABLE_TYPES.has(channel.type)) continue
        if (best && byPosition(channel, best) >= 0) continue
        if (can(session, id, Permission.VIEW_CHANNEL)) best = channel
    }
    return best?.id
}

/**
 * ActiveJoinedThreadsStore.parseThreadState's isRelevant: a joined thread is listed while its auto-archive time is
 * ahead, or while it is pinned, unread and not muted, or mentions the user. The server archives it later, so a
 * cached thread past that time is hidden before READY drops it.
 */
function isRelevantThread(
    thread: Channel,
    readStates: ReadStatesState,
    now: number,
): boolean {
    const metadata = thread.thread_metadata
    const lastMessageId =
        readStates.lastMessageIds[thread.id] ??
        thread.last_message_id ??
        undefined
    return (
        (!metadata?.archived &&
            autoArchiveTime(thread.id, metadata, lastMessageId) > now) ||
        ((thread.flags ?? 0) & ChannelFlags.PINNED) !== 0 ||
        (isUnread(readStates, thread.id) &&
            !isThreadMuted(thread.member, now)) ||
        (readStates.mentions[thread.id] ?? 0) > 0
    )
}

/**
 * Flattens a guild's channels into list rows.
 * Order: pinned channels, uncategorised channels, then each category (text before voice), joined threads under their parent.
 * Channels the user cannot view and empty categories are left out.
 * With opt-in channels on, only the picked channels and categories are listed, and the ones with mentions.
 * The selected channel is always listed (ChannelListState.computeThreadIds).
 * An unjoined thread held by holdThread goes first under its parent.
 * A collapsed category keeps the parent of the selected thread.
 */
export function buildChannelRows(
    guild: Guild,
    ids: string[],
    channels: Record<string, Channel>,
    settings: GuildSettings | undefined,
    session: Session,
    selectedChannelId: string | undefined,
    readStates: ReadStatesState,
): ChannelRow[] {
    const { mentions } = readStates
    const now = Date.now()
    const selected = selectedChannelId ? channels[selectedChannelId] : undefined
    const selectedThread =
        selected && isThread(selected) && selected.guild_id === guild.id
            ? selected
            : undefined
    const policy = { guildSettings: settings ? { [guild.id]: settings } : {} }
    const optIn = isOptInEnabledForGuild(policy, guild)
    // ChannelListState's renderLevel. The reference moves the unpicked ones it shows into a Recents category.
    const listed = (channel: Channel) =>
        !optIn ||
        isChannelOrParentOptedIn(policy, channel) ||
        channel.id === selectedChannelId ||
        selectedThread?.parent_id === channel.id ||
        (mentions[channel.id] ?? 0) > 0

    const categories: Channel[] = []
    const pinned: Channel[] = []
    const children = new Map<string | null, Channel[]>()
    const threads = new Map<string, Channel[]>()
    for (const id of ids) {
        const channel = channels[id]
        if (!channel) continue
        if (isThread(channel)) {
            if (!isRelevantThread(channel, readStates, now)) continue
            const list = threads.get(channel.parent_id ?? '')
            if (list) list.push(channel)
            else threads.set(channel.parent_id ?? '', [channel])
        } else if (channel.type === ChannelType.GUILD_CATEGORY) {
            categories.push(channel)
        } else if (can(session, id, Permission.VIEW_CHANNEL)) {
            // A pinned channel is in the pinned section only, whatever the opt-in picks and its category's collapse.
            if (isFavorite(settings, id)) {
                pinned.push(channel)
                continue
            }
            if (!listed(channel)) continue
            const key = channel.parent_id ?? null
            const list = children.get(key)
            if (list) list.push(channel)
            else children.set(key, [channel])
        }
    }

    const rows: ChannelRow[] = []
    // useGuildActionRows: CHANNELS_AND_ROLES in community servers that are not hubs.
    if (
        guild.features?.includes(GuildFeature.COMMUNITY) &&
        !guild.features.includes(GuildFeature.HUB)
    )
        rows.push(
            { type: 'spacer', id: 'actionsSpacer' },
            { type: 'browse', id: 'browse' },
            { type: 'divider', id: 'actionsDivider' },
        )
    const pushChannels = (list: Channel[] | undefined, collapsed: boolean) => {
        if (!list) return
        for (const channel of sortChannels(list)) {
            const holdsSelected = selectedThread?.parent_id === channel.id
            // A collapsed category still shows the channel the user is in.
            if (collapsed && channel.id !== selectedChannelId && !holdsSelected)
                continue
            rows.push({ type: 'channel', id: channel.id })
            // Newest thread first.
            const shown = (threads.get(channel.id) ?? []).sort((a, b) =>
                compareSnowflakes(b.id, a.id),
            )
            if (
                selectedThread &&
                holdsSelected &&
                !shown.some(thread => thread.id === selectedThread.id)
            )
                shown.unshift(selectedThread)
            for (const [index, thread] of shown.entries()) {
                rows.push({
                    type: 'thread',
                    id: thread.id,
                    first: index === 0,
                    last: index === shown.length - 1,
                })
            }
        }
    }

    // The FAVORITES section comes after the guild actions, before the channels without a category.
    if (pinned.length > 0) {
        rows.push({ type: 'pinned', id: 'pinnedHeader' })
        pushChannels(pinned, false)
        rows.push({ type: 'divider', id: 'pinnedDivider' })
    }
    const pinnedEnd = rows.length
    pushChannels(children.get(null), false)
    for (const category of categories.sort(byPosition)) {
        const list = children.get(category.id)
        if (!list?.length) continue
        const collapsed = Boolean(settings?.collapsedCategories[category.id])
        rows.push({ type: 'category', id: category.id, collapsed })
        pushChannels(list, collapsed)
    }
    // No divider under the pinned channels when nothing follows them.
    if (rows.length === pinnedEnd && rows.at(-1)?.id === 'pinnedDivider')
        rows.pop()
    return rows
}

/**
 * Returns the channels and threads ChannelsUnreadBars can point to, with their list indexes.
 */
export function buildBarRows(
    guildId: string,
    rows: ChannelRow[],
    channels: Record<string, Channel>,
    guildDefault: number | undefined,
    readStates: ReadStatesState,
    settings: GuildSettings | undefined,
    joinedAck: string,
    newNotifications: boolean | undefined,
): BarRow[] {
    const policy = {
        guildSettings: settings ? { [guildId]: settings } : {},
        newNotifications,
    }
    const now = Date.now()
    const barRows: BarRow[] = []
    for (const [index, row] of rows.entries()) {
        if (row.type !== 'channel' && row.type !== 'thread') continue
        const channel = channels[row.id]
        if (!channel) continue
        // ChannelsUnreadBars uses the resolved unread setting for plain unreads.
        const mention = (readStates.mentions[row.id] ?? 0) > 0
        const barUnread =
            isUnread(readStates, row.id, joinedAck) &&
            (row.type === 'thread'
                ? !isThreadMuted(channel.member, now)
                : !isVoice(channel) &&
                  !isChannelMuted(policy, channel, now) &&
                  resolveUnreadSetting(policy, channel, guildDefault) ===
                      UnreadSetting.ALL_MESSAGES)
        if (mention || barUnread) barRows.push({ index, mention })
    }
    return barRows
}
