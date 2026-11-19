import type { Channel } from '../../../stores/channels/channels'
import type { Guild } from '../../../stores/guilds'
import type { Message } from '../../../stores/readStates'
import type { User } from '../../../stores/users'
import type { Span, SystemIcon, SystemRow, SystemTint } from '../rows/rows'
import type { SystemLink, SystemText } from './format'

/**
 * What a system message's text reads from. The chat fills it from its stores. A preview has only the message
 * (SystemMessageUtils.stringify): global names, and no channels or server.
 */
export interface SystemEnv {
    /** The name a user goes by here: the server nickname in the chat, the global name in a preview. */
    name: (user: User) => string
    /** A username link (formatUsernameOnClick): the profile, in the role colour. */
    userLink: (user: User) => SystemLink
    channel: (channelId: string) => Channel | undefined
    /** The chat's server. */
    guild: Guild | undefined
    /** Building plain text for a preview rather than the chat row. */
    plain: boolean
    /** The signed in user. */
    userId: string
    /** A user the client knows, by id. */
    user: (userId: string) => User | undefined
    /** A user's avatar here (the server avatar in the chat), at `size` pixels. */
    avatarUrl: (user: User, size: number) => string
    /** Message markdown as spans. */
    spans: (text: string) => Span[]
}

/** What a system row draws instead of or beside its text: a call card, an AutoMod message. */
export type SystemParts = Pick<SystemRow, 'call' | 'automod'>

/** What a system message adds to its text. */
export interface SystemContent extends SystemText {
    /** The "Wave to say hi!" button under a join message. */
    wave?: boolean
}

/** One message type: the icon of SystemMessageView.getIconAndColor and the reference's content builder. */
export interface SystemHandler {
    icon: SystemIcon
    tint: SystemTint
    /** Undefined when the message cannot be drawn (the reference returns null). */
    content: (message: Message, env: SystemEnv) => SystemContent | undefined
    /** The parts of the chat row besides the text. Not called for a preview. */
    parts?: (message: Message, env: SystemEnv) => SystemParts | undefined
}

/** The handlers of one domain, by message type. */
export type SystemHandlers = Partial<Record<number, SystemHandler>>

/** The `{username}{usernameOnClick}` values of a message's author. */
export const authorValues = (message: Message, env: SystemEnv) => ({
    username: env.name(message.author),
    usernameOnClick: env.userLink(message.author),
})
