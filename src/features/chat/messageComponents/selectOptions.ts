import { emojiUrl } from '../../../core/discord/cdn'
import {
    ComponentType,
    SelectDefaultValueType,
} from '../../../core/discord/components'
import { avatarUrl } from '../../../design/components/avatars/avatarUrl'
import { computeChannelName } from '../../../stores/channels/channelName'
import { displayName } from '../../../stores/users'
import { twemojiUrl } from '../emoji'
import type { Channel } from '../../../stores/channels/channels'
import type { Guild } from '../../../stores/guilds'
import type { User } from '../../../stores/users'
import type { SelectedOptionRow } from '../rows/rows'
import type { ApiComponent, ApiEmoji } from './apiComponent'

/** AvatarUtils.getEmojiURL's size for component emoji (transformComponent). */
const COMPONENT_EMOJI_SIZE = 48
/** A picked user's avatar in the select, 20dp in the row (SelectComponentView.setImage). */
const OPTION_AVATAR_SIZE = 64

/** SelectOptionType: what an option names. */
export type SelectOptionKind = 'string' | 'user' | 'role' | 'channel'

/** An option of a select, as its sheet lists it and the select shows it once picked. */
export interface SelectOption extends SelectedOptionRow {
    kind: SelectOptionKind
    value: string
    description?: string
}

/** What a user, role or channel option is looked up in: the chat's users, server and channels. */
export interface SelectLookup {
    users: Record<string, User | undefined>
    guild: Guild | undefined
    channels: Record<string, Channel | undefined>
    /** The user's name in the chat: their nick first. */
    nameOf: (user: User) => string
}

/** A component's emoji: a custom one's image, or the Twemoji of a Unicode one. */
export const emojiOf = (emoji: ApiEmoji | null | undefined) => ({
    emoji: emoji?.id ? undefined : (emoji?.name ?? undefined),
    emojiUrl: emoji?.id
        ? emojiUrl(emoji.id, emoji.animated, COMPONENT_EMOJI_SIZE)
        : emoji?.name
          ? twemojiUrl(emoji.name)
          : undefined,
})

/** A string select's options (transformComponent's STRING_SELECT). */
export const stringOptions = (c: ApiComponent): SelectOption[] =>
    (c.options ?? []).map(option => ({
        kind: 'string',
        value: option.value,
        label: option.label,
        description: option.description || undefined,
        ...emojiOf(option.emoji),
    }))

export const userOption = (user: User, lookup: SelectLookup): SelectOption => ({
    kind: 'user',
    value: user.id,
    label: lookup.nameOf(user) || displayName(user),
    emojiUrl: avatarUrl(user, OPTION_AVATAR_SIZE),
    round: true,
})

export const roleOption = (id: string, name: string): SelectOption => ({
    kind: 'role',
    value: id,
    label: name,
})

export const channelOption = (
    channel: Channel,
    lookup: SelectLookup,
): SelectOption => ({
    kind: 'channel',
    value: channel.id,
    label: computeChannelName(channel, lookup.users),
})

/** Whether a channel select may offer the channel (its `channel_types`, any when empty). */
export const channelAllowed = (c: ApiComponent, channel: Channel) =>
    !c.channel_types?.length || c.channel_types.includes(channel.type)

/** getSnowflakeSelectDefaultValues: the select's `default_values` the client knows. */
function snowflakeDefaults(
    c: ApiComponent,
    lookup: SelectLookup,
): SelectOption[] {
    return (c.default_values ?? []).flatMap(({ id, type }) => {
        if (type === SelectDefaultValueType.USER) {
            const user = lookup.users[id]
            return user ? [userOption(user, lookup)] : []
        }
        if (type === SelectDefaultValueType.ROLE) {
            const name = lookup.guild?.roles[id]?.name
            return name ? [roleOption(id, name)] : []
        }
        const channel = lookup.channels[id]
        return type === SelectDefaultValueType.CHANNEL &&
            channel &&
            channel.guild_id === lookup.guild?.id &&
            channelAllowed(c, channel)
            ? [channelOption(channel, lookup)]
            : []
    })
}

/**
 * getInitialStringSelectOptions and getInitialSnowflakeSelectOptions: what the user picked and has not been
 * answered yet, else the select's defaults.
 */
export function initialSelection(
    c: ApiComponent,
    picked: SelectOption[] | undefined,
    lookup: SelectLookup,
): SelectOption[] {
    if (picked) return picked
    if (c.type === ComponentType.STRING_SELECT)
        return stringOptions(c).filter(
            (_, index) => c.options?.[index]?.default,
        )
    return snowflakeDefaults(c, lookup)
}

/** min_values and max_values, with the API's defaults of 1. */
export const selectLimits = (c: ApiComponent) => ({
    min: c.min_values ?? 1,
    max: c.max_values ?? 1,
    /** More than one pick: pills in the chat, checkboxes and Select in the sheet. */
    multi: (c.max_values ?? 1) > 1,
})
