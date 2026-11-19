import { ChannelType } from '../../core/discord/channelType'
import { canSendMessages, Permission } from '../../core/discord/permissions'
import { compareSnowflakes } from '../../core/discord/snowflake'
import { t } from '../../i18n'
import { computeChannelName } from '../../stores/channels/channelName'
import { channelsStore, isPrivate } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { channelPermissions } from '../../stores/permissions'
import { readStatesStore } from '../../stores/readStates'
import { usersStore } from '../../stores/users'
import type { Session } from '../../core/session'
import type { Channel } from '../../stores/channels/channels'
import type { User } from '../../stores/users'

/**
 * ShareConstants.ALLOWED_TYPES: DMs, group DMs, text and voice channels and threads.
 * Forums and media channels take posts, not messages (canShareToChannel).
 */
const DESTINATION_TYPES: ReadonlySet<number> = new Set([
    ChannelType.DM,
    ChannelType.GROUP_DM,
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.GUILD_VOICE,
    ChannelType.GUILD_STAGE_VOICE,
    ChannelType.ANNOUNCEMENT_THREAD,
    ChannelType.PUBLIC_THREAD,
    ChannelType.PRIVATE_THREAD,
])

/** formatResults: places shown before a search, the picked ones included. */
const RECENT_COUNT = 15

/** Ranks of a search match: a channel's own name beats its server's. */
const Rank = {
    NAME_PREFIX: 0,
    NAME: 1,
    GUILD_PREFIX: 2,
    GUILD: 3,
    /** Every word is in the name or the server's name. */
    WORDS: 4,
} as const

/** What a forward or share carries, which some channels refuse (getDestinationIsUnavailable). */
export interface Payload {
    attachments: boolean
    embeds: boolean
    voiceMessage: boolean
}

/** A place a forward or share can go. */
export interface Destination {
    channel: Channel
    name: string
    /** A server channel's server. */
    guildName?: string
    /** A DM's other user. */
    user?: User
    /** Why it can't be picked, shown under its name. */
    unavailable?: string
    /** Newest message, by id. */
    recency: string | undefined
    mentions: number
}

/** getDestinationIsUnavailable: a server channel that refuses part of the payload. Not ported: age-restricted channels, stickers. */
function unavailableReason(
    channel: Channel,
    permissions: bigint,
    payload: Payload,
): string | undefined {
    if (isPrivate(channel)) return undefined
    const lacks = (bit: bigint) => (permissions & bit) === 0n
    if (payload.attachments && lacks(Permission.ATTACH_FILES))
        return t('share.unavailable.attachments')
    if (payload.embeds && lacks(Permission.EMBED_LINKS))
        return t('share.unavailable.embeds')
    if (payload.voiceMessage && lacks(Permission.SEND_VOICE_MESSAGES))
        return t('share.unavailable.voiceMessages')
    return undefined
}

/**
 * Returns every place the user can send to (canShareToChannel), but `excludeId`.
 * Read once per screen: working out each channel's permissions is too slow for every keystroke.
 */
export function shareDestinations(
    session: Session,
    payload: Payload,
    excludeId?: string,
): Destination[] {
    const { channels, privateIds, byGuild } = session
        .get(channelsStore)
        .getState()
    const { guilds } = session.get(guildsStore).getState()
    const { users } = session.get(usersStore).getState()
    const { lastMessageIds, mentions } = session.get(readStatesStore).getState()
    const ids = [...privateIds, ...Object.values(byGuild).flat()]
    return ids.flatMap(id => {
        const channel = channels[id]
        if (!channel || id === excludeId) return []
        if (!DESTINATION_TYPES.has(channel.type)) return []
        const permissions = channelPermissions(session, id)
        if (!isPrivate(channel) && !canSendMessages(channel, permissions))
            return []
        const destination: Destination = {
            channel,
            name: computeChannelName(channel, users),
            guildName: channel.guild_id
                ? guilds[channel.guild_id]?.name
                : undefined,
            user:
                channel.type === ChannelType.DM
                    ? users[channel.recipient_ids?.[0] ?? '']
                    : undefined,
            unavailable: unavailableReason(channel, permissions, payload),
            recency: lastMessageIds[id] ?? channel.last_message_id ?? undefined,
            mentions: mentions[id] ?? 0,
        }
        return [destination]
    })
}

/** Unread mentions first, then the newest message. */
const byRecency = (a: Destination, b: Destination) =>
    Number(b.mentions > 0) - Number(a.mentions > 0) ||
    compareSnowflakes(b.recency, a.recency)

/** The search's rank for a destination, or undefined when it does not match. */
function matchRank(
    destination: Destination,
    query: string,
): number | undefined {
    const names = [destination.name, destination.user?.username ?? '']
        .filter(Boolean)
        .map(name => name.toLowerCase())
    const guild = destination.guildName?.toLowerCase() ?? ''
    if (names.some(name => name.startsWith(query))) return Rank.NAME_PREFIX
    if (names.some(name => name.includes(query))) return Rank.NAME
    if (guild.startsWith(query)) return Rank.GUILD_PREFIX
    if (guild.includes(query)) return Rank.GUILD
    const words = query.split(/\s+/)
    const haystack = `${names.join(' ')} ${guild}`
    if (words.length > 1 && words.every(word => haystack.includes(word)))
        return Rank.WORDS
    return undefined
}

/**
 * formatResults: before a search, the picked places, then the most recent ones.
 * Unlike the reference (quick switcher history, then frecency), recent means unread mentions, then newest messages.
 * A search matches channel and DM names first, then server names, newest first within each rank.
 */
export function rankDestinations(
    all: Destination[],
    query: string,
    pinned: string[],
): Destination[] {
    // getQuickSwitcherOptions' mode prefixes are not modes here: "#general" finds general.
    const search = query
        .trim()
        .toLowerCase()
        .replace(/^[#@*!]/, '')
    if (search !== '')
        return all
            .flatMap(destination => {
                const rank = matchRank(destination, search)
                return rank === undefined ? [] : [{ destination, rank }]
            })
            .sort(
                (a, b) =>
                    a.rank - b.rank || byRecency(a.destination, b.destination),
            )
            .map(({ destination }) => destination)
    const byId = new Map(all.map(item => [item.channel.id, item]))
    const first = pinned.flatMap(id => byId.get(id) ?? [])
    const rest = all
        .filter(item => !pinned.includes(item.channel.id))
        .sort(byRecency)
    return [...first, ...rest].slice(0, Math.max(RECENT_COUNT, first.length))
}
