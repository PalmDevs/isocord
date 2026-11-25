import { useEffect, useMemo, useRef } from 'react'
import { Keyboard } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { t } from '../../../i18n'
import SearchResultsView from '../../../native/SearchResultsViewNativeComponent'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { membersStore, requestMembers } from '../../../stores/members'
import { usersStore } from '../../../stores/users'
import { handleChatLink } from '../../chat/links/links'
import { jumpFromDetails } from '../../chat/links/openChannel'
import { useChatTheme } from '../../chat/rows/rowEncoder'
import { useOpenSearchPreview } from '../useOpenSearchPreview'
import {
    RESULT_MAX_CONTENT_HEIGHT,
    SEARCH_ROW_TAP_STATE_PADDING,
} from './constants'
import { useSearchResults, useSearchTab } from './controller'
import { resultRow } from './resultRow'
import { queryWords } from './text'
import type { Channel } from '../../../stores/channels/channels'
import type { MessageTab } from '../api'
import type { SearchContext } from '../types'
import type { SearchRow } from './resultRow'

const LOADING_ROW = JSON.stringify({
    type: 'loading',
    key: 'loading',
} satisfies SearchRow)

interface CachedRow {
    deps: unknown[]
    json: string
}

const sameDeps = (a: unknown[], b: unknown[]) =>
    a.length === b.length && a.every((value, index) => value === b[index])

/**
 * The results of a message tab (Messages and Pins), drawn by one native list. Results are rows of JSON built once
 * per message (kept while the message, its author, channel, guild and query are the same) and joined, so a page
 * appended to the results costs only its own messages; the native list keeps the rows that did not change.
 */
export function MessageResults({
    tab,
    context,
    lineClamp,
    showHistoricalIndexing,
    onDismiss,
    onEndReached,
}: {
    tab: MessageTab
    context: SearchContext
    lineClamp: number
    showHistoricalIndexing: boolean
    onDismiss: () => void
    onEndReached: () => void
}) {
    const session = useSession()
    const state = useSearchTab(tab)
    const query = useSearchResults(results => results.query) ?? ''
    const fromSearch = useSearchResults(results => results.channels)
    const historical = useSearchResults(results => results.historicalIndexing)
    const indexed = useSearchResults(results => results.documentsIndexed)
    const known = useSessionStore(channelsStore, store => store.channels)
    const users = useSessionStore(usersStore, store => store.users)
    const guildId =
        context.type === 'GUILD_CHANNEL'
            ? context.guildId
            : context.type === 'CHANNEL'
              ? known[context.channelId]?.guild_id
              : undefined
    const guild = useSessionStore(guildsStore, store =>
        guildId ? store.guilds[guildId] : undefined,
    )
    const members = useSessionStore(membersStore, store =>
        guildId ? store.members[guildId] : undefined,
    )
    const messages = state?.messages
    const more = state != null && state.cursor != null && !state.error

    // Roles colour a name only for members the client has; the others are asked for.
    useEffect(() => {
        if (!guildId || !messages) return
        requestMembers(
            session,
            guildId,
            messages.map(message => message.author.id),
        )
    }, [session, guildId, messages])

    const channels = useMemo(() => {
        // The client's own channels win; the ones the response came with fill the gaps.
        const merged = Object.create(known) as Record<string, Channel>
        for (const id of Object.keys(fromSearch))
            if (!known[id]) merged[id] = fromSearch[id] as Channel
        return merged
    }, [known, fromSearch])

    const cache = useRef(new Map<string, CachedRow>())
    const rows = useMemo(() => {
        const words = queryWords(query)
        const previous = cache.current
        const next = new Map<string, CachedRow>()
        const parts: string[] = []
        if (showHistoricalIndexing && historical)
            parts.push(
                JSON.stringify({
                    type: 'notice',
                    key: 'indexing',
                    lines: [
                        t(
                            indexed === 0
                                ? 'search.historicalIndexing.zero'
                                : indexed === 1
                                  ? 'search.historicalIndexing.one'
                                  : 'search.historicalIndexing.other',
                            { count: indexed.toLocaleString() },
                        ),
                    ],
                } satisfies SearchRow),
            )
        for (const message of messages ?? []) {
            const deps = [
                message,
                members?.[message.author.id],
                users[message.author.id],
                channels[message.channel_id],
                guild,
                query,
                lineClamp,
            ]
            let entry = previous.get(message.id)
            if (!entry || !sameDeps(entry.deps, deps))
                entry = {
                    deps,
                    json: JSON.stringify(
                        resultRow(session, message, {
                            guild,
                            members,
                            users,
                            channels,
                            words,
                            lineClamp,
                        }),
                    ),
                }
            next.set(message.id, entry)
            parts.push(entry.json)
        }
        cache.current = next
        if (more) parts.push(LOADING_ROW)
        return `[${parts.join(',')}]`
    }, [
        session,
        messages,
        members,
        users,
        channels,
        guild,
        query,
        lineClamp,
        more,
        historical,
        indexed,
        showHistoricalIndexing,
    ])

    const themeJson = useChatTheme('transparent')

    const openPreview = useOpenSearchPreview()
    const onLinkPress = (event: { nativeEvent: { url: string } }) =>
        handleChatLink(event.nativeEvent.url, {
            session,
            channelId: context.type === 'DMS' ? undefined : context.channelId,
            findMessage: id => messages?.find(message => message.id === id),
            // Leaving search for a message in its channel (useOnPressMessageItem).
            openChannel: (channelId, messageId) =>
                jumpFromDetails(channelId, messageId, onDismiss),
            openResult: openPreview,
        })

    return (
        <SearchResultsView
            style={{ flex: 1 }}
            rows={rows}
            theme={themeJson}
            lineClamp={lineClamp}
            maxContentHeight={RESULT_MAX_CONTENT_HEIGHT}
            topPadding={16 - SEARCH_ROW_TAP_STATE_PADDING}
            bottomPadding={16 + UnistylesRuntime.insets.bottom}
            onLinkPress={onLinkPress}
            onEndReached={onEndReached}
            onScrollDrag={Keyboard.dismiss}
        />
    )
}
