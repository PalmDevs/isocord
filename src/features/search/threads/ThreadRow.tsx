import { useNavigation } from '@react-navigation/native'
import { useEffect } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { snowflakeTimestamp } from '../../../core/discord/snowflake'
import { useSession, useSessionStore } from '../../../core/react'
import { Text } from '../../../design/components/Text'
import { TableRow } from '../../../design/components/table/TableRow'
import { t } from '../../../i18n'
import { threadsStore } from '../../../stores/channels/threads'
import { guildsStore } from '../../../stores/guilds'
import { membersStore, requestMembers } from '../../../stores/members'
import { readStatesStore } from '../../../stores/readStates'
import { displayName, usersStore } from '../../../stores/users'
import { openChannelActionSheet } from '../../channelActions'
import { authorStyle } from '../../chat/author'
import { hexColor } from '../../chat/color'
import { previewText } from '../../messages/preview'
import { timestampString } from './timestampString'
import type { ReactNode } from 'react'
import type { Channel } from '../../../stores/channels/channels'
import type { Message } from '../../../stores/readStates'
import type { User } from '../../../stores/users'

/** ThreadBrowserRowSubtext: a most recent message of these types shows who started the thread instead. */
const CHANNEL_NAME_CHANGE = 4
const THREAD_STARTER_MESSAGE = 21

/** Fills a message's `{name}` placeholders with elements (intl.format with hooks). */
function rich(template: string, parts: Record<string, ReactNode>): ReactNode[] {
    return template
        .split(/\{(\w+)\}/)
        .map((piece, index) => (index % 2 === 1 ? parts[piece] : piece))
}

/** Username: the name in the colour of the member's role (the default role style, "username"). */
function Username({ user, guildId }: { user: User; guildId?: string }) {
    const member = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId]?.[user.id] : undefined,
    )
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    const color = authorStyle(guild, member).color
    return (
        <Text
            variant="text-sm/semibold"
            color="MOBILE_TEXT_HEADING_PRIMARY"
            style={color !== undefined && { color: hexColor(color) }}
        >
            {member?.nick ?? displayName(user)}
        </Text>
    )
}

/** SubstringRow: the line, a dot and the timestamp; only the timestamp while the user is unknown. */
function SubstringRow({
    user,
    timestamp,
    children,
}: {
    user: User | undefined
    timestamp: string
    children: ReactNode
}) {
    if (!user)
        return (
            <View style={styles.row}>
                <Text
                    variant="text-sm/medium"
                    color="TEXT_MUTED"
                    style={styles.timestamp}
                >
                    {` ${timestamp}`}
                </Text>
            </View>
        )
    return (
        <View style={styles.row}>
            {children}
            <View style={styles.dividerDot} />
            <Text
                variant="text-sm/medium"
                color="TEXT_MUTED"
                style={styles.timestamp}
            >
                {timestamp}
            </Text>
        </View>
    )
}

/** CreatedBy: "Started by {name}", and when the thread was last active. The owner is asked for when unknown. */
function CreatedBy({ thread }: { thread: Channel }) {
    const session = useSession()
    const ownerId = thread.owner_id ?? ''
    const user = useSessionStore(usersStore, state => state.users[ownerId])
    const lastMessageId = useSessionStore(
        readStatesStore,
        state => state.lastMessageIds[thread.id],
    )
    useEffect(() => {
        if (!user && thread.guild_id && ownerId)
            requestMembers(session, thread.guild_id, [ownerId])
    }, [session, user, thread.guild_id, ownerId])

    // ThreadUtils.useLastMessageTimestamp: the newest message, else the thread's creation.
    const createdAt = thread.thread_metadata?.create_timestamp
    const time = lastMessageId
        ? snowflakeTimestamp(lastMessageId)
        : createdAt
          ? new Date(createdAt).getTime()
          : snowflakeTimestamp(thread.id)
    return (
        <SubstringRow user={user} timestamp={timestampString(time)}>
            <Text
                variant="text-sm/medium"
                color="TEXT_DEFAULT"
                lineClamp={1}
                ellipsizeMode="tail"
                style={styles.subtextContent}
            >
                {user &&
                    rich(t('threads.startedBy'), {
                        username: (
                            <Username
                                key="username"
                                user={user}
                                guildId={thread.guild_id}
                            />
                        ),
                    })}
            </Text>
        </SubstringRow>
    )
}

/** MessageContent: the newest message's author and text, and when it was sent. */
function MessageContent({
    thread,
    message,
}: {
    thread: Channel
    message: Message
}) {
    const session = useSession()
    const user = useSessionStore(
        usersStore,
        state => state.users[message.author.id] ?? message.author,
    )
    // useSubscribeGuildMembers: the author's member, for the nickname and colour.
    useEffect(() => {
        if (thread.guild_id)
            requestMembers(session, thread.guild_id, [message.author.id])
    }, [session, thread.guild_id, message.author.id])
    return (
        <SubstringRow
            user={user}
            timestamp={timestampString(snowflakeTimestamp(message.id))}
        >
            <Text
                variant="text-sm/medium"
                color="TEXT_DEFAULT"
                lineClamp={1}
                ellipsizeMode="tail"
                style={styles.subtextContent}
            >
                {rich(t('threads.lastMessage'), {
                    username: (
                        <Username
                            key="username"
                            user={user}
                            guildId={thread.guild_id}
                        />
                    ),
                    message: previewText(message) ?? '',
                })}
            </Text>
        </SubstringRow>
    )
}

/** ThreadSubtext: the newest message of an active thread, else who started it. */
function ThreadSubtext({ thread }: { thread: Channel }) {
    const message = useSessionStore(
        threadsStore,
        state => state.mostRecent[thread.id],
    )
    if (
        message &&
        message.type !== CHANNEL_NAME_CHANGE &&
        message.type !== THREAD_STARTER_MESSAGE &&
        !thread.thread_metadata?.archived
    )
        return <MessageContent thread={thread} message={message} />
    return <CreatedBy thread={thread} />
}

/** redesign/ThreadListTableRow: the thread's name over its subtext, with the arrow. */
export function ThreadRow({
    thread,
    start,
    end,
    onPress,
}: {
    thread: Channel
    start: boolean
    end: boolean
    onPress: (thread: Channel) => void
}) {
    const navigation = useNavigation()
    return (
        <TableRow
            label={thread.name}
            subLabel={
                <View style={styles.subLabel}>
                    <ThreadSubtext thread={thread} />
                </View>
            }
            onPress={() => onPress(thread)}
            onLongPress={() => openChannelActionSheet(thread.id, navigation)}
            start={start}
            end={end}
            arrow
        />
    )
}

const styles = StyleSheet.create(theme => ({
    subLabel: { maxWidth: '100%', marginTop: 2 },
    row: { flexDirection: 'row' },
    subtextContent: { lineHeight: 18, flexShrink: 1 },
    timestamp: { lineHeight: 18 },
    dividerDot: {
        width: 4,
        height: 4,
        marginHorizontal: theme.space.PX_4,
        borderRadius: 2,
        backgroundColor: theme.colors.BACKGROUND_MOD_STRONG,
        alignSelf: 'center',
    },
}))
