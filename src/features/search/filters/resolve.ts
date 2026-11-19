import { t } from '../../../i18n'
import { computeChannelName } from '../../../stores/channels/channelName'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { membersStore } from '../../../stores/members'
import { displayName, usersStore } from '../../../stores/users'
import { FILTERS, SELF_USER, SNOWFLAKE } from './catalog'
import { filterDateLabel, formatFilterDate, parseFilterDate } from './query'
import type { Session } from '../../../core/session'
import type { SearchContext } from '../types'
import type { FilterKind, SearchFilter } from './catalog'

export type ResolvedFilter = Omit<SearchFilter, 'id'>

const guildOf = (context: SearchContext) =>
    context.type === 'GUILD_CHANNEL' ? context.guildId : undefined

/**
 * A user by id, `@me`, or by username, display name or nickname. The name shown is the nickname, else the display
 * name.
 */
function resolveUser(
    session: Session,
    context: SearchContext,
    kind: FilterKind,
    raw: string,
): ResolvedFilter | null {
    const users = session.get(usersStore).getState().users
    const guildId = guildOf(context)
    const members = guildId
        ? session.get(membersStore).getState().members[guildId]
        : undefined
    const nameOf = (id: string) =>
        users[id] ? displayName(users[id], members?.[id]?.nick) : id
    if (SNOWFLAKE.test(raw)) return { kind, value: raw, label: nameOf(raw) }
    if (raw.toLowerCase() === SELF_USER)
        return { kind, value: session.userId, label: nameOf(session.userId) }
    const needle = raw.replace(/^@/, '').toLowerCase()
    const match = Object.values(users).find(user =>
        [user.username, user.global_name, members?.[user.id]?.nick].some(
            name => name?.toLowerCase() === needle,
        ),
    )
    return match ? { kind, value: match.id, label: nameOf(match.id) } : null
}

/** A channel by id, or by name: the guild's channels, or in the DMs search the DMs. */
function resolveChannel(
    session: Session,
    context: SearchContext,
    kind: FilterKind,
    raw: string,
): ResolvedFilter | null {
    const { channels, byGuild, privateIds } = session
        .get(channelsStore)
        .getState()
    const users = session.get(usersStore).getState().users
    const guildId = guildOf(context)
    const nameOf = (id: string) => {
        const channel = channels[id]
        if (!channel) return id
        return guildId
            ? (channel.name ?? id)
            : computeChannelName(channel, users)
    }
    if (SNOWFLAKE.test(raw)) return { kind, value: raw, label: nameOf(raw) }
    const needle = raw.replace(/^#/, '').toLowerCase()
    const ids = guildId ? (byGuild[guildId] ?? []) : privateIds
    const id = ids.find(candidate => nameOf(candidate).toLowerCase() === needle)
    return id ? { kind, value: id, label: nameOf(id) } : null
}

/** A role of the guild by id or name. */
function resolveRole(
    session: Session,
    context: SearchContext,
    kind: FilterKind,
    raw: string,
): ResolvedFilter | null {
    const guildId = guildOf(context)
    const roles = guildId
        ? (session.get(guildsStore).getState().guilds[guildId]?.roles ?? {})
        : {}
    const labelOf = (id: string) =>
        roles[id]?.name ? `@${roles[id].name}` : id
    if (SNOWFLAKE.test(raw)) return { kind, value: raw, label: labelOf(raw) }
    const needle = raw.replace(/^@/, '').toLowerCase()
    const role = Object.values(roles).find(
        candidate => candidate.name?.toLowerCase() === needle,
    )
    return role ? { kind, value: role.id, label: labelOf(role.id) } : null
}

/** An option by its value or its label. A negatable one takes a `-` prefix. */
function resolveOption(kind: FilterKind, raw: string): ResolvedFilter | null {
    const spec = FILTERS[kind]
    const negated = Boolean(spec.negatable) && raw.startsWith('-')
    const needle = (negated ? raw.slice(1) : raw).toLowerCase()
    const option = spec.options?.find(
        candidate =>
            candidate.value === needle ||
            t(candidate.label).toLowerCase() === needle,
    )
    if (!option) return null
    return {
        kind,
        value: option.value,
        label: t(option.label),
        ...(negated ? { negated } : {}),
    }
}

/** A `YYYY-MM-DD` date, or today or yesterday. */
function resolveDate(kind: FilterKind, raw: string): ResolvedFilter | null {
    const today = new Date()
    const word = raw.toLowerCase()
    let date: Date | null = null
    if (word === t('search.filter.today').toLowerCase()) date = today
    else if (word === t('search.filter.yesterday').toLowerCase())
        date = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - 1,
        )
    else date = parseFilterDate(raw)
    if (!date) return null
    return { kind, value: formatFilterDate(date), label: filterDateLabel(date) }
}

/**
 * Returns the filter a typed `key:value` stands for, or null when the value names nothing known. Ids are taken as
 * they are, known or not. A command needs its name too, so only its picker resolves one.
 */
export function resolveFilter(
    session: Session,
    context: SearchContext,
    kind: FilterKind,
    raw: string,
): ResolvedFilter | null {
    const spec = FILTERS[kind]
    switch (spec.input) {
        case 'toggle':
            return raw === 'true' ? { kind, value: '', label: '' } : null
        case 'user':
            return resolveUser(session, context, kind, raw)
        case 'channel':
            return resolveChannel(session, context, kind, raw)
        case 'role':
            return resolveRole(session, context, kind, raw)
        case 'options':
            return resolveOption(kind, raw)
        case 'date':
            return resolveDate(kind, raw)
        case 'text':
            return (spec.accepts ?? (() => true))(raw)
                ? { kind, value: raw, label: raw }
                : null
        case 'command':
            return null
    }
}
