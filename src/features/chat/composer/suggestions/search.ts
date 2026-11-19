import { ChannelType } from '../../../../core/discord/channelType'
import { memberCanView, Permission } from '../../../../core/discord/permissions'
import { isPrivate, isThread } from '../../../../stores/channels/channels'
import { can } from '../../../../stores/permissions'
import { displayName } from '../../../../stores/users'
import { emojiSuggestionsFor, getExpressionContext } from '../../../expressions'
import type { Session } from '../../../../core/session'
import type { Channel } from '../../../../stores/channels/channels'
import type { Guild } from '../../../../stores/guilds'
import type { Member } from '../../../../stores/members'
import type { Message } from '../../../../stores/readStates'
import type { User } from '../../../../stores/users'
import type { SearchEmoji, Sticker } from '../../../expressions'

/** MAX_AUTOCOMPLETE_RESULTS of the reference. */
export const MAX_RESULTS = 10
/** EmojiSuggestionBarSmall: three emojis (sortEmojisForDisplay(..., 3)). */
const BAR_MAX_EMOJIS = 3

export type Item =
    | { key: string; kind: 'emoji'; emoji: SearchEmoji }
    | { key: string; kind: 'user'; user: User; name: string }
    | { key: string; kind: 'role'; name: string; color?: number }
    | { key: string; kind: 'special'; name: 'everyone' | 'here' }
    | { key: string; kind: 'channel'; channel: Channel }

export interface Suggestion {
    /** Text range replaced when an item is picked. */
    start: number
    end: number
    /** The bar for the plain-word emoji rule is a row of chips, the rest are a list. */
    bar: boolean
    items: Item[]
    /** The `:name` autocomplete (EMOJIS_AND_STICKERS): the name typed, shown in its section titles. */
    query?: string
    /** Its stickers, a row above the emojis. */
    stickers?: Sticker[]
}

/** What the suggestions are searched in: the session's state for the channel typed in. */
interface SearchScope {
    session: Session
    channelId: string
    channel: Channel
    channels: Record<string, Channel>
    byGuild: Record<string, string[]>
    guild: Guild | undefined
    members: Record<string, Member> | undefined
    users: Record<string, User>
    /** The channel's loaded messages, newest first. */
    messages: Message[] | undefined
}

/** The `@` being typed right before the cursor: what follows it. */
export const MENTION = /(?:^|\s)@([^\s@]{0,32})$/
/** The `#` being typed right before the cursor: what follows it. */
const CHANNEL_MENTION = /(?:^|\s)#([^\s#@<>"]{0,100})$/

/** Lower is better: exact, prefix, word start, anywhere; -1 when it does not match. */
function matchRank(name: string, query: string): number {
    const lowered = name.toLowerCase()
    if (lowered === query) return 0
    if (lowered.startsWith(query)) return 1
    if (new RegExp(`[\\s_.-]${escapeRegex(query)}`).test(lowered)) return 2
    return lowered.includes(query) ? 3 : -1
}
const escapeRegex = (text: string) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The fuzzysearch package of the reference: whether `needle`'s characters all appear in `haystack`, in order. */
export function fuzzysearch(needle: string, haystack: string): boolean {
    if (needle.length > haystack.length) return false
    let from = 0
    for (const char of needle) {
        from = haystack.indexOf(char, from) + 1
        if (from === 0) return false
    }
    return true
}

/** StringUtils.stripDiacritics. */
const stripDiacritics = (text: string) =>
    text.normalize('NFD').replace(/\p{M}/gu, '')

/** queryMemberList's cap on the names that only match fuzzily. */
const MAX_FUZZY_USERS = 50

/**
 * AutocompleteUtils.queryMemberList: the users with a nickname, display name or username that starts with
 * `query` (diacritics stripped or not), sorted by name, and after them, while there is room, the ones whose names
 * only contain its characters in order. A name is sorted by its display name first, as there.
 */
export function queryMemberList(
    query: string,
    candidates: Array<{ user: User; nick: string | null | undefined }>,
    limit: number,
): Array<{ user: User; nick: string | null | undefined }> {
    type Entry = { user: User; nick: string | null | undefined; sort: string }
    const prefix: Entry[] = []
    const fuzzy: Entry[] = []
    for (const { user, nick } of candidates) {
        const names = [user.username, nick, user.global_name]
            .filter((name): name is string => !!name)
            .map(name => name.toLocaleLowerCase())
        const stripped = names.map(stripDiacritics)
        const sort = stripDiacritics(
            (user.global_name ?? nick ?? user.username).toLocaleLowerCase(),
        )
        if ([...names, ...stripped].some(name => name.startsWith(query)))
            prefix.push({ user, nick, sort })
        else if (
            fuzzy.length < MAX_FUZZY_USERS &&
            stripped.some(name => fuzzysearch(query, name))
        )
            fuzzy.push({ user, nick, sort })
    }
    const bySort = (a: Entry, b: Entry) =>
        a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0
    prefix.sort(bySort)
    fuzzy.sort(bySort)
    return [...prefix, ...fuzzy].slice(0, limit)
}

/** Returns the suggestion for the text before the cursor: mentions, channels or emojis, or null. */
export function findSuggestion(
    scope: SearchScope,
    text: string,
    cursor: number,
    wordEmojis: boolean,
): Suggestion | null {
    const before = text.slice(0, cursor)
    const mention = MENTION.exec(before)
    if (mention) {
        const typed = mention[1] ?? ''
        const items = mentionItems(scope, typed.toLocaleLowerCase())
        const start = cursor - typed.length - 1
        return items.length > 0
            ? { start, end: cursor, bar: false, items }
            : null
    }
    const hash = CHANNEL_MENTION.exec(before)
    if (hash && scope.guild) {
        const typed = hash[1] ?? ''
        const items = channelItems(scope, scope.guild, typed.toLowerCase())
        const start = cursor - typed.length - 1
        return items.length > 0
            ? { start, end: cursor, bar: false, items }
            : null
    }
    return emojiSuggestion(scope, text, cursor, wordEmojis)
}

/** AutocompleteUtils.queryMentionResults: the users, then @everyone and @here, then the roles, ten in all. */
function mentionItems(scope: SearchScope, query: string): Item[] {
    const { channel, channels, guild } = scope
    // A thread's members and permissions are its parent's (queryChannelUsers).
    const parent =
        isThread(channel) && channel.parent_id
            ? (channels[channel.parent_id] ?? channel)
            : channel
    const found = userItems(scope, parent, query)
    if (!guild) return found
    const mentionAll = can(
        scope.session,
        scope.channelId,
        Permission.MENTION_EVERYONE,
    )
    const roles = roleItems(guild, query, mentionAll).slice(
        0,
        MAX_RESULTS - found.length,
    )
    const globals: Item[] = []
    if (mentionAll)
        for (const name of ['everyone', 'here'] as const)
            if (
                found.length + roles.length + globals.length < MAX_RESULTS &&
                fuzzysearch(query, name)
            )
                globals.push({ key: name, kind: 'special', name })
    return [...found, ...globals, ...roles]
}

const userItem = (user: User, nick: string | null | undefined): Item => ({
    key: `u${user.id}`,
    kind: 'user',
    user,
    // Inserts a name parse.ts will find again: nickname first, as it does.
    name: displayName(user, nick),
})

/** queryChannelUsers: the users who may be mentioned in the channel (`parent` for a thread). */
function userItems(scope: SearchScope, parent: Channel, query: string): Item[] {
    const { session, guild, members, users, messages } = scope
    if (isPrivate(parent)) {
        // queryChannelUsers in a DM: its recipients and the current user.
        const candidates = [
            ...(parent.recipient_ids ?? []),
            session.userId,
        ].flatMap(id => (users[id] ? [{ user: users[id], nick: null }] : []))
        return queryMemberList(query, candidates, MAX_RESULTS).map(
            ({ user, nick }) => userItem(user, nick),
        )
    }
    // With nothing typed: the channel's recent authors who are members, newest first.
    const recent: Item[] = []
    if (query === '') {
        const seen = new Set<string>()
        for (const message of messages ?? []) {
            const id = message.author.id
            if (seen.has(id)) continue
            seen.add(id)
            const user = users[id] ?? message.author
            if (members?.[id]) recent.push(userItem(user, members[id].nick))
            if (recent.length === MAX_RESULTS) break
        }
    }
    if (recent.length > 0) return recent
    // The members held for the server who may see the channel (its VIEW_CHANNEL filter).
    const candidates: Array<{ user: User; nick: string | null | undefined }> =
        []
    for (const [id, member] of Object.entries(members ?? {})) {
        const user = users[id]
        if (user && (!guild || memberCanView(guild, parent, id, member.roles)))
            candidates.push({ user, nick: member.nick })
    }
    return queryMemberList(query, candidates, MAX_RESULTS).map(
        ({ user, nick }) => userItem(user, nick),
    )
}

/**
 * Roles that are mentionable, or all of them for those who may mention everyone, highest first, whose names hold
 * the query's characters in order. The closest matches first (matchSorter).
 */
function roleItems(guild: Guild, query: string, mentionAll: boolean): Item[] {
    const ranked: Array<{ rank: number; item: Item }> = []
    const sorted = Object.values(guild.roles).sort(
        (a, b) => (b.position ?? 0) - (a.position ?? 0),
    )
    for (const role of sorted) {
        if (role.id === guild.id || !role.name) continue
        if (!role.mentionable && !mentionAll) continue
        const lowered = role.name.toLowerCase()
        if (!fuzzysearch(query, lowered)) continue
        const rank = query === '' ? 0 : matchRank(lowered, query)
        ranked.push({
            rank: rank < 0 ? 4 : rank,
            item: {
                key: `r${role.id}`,
                kind: 'role',
                name: role.name,
                color: role.color,
            },
        })
    }
    // Stable, so the roles keep their order within a rank.
    ranked.sort((a, b) => a.rank - b.rank)
    return ranked.map(({ item }) => item)
}

/** The server's channels the user can see whose names match, in the server's order within a rank. */
function channelItems(scope: SearchScope, guild: Guild, query: string): Item[] {
    const { session, channels, byGuild } = scope
    const ranked: Array<{ rank: number; channel: Channel }> = []
    for (const id of byGuild[guild.id] ?? []) {
        const other = channels[id]
        if (
            !other?.name ||
            other.type === ChannelType.GUILD_CATEGORY ||
            !can(session, id, Permission.VIEW_CHANNEL)
        )
            continue
        const rank = query === '' ? 3 : matchRank(other.name, query)
        if (rank >= 0) ranked.push({ rank, channel: other })
    }
    // Stable sort keeps the server's channel order within a rank.
    ranked.sort((a, b) => a.rank - b.rank)
    return ranked
        .slice(0, MAX_RESULTS)
        .map(({ channel }) => ({ key: channel.id, kind: 'channel', channel }))
}

/** The emoji bar for a plain word (when `wordEmojis`), or the `:name` autocomplete with its stickers. */
function emojiSuggestion(
    { session, channelId }: SearchScope,
    text: string,
    cursor: number,
    wordEmojis: boolean,
): Suggestion | null {
    const found = emojiSuggestionsFor(
        text.slice(0, cursor),
        getExpressionContext(session, channelId),
        { textAfterCursor: text.slice(cursor) },
    )
    if (!found || (found.kind === 'word' && !wordEmojis)) return null
    const items = found.unlocked
        .slice(0, found.kind === 'word' ? BAR_MAX_EMOJIS : undefined)
        .map<Item>(emoji => ({
            key: `e${emoji.type === 'custom' ? emoji.id : emoji.uniqueName}`,
            kind: 'emoji',
            emoji,
        }))
    if (found.kind === 'word')
        return items.length > 0
            ? { start: found.start, end: found.end, bar: true, items }
            : null
    const stickers = found.stickers.map(result => result.sticker)
    return items.length > 0 || stickers.length > 0
        ? {
              start: found.start,
              end: found.end,
              bar: false,
              items,
              query: found.query,
              stickers,
          }
        : null
}
