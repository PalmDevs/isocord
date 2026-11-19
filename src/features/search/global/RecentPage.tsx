import { FlashList } from '@shopify/flash-list'
import { useWindowDimensions } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { openChannel } from '../../chat/links/openChannel'
import { ChannelRow } from '../channels/ChannelsPage'
import { useGuildChannelResults } from '../channels/useGuildChannelResults'
import { useSearchTab } from '../messages/controller'
import { getMedia } from '../messages/extract'
import { gridMediaSize } from '../messages/mediaGrid'
import { MediaGrid, RecentsMediaGridPlaceholder } from '../messages/mediaRows'
import { useOpenMedia } from '../messages/useOpenMedia'
import { usePrivateChannelEntries } from './dms'
import { DmRow, SectionHeader, TextRow } from './rows'
import { searchHistoryStore } from './SearchHistoryStore'
import { useSetSearchQuery } from './SearchQueryContext'
import { useOpenDm } from './useOpenDm'
import type { ReactNode } from 'react'
import type { MediaItem } from '../messages/extract'
import type { SearchTabPageProps } from '../types'
import type { SearchHistoryItem } from './SearchHistoryStore'

type Row =
    | {
          key: string
          kind: 'section'
          title: string
          trailing?: 'clear' | 'viewAll'
      }
    | { key: string; kind: 'text'; item: SearchHistoryItem & { type: 'text' } }
    | { key: string; kind: 'dm'; channelId: string }
    | { key: string; kind: 'channel'; id: string; lastMessageId?: string }
    | { key: string; kind: 'media'; media: MediaItem[] }

/** SUGGESTED_DMS_LIMIT: useSuggestedUsersData asks for 3 affinity suggestions; useSuggestedChannelsData shows 3. */
const SUGGESTED_LIMIT = 3
/** RecentScreen: the grid shows the first 9 media of the Media tab's results, in 3 rows while they load. */
const RECENT_MEDIA_LIMIT = 9
const RECENT_MEDIA_PLACEHOLDER_ROWS = 3

/**
 * RecentScreenContainer: the Recent tab of the DMs search (RecentUserScreen: suggested DMs) and of the server search
 * (RecentGuildScreen: suggested channels).
 */
export function RecentPage(props: SearchTabPageProps) {
    return props.context.type === 'DMS' ? (
        <RecentUserPage {...props} />
    ) : (
        <RecentGuildPage {...props} />
    )
}

/**
 * RecentUserScreen: the search history (SearchHistoryStore under the DMS context id), and useSuggestedUsersData's
 * "Suggested" people.
 */
function RecentUserPage(props: SearchTabPageProps) {
    const history = useSessionStore(searchHistoryStore, state => state.items)
    const entries = usePrivateChannelEntries()
    const shown = new Set(
        history.flatMap(item => (item.type === 'text' ? [] : [item.channelId])),
    )
    // No affinity data: the most recent 1:1 conversations stand in for the suggested users.
    const suggested = entries
        .filter(entry => !entry.isGroup && !shown.has(entry.channel.id))
        .slice(0, SUGGESTED_LIMIT)
    const rows: Row[] = []
    if (suggested.length > 0) {
        rows.push({ key: 's', kind: 'section', title: t('search.suggested') })
        for (const entry of suggested)
            rows.push({
                key: `s:${entry.channel.id}`,
                kind: 'dm',
                channelId: entry.channel.id,
            })
    }
    return <RecentList {...props} history={history} suggested={rows} />
}

/**
 * RecentGuildScreen: useSuggestedChannelsData, the server's text channels with the newest messages first (what the
 * Channels tab lists without a query). The reference also reads a history under the server's id, but only the DMs
 * search ever adds to one (SearchPlatformActionCreators.addSearchHistoryItem), so it is always empty; the smart
 * search suggestions of the section are not ported.
 */
function RecentGuildPage(props: SearchTabPageProps) {
    const { context } = props
    const channels = useGuildChannelResults(
        context.type === 'GUILD_CHANNEL' ? context.guildId : undefined,
        '',
    )
    const rows: Row[] = []
    const suggested = channels.text.slice(0, SUGGESTED_LIMIT)
    if (suggested.length > 0) {
        rows.push({ key: 's', kind: 'section', title: t('search.suggested') })
        for (const { id, lastMessageId } of suggested)
            rows.push({ key: `c:${id}`, kind: 'channel', id, lastMessageId })
    }
    return <RecentList {...props} history={[]} suggested={rows} />
}

/**
 * RecentScreen: "Search History" with "Clear all", the suggestions of the search, and "Photos & Media" with "View all"
 * (to the Media tab): a grid of the first media of the Media tab's results, its placeholder while they load.
 */
function RecentList({
    onDismiss,
    selectTab,
    history,
    suggested,
}: SearchTabPageProps & {
    history: SearchHistoryItem[]
    suggested: Row[]
}) {
    const session = useSession()
    const setQuery = useSetSearchQuery()
    const openDm = useOpenDm(onDismiss)
    const openMedia = useOpenMedia()
    const mediaTab = useSearchTab('media')
    const { width } = useWindowDimensions()
    const mediaSize = gridMediaSize(width)

    const rows: Row[] = []
    if (history.length > 0) {
        rows.push({
            key: 'h',
            kind: 'section',
            title: t('search.recent'),
            trailing: 'clear',
        })
        for (const item of history)
            rows.push(
                item.type === 'text'
                    ? { key: `t:${item.text}`, kind: 'text', item }
                    : {
                          key: `d:${item.channelId}`,
                          kind: 'dm',
                          channelId: item.channelId,
                      },
            )
    }
    rows.push(...suggested)
    const media = getMedia(mediaTab?.messages ?? []).slice(
        0,
        RECENT_MEDIA_LIMIT,
    )
    if (media.length > 0) {
        rows.push({
            key: 'm',
            kind: 'section',
            title: t('search.photosAndMedia'),
            trailing: 'viewAll',
        })
        rows.push({ key: 'grid', kind: 'media', media })
    }

    const { remove, clear } = session.get(searchHistoryStore).getState()
    const openGuildChannel = (id: string) => {
        onDismiss()
        openChannel(id)
    }

    const sectionAction = (label: string, onPress: () => void): ReactNode => (
        <RipplePressable
            borderless
            radius={24}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            hitSlop={8}
        >
            <Text variant="text-sm/semibold" color="TEXT_BRAND">
                {label}
            </Text>
        </RipplePressable>
    )

    return (
        <FlashList
            data={rows}
            keyExtractor={row => row.key}
            getItemType={row => row.kind}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            ListFooterComponent={
                mediaTab?.initialComplete ? null : (
                    <RecentsMediaGridPlaceholder
                        rows={RECENT_MEDIA_PLACEHOLDER_ROWS}
                        size={mediaSize}
                    />
                )
            }
            renderItem={({ item: row }) => {
                switch (row.kind) {
                    case 'section':
                        return (
                            <SectionHeader
                                title={row.title}
                                trailing={
                                    row.trailing === 'clear'
                                        ? sectionAction(
                                              t('search.clearAll'),
                                              clear,
                                          )
                                        : row.trailing === 'viewAll'
                                          ? sectionAction(
                                                t('search.viewAll'),
                                                () => selectTab('media'),
                                            )
                                          : undefined
                                }
                            />
                        )
                    case 'text':
                        return (
                            <TextRow
                                text={row.item.text}
                                onPress={() => setQuery(row.item.text)}
                                trailing={
                                    <RipplePressable
                                        borderless
                                        radius={20}
                                        accessibilityRole="button"
                                        accessibilityLabel={t(
                                            'search.removeRecent',
                                        )}
                                        onPress={() => remove(row.item)}
                                        hitSlop={8}
                                        style={styles.remove}
                                    >
                                        <Icon
                                            name="XSmallIcon"
                                            size="sm"
                                            color="INTERACTIVE_TEXT_DEFAULT"
                                        />
                                    </RipplePressable>
                                }
                            />
                        )
                    case 'dm':
                        return (
                            <DmRow channelId={row.channelId} onPress={openDm} />
                        )
                    case 'channel':
                        return (
                            <ChannelRow
                                id={row.id}
                                lastMessageId={row.lastMessageId}
                                onPress={openGuildChannel}
                            />
                        )
                    case 'media':
                        return (
                            <MediaGrid
                                media={row.media}
                                size={mediaSize}
                                onPress={openMedia}
                            />
                        )
                }
            }}
        />
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    content: { paddingBottom: runtime.insets.bottom + theme.space.PX_16 },
    remove: { padding: theme.space.PX_4 },
}))
