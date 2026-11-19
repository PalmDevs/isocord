import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { snowflakeTimestamp } from '../../core/discord/snowflake'
import { useSession, useSessionStore } from '../../core/react'
import { FormCheckbox } from '../../design/components/Forms'
import { SearchField } from '../../design/components/inputs/SearchField'
import { Text } from '../../design/components/Text'
import { TableCheckboxRow } from '../../design/components/table/TableControlRows'
import { TableRowIcon } from '../../design/components/table/TableRow'
import { TableRowGroupTitle } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { channelsStore, isVoice } from '../../stores/channels/channels'
import { readStatesStore } from '../../stores/readStates'
import { settingsStore } from '../../stores/settings/settingsStore'
import { isChannelOptedIn } from '../../stores/unreadPolicy'
import { formatTimestamp } from '../chat/timestamp'
import { channelIcon } from '../servers/channelIcon'
import { hasNotSetUpChannelOptIn, toggleChannel } from './actions'
import { buildBrowserRows } from './rows'
import type { Guild } from '../../stores/guilds'
import type { BrowserRow } from './rows'

/** ChannelBrowser's CategoryRow: the category's name and its "Follow Category" checkbox. */
function CategoryHeader({ guild, id }: { guild: Guild; id: string | null }) {
    const session = useSession()
    const name = useSessionStore(channelsStore, state =>
        id ? state.channels[id]?.name : undefined,
    )
    const checked = useSessionStore(
        settingsStore,
        state => id !== null && isChannelOptedIn(state, guild.id, id),
    )
    if (id === null)
        // The uncategorised channels get the header's spacing without a title.
        return <View style={styles.category} />
    return (
        <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            onPress={() => toggleChannel(session, guild, id, id)}
            style={styles.category}
        >
            <TableRowGroupTitle
                title={name}
                lineClamp={1}
                style={styles.categoryTitle}
            />
            <View style={styles.follow}>
                <View style={styles.followCheckbox}>
                    <FormCheckbox checked={checked} />
                </View>
                <Text
                    variant="text-xs/semibold"
                    color="INTERACTIVE_TEXT_DEFAULT"
                >
                    {t('channelBrowser.followCategory')}
                </Text>
            </View>
        </Pressable>
    )
}

/** getActiveAgoTimestamp: "Active 3 days ago", from the newest message, else the channel's creation. */
function activeAgo(lastMessageId: string): string {
    const seconds = Math.floor(snowflakeTimestamp(lastMessageId) / 1000)
    return t('channelBrowser.activeAgo', {
        timeAgo: formatTimestamp(seconds, 'R') ?? '',
    })
}

/** ChannelBrowser's ChannelRow. A channel in a followed category is checked and can't be changed on its own. */
function ChannelRow({
    guild,
    row,
    forceChecked,
}: {
    guild: Guild
    row: Extract<BrowserRow, { type: 'channel' }>
    forceChecked: boolean
}) {
    const session = useSession()
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[row.id],
    )
    const optedIn = useSessionStore(settingsStore, state =>
        isChannelOptedIn(state, guild.id, row.id),
    )
    const parentOptedIn = useSessionStore(
        settingsStore,
        state =>
            row.parentId !== undefined &&
            isChannelOptedIn(state, guild.id, row.parentId),
    )
    const lastMessageId = useSessionStore(
        readStatesStore,
        state => state.lastMessageIds[row.id],
    )
    if (!channel) return null
    const topic =
        channel.topic || isVoice(channel)
            ? channel.topic
            : activeAgo(lastMessageId ?? channel.last_message_id ?? row.id)
    return (
        <TableCheckboxRow
            start={row.first}
            end={row.last}
            disabled={parentOptedIn}
            icon={<TableRowIcon name={channelIcon(channel.type)} />}
            label={channel.name}
            subLabel={topic || undefined}
            subLabelLineClamp={1}
            checked={optedIn || parentOptedIn || forceChecked}
            onPress={() => toggleChannel(session, guild, row.id, row.parentId)}
        />
    )
}

/**
 * ChannelBrowser ("Browse Channels"): every channel the user can see, to pick the ones the channel list shows.
 * The "Choose Your Channels" card and "new" badges are not built.
 */
export function ChannelBrowser({ guild }: { guild: Guild }) {
    const session = useSession()
    const ids = useSessionStore(channelsStore, state => state.byGuild[guild.id])
    const channels = useSessionStore(channelsStore, state => state.channels)
    const forceChecked = useSessionStore(settingsStore, state =>
        hasNotSetUpChannelOptIn(state, guild),
    )
    const [query, setQuery] = useState('')
    const rows = buildBrowserRows(ids ?? [], channels, session, query)

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <SearchField size="md" value={query} onChangeText={setQuery} />
            </View>
            <FlashList
                data={rows}
                accessibilityLabel={t('channelBrowser.title')}
                keyExtractor={row => row.id ?? 'uncategorised'}
                getItemType={row => row.type}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) =>
                    item.type === 'category' ? (
                        item.id !== null ? (
                            <CategoryHeader guild={guild} id={item.id} />
                        ) : null
                    ) : (
                        <ChannelRow
                            guild={guild}
                            row={item}
                            forceChecked={forceChecked}
                        />
                    )
                }
                contentContainerStyle={styles.list}
            />
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    screen: { flex: 1, gap: 0 },
    header: {
        marginTop: theme.space.PX_12,
        marginHorizontal: theme.space.PX_16,
    },
    list: {
        paddingTop: theme.space.PX_16,
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_16,
    },
    category: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: theme.space.PX_24,
        paddingBottom: theme.space.PX_8,
        borderRadius: theme.radii.md,
    },
    categoryTitle: { marginBottom: 0, flexShrink: 1 },
    follow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    followCheckbox: {
        marginRight: theme.space.PX_4,
        transform: [{ scale: 0.75 }],
    },
}))
