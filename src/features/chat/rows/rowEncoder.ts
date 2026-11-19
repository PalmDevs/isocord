import { useUnistyles } from 'react-native-unistyles'
import { themes } from '../../../design/tokens'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { membersStore } from '../../../stores/members'
import { usersStore } from '../../../stores/users'
import { argb } from '../color'
import { chatTheme } from '../theme'
import { buildRows } from './buildRows'
import type { Session } from '../../../core/session'
import type { Message } from '../../../stores/readStates'
import type { User } from '../../../stores/users'
import type { RowContext } from './buildRows'
import type { ChatRow, MessageRow } from './rows'

/**
 * Encodes chat rows and the chat theme for the native views (`ChatRows.kt`, `ChatTheme`): the chat list, search
 * results, and a message drawn on its own.
 */

/** How a native view colours chat content. */
type ThemeVariant =
    /** The chat's own, on its background. */
    | 'chat'
    /** Transparent over the surface below: search results, the in-app notification, a thread's starter. */
    | 'transparent'
    /** The media viewer's footer. */
    | 'mediaFooter'

/**
 * The footer is drawn in the dark theme whatever the app's theme (MediaMessagePreview's forcedTheme DARK), its
 * reactions in Onyx (reactionsTheme), on THEME_LOCKED_BLUR_FALLBACK (useMediaModalFooterBackground).
 */
const MEDIA_FOOTER_THEME = JSON.stringify({
    ...chatTheme(themes.dark),
    background: argb(themes.dark.colors.THEME_LOCKED_BLUR_FALLBACK),
    reactionBackground: argb(
        themes.midnight.colors.REACTION_BACKGROUND_DEFAULT,
    ),
    reactionBorder: argb(themes.midnight.colors.REACTION_BORDER_DEFAULT),
    reactionText: argb(themes.midnight.colors.REACTION_TEXT_DEFAULT),
    reactionReactedBackground: argb(
        themes.midnight.colors.REACTION_BACKGROUND_REACTED_DEFAULT,
    ),
    reactionReactedBorder: argb(
        themes.midnight.colors.REACTION_BORDER_REACTED_DEFAULT,
    ),
    reactionReactedText: argb(
        themes.midnight.colors.REACTION_TEXT_REACTED_DEFAULT,
    ),
})

/** Returns the `theme` prop of a native chat view, from the app's current theme. */
export function useChatTheme(variant: ThemeVariant = 'chat'): string {
    const { theme } = useUnistyles()
    if (variant === 'mediaFooter') return MEDIA_FOOTER_THEME
    const colors = chatTheme(theme)
    return JSON.stringify(
        variant === 'transparent' ? { ...colors, background: 0 } : colors,
    )
}

/**
 * Returns the `rows` prop: a JSON array with each row on its own line.
 * The renderer keeps the previous update's lines and parses only the changed ones (`parseRows` in ChatRows.kt).
 */
export const encodeRows = (rows: ChatRow[]): string =>
    `[${rows.map(row => JSON.stringify(row)).join(',\n')}]`

/** What a message outside the chat is drawn with. The session's stores when not given. */
type RowSources = Pick<RowContext, 'guild' | 'members' | 'users' | 'channels'>

function sessionSources(session: Session, message: Message): RowSources {
    const channels = session.get(channelsStore).getState().channels
    const guildId = channels[message.channel_id]?.guild_id
    return {
        channels,
        users: session.get(usersStore).getState().users,
        guild: guildId
            ? session.get(guildsStore).getState().guilds[guildId]
            : undefined,
        members: guildId
            ? session.get(membersStore).getState().members[guildId]
            : undefined,
    }
}

/**
 * Builds one message as a chat row of its own, for the native views that draw a message outside the chat. Undefined
 * when the message builds no message row. Pass it through `standaloneRow` to drop what belongs to the chat.
 */
export function buildMessageRow(
    session: Session,
    message: Message,
    sources: RowSources = sessionSources(session, message),
): MessageRow | undefined {
    // Users mentioned in a message come with it; the client may not know them.
    const users = message.mentions?.length
        ? Object.assign(
              Object.create(sources.users) as Record<string, User>,
              Object.fromEntries(message.mentions.map(user => [user.id, user])),
          )
        : sources.users
    return buildRows(
        { messages: [message], hasMore: true, loading: false, error: false },
        { ...sources, session, users },
    ).find((built): built is MessageRow => built.type === 'message')
}

/**
 * Returns a message row without what only the chat has: grouping, the reply preview, the swipe, the mention
 * highlight and jumbo emoji. Reactions go too, unless `reactions` keeps them (the media viewer's footer).
 */
export function standaloneRow(
    row: MessageRow,
    { reactions = false }: { reactions?: boolean } = {},
): MessageRow {
    return {
        ...row,
        grouped: false,
        reply: undefined,
        swipe: undefined,
        thread: undefined,
        mentioned: false,
        jumbo: false,
        ...(reactions ? {} : { reactions: [], addReaction: false }),
    }
}
