import { ChannelType } from '../../../core/discord/channelType'
import { ComponentType } from '../../../core/discord/components'
import { Permission } from '../../../core/discord/permissions'
import { channelsStore, isPrivate } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { membersStore } from '../../../stores/members'
import { can } from '../../../stores/permissions'
import { displayName, usersStore } from '../../../stores/users'
import { fuzzysearch, queryMemberList } from '../composer/suggestions/search'
import {
    channelAllowed,
    channelOption,
    roleOption,
    userOption,
} from './selectOptions'
import type { Session } from '../../../core/session'
import type { User } from '../../../stores/users'
import type { ApiComponent } from './apiComponent'
import type { SelectLookup, SelectOption } from './selectOptions'

/** queryMentionables and queryChannels: how many options a search lists. */
const QUERY_LIMIT = 15

/** The chat's users, server and channels, read from the session's stores. */
export function sessionLookup(
    session: Session,
    channelId: string,
): SelectLookup {
    const channels = session.get(channelsStore).getState().channels
    const guildId = channels[channelId]?.guild_id
    const members = guildId
        ? session.get(membersStore).getState().members[guildId]
        : undefined
    return {
        users: session.get(usersStore).getState().users,
        guild: guildId
            ? session.get(guildsStore).getState().guilds[guildId]
            : undefined,
        channels,
        nameOf: (user: User) => displayName(user, members?.[user.id]?.nick),
    }
}

/** queryMentionResults' users: the DM's people, or the server's members held here. */
function queryUsers(
    session: Session,
    channelId: string,
    lookup: SelectLookup,
    query: string,
): SelectOption[] {
    const channel = lookup.channels[channelId]
    const members = lookup.guild
        ? session.get(membersStore).getState().members[lookup.guild.id]
        : undefined
    const ids =
        channel && isPrivate(channel)
            ? [...(channel.recipient_ids ?? []), session.userId]
            : Object.keys(members ?? {})
    const candidates = ids.flatMap(id => {
        const user = lookup.users[id]
        return user ? [{ user, nick: members?.[id]?.nick }] : []
    })
    return queryMemberList(query, candidates, QUERY_LIMIT).map(({ user }) =>
        userOption(user, lookup),
    )
}

/** queryMentionResults' roles with includeNonMentionableRoles: every role but @everyone, highest first. */
function queryRoles(lookup: SelectLookup, query: string): SelectOption[] {
    const guild = lookup.guild
    if (!guild) return []
    return Object.values(guild.roles)
        .filter(
            role =>
                role.id !== guild.id &&
                role.name &&
                fuzzysearch(query, role.name.toLowerCase()),
        )
        .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
        .map(role => roleOption(role.id, role.name ?? ''))
}

/** queryApplicationCommandChannelResults: the server's channels the user can see, of the select's types. */
function queryChannels(
    session: Session,
    c: ApiComponent,
    lookup: SelectLookup,
    query: string,
): SelectOption[] {
    const guild = lookup.guild
    if (!guild) return []
    const ids = session.get(channelsStore).getState().byGuild[guild.id] ?? []
    return ids
        .flatMap(id => {
            const channel = lookup.channels[id]
            return channel &&
                channel.type !== ChannelType.GUILD_CATEGORY &&
                channelAllowed(c, channel) &&
                fuzzysearch(query, (channel.name ?? '').toLowerCase()) &&
                can(session, id, Permission.VIEW_CHANNEL)
                ? [channelOption(channel, lookup)]
                : []
        })
        .slice(0, QUERY_LIMIT)
}

/** queryMentionables and queryChannels: the options a user, role, mentionable or channel select lists for `query`. */
export function querySelectOptions(
    session: Session,
    channelId: string,
    c: ApiComponent,
    query: string,
): SelectOption[] {
    const lookup = sessionLookup(session, channelId)
    const lowered = query.toLocaleLowerCase()
    if (c.type === ComponentType.CHANNEL_SELECT)
        return queryChannels(session, c, lookup, lowered)
    const users =
        c.type === ComponentType.ROLE_SELECT
            ? []
            : queryUsers(session, channelId, lookup, lowered)
    const roles =
        c.type === ComponentType.USER_SELECT ? [] : queryRoles(lookup, lowered)
    return [...users, ...roles].slice(0, QUERY_LIMIT)
}
