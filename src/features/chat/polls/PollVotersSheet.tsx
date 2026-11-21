import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Endpoint } from '../../../core/api/paths'
import { useSession, useSessionStore } from '../../../core/react'
import { ActivityIndicator } from '../../../design/components/ActivityIndicator'
import { cdnSize } from '../../../design/components/avatars/avatarUrl'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Emoji } from '../../../design/components/Emoji'
import { BottomSheet } from '../../../design/components/sheets/Sheet'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { Text } from '../../../design/components/Text'
import { TableRow } from '../../../design/components/table/TableRow'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { membersStore } from '../../../stores/members'
import { findMessage, messagesStore } from '../../../stores/messages/messages'
import { displayName, usersStore } from '../../../stores/users'
import { authorAvatarUrl } from '../author'
import { openUserProfile } from '../headerActions'
import type { MessagePoll } from '../../../stores/messages/messageTypes'
import type { User } from '../../../stores/users'

/** DEFAULT_NUM_REACTION_USERS: voters one request lists. More are not paged in yet. */
const VOTERS_LIMIT = 100
/** The voter rows (TableRow) and their avatar (AvatarSizes.SMALL), as the reactions sheet's. */
const ROW_HEIGHT = 48
const AVATAR_SIZE = 30
const EMOJI_SIZE = 20

type Answer = MessagePoll['answers'][number]

/** PollInteractionUtils.showVotesForAnswer: the voters sheet, on one answer. */
export function openPollVoters(
    channelId: string,
    messageId: string,
    answerId: number | undefined,
): void {
    if (answerId === undefined) return
    openActionSheet(
        'poll-voters',
        <PollVotersSheet
            channelId={channelId}
            messageId={messageId}
            initialAnswerId={answerId}
        />,
    )
}

/** PollEmoji: a custom emoji's image, or the Unicode character. */
function AnswerEmoji({ emoji }: { emoji: Answer['poll_media']['emoji'] }) {
    if (emoji?.id) return <Emoji emoji={emoji} style={styles.emoji} />
    if (emoji?.name) return <Text variant="text-md/medium">{emoji.name}</Text>
    return null
}

/** PollAnswerButton: an answer's emoji and text, on the selected background when picked. */
function AnswerTab({
    answer,
    selected,
    onPress,
}: {
    answer: Answer
    selected: boolean
    onPress: () => void
}) {
    return (
        <RipplePressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={onPress}
            style={styles.tab(selected)}
        >
            <AnswerEmoji emoji={answer.poll_media.emoji} />
            {answer.poll_media.text ? (
                <Text
                    variant="text-md/semibold"
                    color={
                        selected
                            ? 'INTERACTIVE_TEXT_ACTIVE'
                            : 'INTERACTIVE_TEXT_DEFAULT'
                    }
                    lineClamp={1}
                >
                    {answer.poll_media.text}
                </Text>
            ) : null}
        </RipplePressable>
    )
}

/** VotersList's row: the avatar (the server one if set) and the nickname; a tap opens the profile. */
function VoterRow({
    user,
    guildId,
    start,
    end,
}: {
    user: User
    guildId: string | undefined
    start: boolean
    end: boolean
}) {
    const session = useSession()
    const member = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId]?.[user.id] : undefined,
    )
    const name = member?.nick ?? displayName(user)
    return (
        <TableRow
            start={start}
            end={end}
            height={ROW_HEIGHT}
            onPress={() => openUserProfile(session, user.id, guildId)}
            accessibilityLabel={name}
            icon={
                <Image
                    source={authorAvatarUrl(
                        user,
                        member,
                        guildId,
                        cdnSize(AVATAR_SIZE),
                    )}
                    recyclingKey={user.id}
                    style={styles.avatar}
                />
            }
            label={name}
            labelLineClamp={1}
        />
    )
}

/** An answer's voters as last fetched, and the vote count they were fetched at. `users` is null after a failure. */
interface Fetched {
    count: number
    users: User[] | null
}

/**
 * Loads the first page of an answer's voters (POLL_ANSWER_VOTERS). Fetched again when the answer's vote count
 * changes, and a failure again when its tab is picked again or the sheet reopens. Undefined until the first answer
 * comes back, null when the last fetch failed.
 */
function useVoters(
    channelId: string,
    messageId: string,
    answerId: number,
    count: number,
) {
    const session = useSession()
    const [fetched, setFetched] = useState<Record<number, Fetched>>({})
    const fetchedRef = useRef(fetched)
    fetchedRef.current = fetched
    useEffect(() => {
        const known = fetchedRef.current[answerId]
        if (known?.users && known.count === count) return
        session.rest
            .get<{ users: User[] }>(
                Endpoint.pollAnswerVoters(channelId, messageId, answerId),
                { query: { limit: VOTERS_LIMIT } },
            )
            .then(({ users }) => {
                session.get(usersStore).getState().upsert(users)
                setFetched(prev => ({ ...prev, [answerId]: { count, users } }))
            })
            .catch(() =>
                setFetched(prev => ({
                    ...prev,
                    [answerId]: { count, users: null },
                })),
            )
    }, [session, channelId, messageId, answerId, count])
    return fetched[answerId]?.users
}

/** PollVotesActionSheet: the answers on top, the selected answer's vote count and voters below. */
function PollVotersSheet({
    channelId,
    messageId,
    initialAnswerId,
}: {
    channelId: string
    messageId: string
    initialAnswerId: number
}) {
    const [answerId, setAnswerId] = useState(initialAnswerId)
    const poll = useSessionStore(
        messagesStore,
        state => findMessage(state, channelId, messageId)?.poll,
    )
    const guildId = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.guild_id,
    )
    const count =
        poll?.results?.answer_counts.find(entry => entry.id === answerId)
            ?.count ?? 0
    const voters = useVoters(channelId, messageId, answerId, count)
    return (
        <BottomSheet
            header={
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    accessibilityLabel={t('chat.poll.answers')}
                    contentContainerStyle={styles.tabs}
                >
                    {poll?.answers.map(answer => (
                        <AnswerTab
                            key={answer.answer_id}
                            answer={answer}
                            selected={answer.answer_id === answerId}
                            onPress={() => setAnswerId(answer.answer_id)}
                        />
                    ))}
                </ScrollView>
            }
        >
            <Text variant="heading-md/bold" style={styles.title}>
                {t(
                    count === 1
                        ? 'chat.poll.votersTitleOne'
                        : 'chat.poll.votersTitle',
                    { count },
                )}
            </Text>
            {voters === undefined ? (
                <ActivityIndicator style={styles.spinner} />
            ) : voters === null ? (
                <Text
                    variant="text-md/medium"
                    color="TEXT_MUTED"
                    style={styles.center}
                >
                    {t('chat.actions.failed')}
                </Text>
            ) : voters.length === 0 ? (
                <View style={styles.empty}>
                    <Text variant="heading-md/bold" style={styles.center}>
                        {t('chat.poll.votersEmptyTitle')}
                    </Text>
                    <Text
                        variant="text-sm/medium"
                        color="TEXT_MUTED"
                        style={styles.center}
                    >
                        {t('chat.poll.votersEmptyBody')}
                    </Text>
                </View>
            ) : (
                voters.map((user, index) => (
                    <VoterRow
                        key={user.id}
                        user={user}
                        guildId={guildId}
                        start={index === 0}
                        end={index === voters.length - 1}
                    />
                ))
            )}
        </BottomSheet>
    )
}

const styles = StyleSheet.create(theme => ({
    tabs: { paddingHorizontal: theme.space.PX_8 },
    tab: (selected: boolean) => ({
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: theme.space.PX_8,
        padding: theme.space.PX_8,
        marginHorizontal: theme.space.PX_8,
        borderRadius: theme.radii.sm,
        backgroundColor: selected
            ? theme.colors.INTERACTIVE_BACKGROUND_SELECTED
            : undefined,
    }),
    emoji: { width: EMOJI_SIZE, height: EMOJI_SIZE },
    title: { marginBottom: theme.space.PX_12 },
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
    },
    spinner: { height: ROW_HEIGHT },
    empty: { padding: theme.space.PX_32, gap: theme.space.PX_8 },
    center: { textAlign: 'center' },
}))
