import { FlashList } from '@shopify/flash-list'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Endpoint } from '../../../core/api/paths'
import { ChannelType } from '../../../core/discord/channelType'
import { canStartThread, Permission } from '../../../core/discord/permissions'
import { compareSnowflakes } from '../../../core/discord/snowflake'
import { useSession, useSessionStore } from '../../../core/react'
import { ActivityIndicator } from '../../../design/components/ActivityIndicator'
import { Button } from '../../../design/components/buttons/Button'
import { Text } from '../../../design/components/Text'
import {
    TableRow,
    TableRowIcon,
} from '../../../design/components/table/TableRow'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { channelsStore, holdThread } from '../../../stores/channels/channels'
import { threadsStore } from '../../../stores/channels/threads'
import { useChannelPermissions } from '../../../stores/permissions'
import { readStatesStore } from '../../../stores/readStates'
import { usersStore } from '../../../stores/users'
import {
    openFromDetails,
    openThreadCreation,
} from '../../chat/links/openChannel'
import { ThreadRow } from './ThreadRow'
import type { Channel } from '../../../stores/channels/channels'
import type { User } from '../../../stores/users'
import type { SearchTabPageProps } from '../types'

/** ArchivedThreadsStore.PAGE_SIZE. */
const PAGE_SIZE = 25

type Row =
    | { kind: 'section'; title: string }
    | { kind: 'thread'; thread: Channel; start: boolean; end: boolean }

interface ArchivedThreads {
    threads: Channel[]
    hasMore: boolean
    loading: boolean
}

/**
 * ThreadBrowserHooks.useArchivedThreads (ThreadActionCreators.loadArchivedThreads): the channel's archived threads,
 * most recently active first, a page of 25 at a time from `GET /channels/{id}/threads/search`. Needs
 * READ_MESSAGE_HISTORY; media threads are left out.
 */
function useArchivedThreads(channel: Channel | undefined, canRead: boolean) {
    const session = useSession()
    const [state, setState] = useState<ArchivedThreads>({
        threads: [],
        hasMore: true,
        loading: canRead,
    })
    const abort = useRef<AbortController | undefined>(undefined)

    const loadMore = async () => {
        const { threads, hasMore } = state
        if (!channel || !canRead || !hasMore || abort.current) return
        const controller = new AbortController()
        abort.current = controller
        setState(previous => ({ ...previous, loading: true }))
        try {
            const body = await session.rest.get<{
                threads?: Channel[]
                has_more?: boolean
                owners?: Array<{ user?: User }>
            }>(Endpoint.channelThreadsSearch(channel.id), {
                query: {
                    archived: true,
                    sort_by: 'last_message_time',
                    sort_order: 'desc',
                    limit: PAGE_SIZE,
                    tag_setting: 'match_some',
                    offset: threads.length,
                },
                signal: controller.signal,
            })
            session
                .get(usersStore)
                .getState()
                .upsert((body.owners ?? []).map(owner => owner.user))
            const loaded = (body.threads ?? []).map(thread => ({
                ...thread,
                guild_id: channel.guild_id,
            }))
            setState(previous => ({
                threads: [
                    ...previous.threads,
                    ...(channel.type === ChannelType.GUILD_MEDIA ? [] : loaded),
                ],
                hasMore: body.has_more === true,
                loading: false,
            }))
        } catch {
            if (!controller.signal.aborted)
                setState(previous => ({ ...previous, loading: false }))
        } finally {
            if (abort.current === controller) abort.current = undefined
        }
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: the first page, once per channel
    useEffect(() => {
        loadMore()
        return () => {
            abort.current?.abort()
            abort.current = undefined
        }
    }, [channel?.id])

    return { ...state, loading: state.loading && canRead, loadMore }
}

/** redesign/ThreadListEmpty: the thread icon in a circle, the title and text, and a button to create one. */
function ThreadListEmpty({
    onCreateThreadPress,
}: {
    onCreateThreadPress?: () => void
}) {
    return (
        <View style={styles.empty}>
            <View style={styles.emptyIcon}>
                <Icon name="ThreadPlusIcon" size="md" />
            </View>
            <Text
                style={styles.emptyTitle}
                accessibilityRole="header"
                maxFontSizeMultiplier={2}
                variant="heading-lg/semibold"
                color="MOBILE_TEXT_HEADING_PRIMARY"
            >
                {t('threads.empty.title')}
            </Text>
            <Text
                style={styles.emptyBody}
                maxFontSizeMultiplier={2}
                variant="text-sm/medium"
                color="TEXT_DEFAULT"
            >
                {t('threads.empty.body')}
            </Text>
            {onCreateThreadPress && (
                <Button
                    text={t('threads.create')}
                    onPress={onCreateThreadPress}
                    style={styles.emptyButton}
                />
            )}
        </View>
    )
}

/**
 * SearchTabsThreadScreen (ThreadsScreen, redesign/ThreadList): the channel's joined, other active and older threads,
 * under a "Create Thread" row while the user may start one (useCanStartThread). Without threads, ThreadListEmpty;
 * while the first older threads load, a spinner. Creating a thread is not built yet (navigateToThreadCreation): the
 * row and the button do nothing.
 */
export function ThreadsPage({ context, onDismiss }: SearchTabPageProps) {
    const session = useSession()
    const channelId =
        context.type === 'GUILD_CHANNEL' ? context.channelId : undefined
    const channel = useSessionStore(channelsStore, state =>
        channelId ? state.channels[channelId] : undefined,
    )
    const guildId = channel?.guild_id
    const joinedIds = useSessionStore(channelsStore, state =>
        guildId ? state.byGuild[guildId] : undefined,
    )
    const active = useSessionStore(threadsStore, state => state.active)
    const lastMessageIds = useSessionStore(
        readStatesStore,
        state => state.lastMessageIds,
    )

    const permissions = useChannelPermissions(channelId ?? '')
    const canStart =
        channel !== undefined && canStartThread(channel, permissions)
    const archived = useArchivedThreads(
        channel,
        (permissions & Permission.READ_MESSAGE_HISTORY) !== 0n,
    )

    // useActiveThreadIds: the channel's active threads, the most recently active first; useActiveThreads splits off
    // the joined ones.
    const lastMessageId = (thread: Channel) =>
        lastMessageIds[thread.id] ?? thread.last_message_id ?? thread.id
    const activeThreads = Object.values(active)
        .filter(thread => thread.parent_id === channelId)
        .sort((a, b) => compareSnowflakes(lastMessageId(b), lastMessageId(a)))
    const joined = new Set(joinedIds)
    const sections: Array<{ title: string; threads: Channel[] }> = [
        {
            title: t('threads.joined', {
                count: activeThreads.filter(thread => joined.has(thread.id))
                    .length,
            }),
            threads: activeThreads.filter(thread => joined.has(thread.id)),
        },
        {
            title: t('threads.active', {
                count: activeThreads.filter(thread => !joined.has(thread.id))
                    .length,
            }),
            threads: activeThreads.filter(thread => !joined.has(thread.id)),
        },
        { title: t('threads.older'), threads: archived.threads },
    ]
    const rows: Row[] = []
    for (const { title, threads } of sections) {
        if (threads.length === 0) continue
        rows.push({ kind: 'section', title: title.toUpperCase() })
        threads.forEach((thread, index) =>
            rows.push({
                kind: 'thread',
                thread,
                start: index === 0,
                end: index === threads.length - 1,
            }),
        )
    }

    // ThreadsScreen's onThreadPress (transitionToThread): the details slide away, then the chat switches to the thread.
    const openThread = (thread: Channel) => {
        holdThread(session, thread)
        openFromDetails(thread.id, onDismiss)
    }
    // ThreadsScreen's create button: a thread on its own in this channel. The panels close the details first.
    const onCreateThreadPress =
        canStart && channelId ? () => openThreadCreation(channelId) : undefined

    if (rows.length === 0)
        return archived.loading ? (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator style={styles.spinner} />
            </View>
        ) : (
            <View style={styles.container}>
                <ThreadListEmpty onCreateThreadPress={onCreateThreadPress} />
            </View>
        )
    return (
        <View style={styles.container}>
            <FlashList
                data={rows}
                accessibilityLabel={t('search.tab.threads')}
                keyExtractor={row =>
                    row.kind === 'section' ? row.title : row.thread.id
                }
                getItemType={row => row.kind}
                renderItem={({ item: row }) =>
                    row.kind === 'section' ? (
                        <Text
                            style={styles.section}
                            accessibilityRole="header"
                            variant="text-xs/bold"
                            color="TEXT_DEFAULT"
                        >
                            {row.title}
                        </Text>
                    ) : (
                        <ThreadRow
                            thread={row.thread}
                            start={row.start}
                            end={row.end}
                            onPress={openThread}
                        />
                    )
                }
                // ThreadList's ListHeaderComponent: a RowButton.Icon (TableRowIcon) with ThreadPlusIcon.
                ListHeaderComponent={
                    onCreateThreadPress ? (
                        <TableRow
                            icon={<TableRowIcon name="ThreadPlusIcon" />}
                            label={t('threads.create')}
                            onPress={onCreateThreadPress}
                            start
                            end
                            arrow
                        />
                    ) : null
                }
                ListHeaderComponentStyle={styles.header}
                ListFooterComponent={
                    archived.loading ? (
                        <ActivityIndicator style={styles.spinner} />
                    ) : null
                }
                ListFooterComponentStyle={
                    archived.loading ? styles.footer : undefined
                }
                onEndReached={() => {
                    if (!archived.loading) archived.loadMore()
                }}
                onEndReachedThreshold={0.4}
                contentContainerStyle={styles.content}
            />
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: { flex: 1, flexGrow: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    // SearchTabsThreadScreen's contentContainerStyle: 16 across, the bottom inset and 16 below.
    content: {
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_16,
    },
    header: { marginTop: theme.space.PX_24, marginBottom: theme.space.PX_10 },
    footer: {
        marginVertical: theme.space.PX_16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: { marginTop: theme.space.PX_16, marginBottom: theme.space.PX_8 },
    // ThreadListLoadingIndicator: MessageLoadingSpinner, 32 square.
    spinner: { width: 32, height: 32 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyIcon: {
        backgroundColor: theme.colors.BACKGROUND_MOD_SUBTLE,
        borderRadius: theme.radii.round,
        padding: theme.space.PX_12,
    },
    emptyTitle: {
        textAlign: 'center',
        marginTop: theme.space.PX_16,
        marginHorizontal: theme.space.PX_16,
    },
    emptyBody: {
        textAlign: 'center',
        marginTop: theme.space.PX_4,
        marginHorizontal: theme.space.PX_16,
        marginBottom: theme.space.PX_16,
    },
    // Button hugs its label at the start; centred under the text.
    emptyButton: { alignSelf: 'center' },
}))
