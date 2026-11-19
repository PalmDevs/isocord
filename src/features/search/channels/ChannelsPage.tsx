import { FlashList } from '@shopify/flash-list'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { snowflakeTimestamp } from '../../../core/discord/snowflake'
import { useSessionStore } from '../../../core/react'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { openFromDetails } from '../../chat/links/openChannel'
import { channelIcon } from '../../servers/channelIcon'
import { SectionHeader } from '../global/rows'
import { ErrorScreen } from '../messages/ResultList'
import { useSettledQuery } from '../useSettledQuery'
import { useGuildChannelResults } from './useGuildChannelResults'
import type { SearchTabPageProps } from '../types'

type Row =
    | { key: string; kind: 'section'; title: string }
    | { key: string; kind: 'channel'; id: string; lastMessageId?: string }

/** SearchUtils.getChannelActiveAgoTimestamp: how long ago the channel's newest message was sent. */
function activeAgo(lastMessageId: string): string {
    const seconds = (Date.now() - snowflakeTimestamp(lastMessageId)) / 1000
    if (seconds > 31536000)
        return t('search.channels.activeYears', {
            count: Math.round(seconds / 31536000),
        })
    if (seconds > 2592000)
        return t('search.channels.activeMonths', {
            count: Math.round(seconds / 2592000),
        })
    if (seconds > 172800)
        return t('search.channels.activeDays', {
            count: Math.round(seconds / 86400),
        })
    if (seconds > 86400) return t('search.channels.activeYesterday')
    if (seconds > 3600)
        return t('search.channels.activeHours', {
            count: Math.round(seconds / 3600),
        })
    if (seconds > 60)
        return t('search.channels.activeMinutes', {
            count: Math.round(seconds / 60),
        })
    return t('search.channels.activeJustNow')
}

/**
 * list/rows/GuildChannelRow (GuildTextChannelRow and GuildVoiceOrStageChannelRow): the channel's simple icon, its
 * name and, for a text channel, when it was last active.
 */
export function ChannelRow({
    id,
    lastMessageId,
    onPress,
}: {
    id: string
    lastMessageId?: string
    onPress: (id: string) => void
}) {
    const channel = useSessionStore(channelsStore, state => state.channels[id])
    if (!channel) return null
    return (
        <RipplePressable
            accessibilityRole="button"
            accessibilityLabel={channel.name}
            onPress={() => onPress(id)}
            style={styles.row}
        >
            <Icon
                name={channelIcon(channel.type)}
                color="TEXT_MUTED"
                style={styles.icon}
            />
            <View style={styles.label}>
                <Text
                    variant="text-md/medium"
                    color="INTERACTIVE_TEXT_DEFAULT"
                    lineClamp={1}
                >
                    {channel.name}
                </Text>
                {lastMessageId ? (
                    <Text
                        variant="text-xs/medium"
                        color="TEXT_MUTED"
                        lineClamp={1}
                    >
                        {activeAgo(lastMessageId)}
                    </Text>
                ) : null}
            </View>
        </RipplePressable>
    )
}

/**
 * ChannelsScreen: the server's channels whose name has the query (all of them without one), the text channels
 * active most recently first, then the voice channels.
 */
export function ChannelsPage({
    context,
    query,
    onDismiss,
}: SearchTabPageProps) {
    const settled = useSettledQuery(query)
    const results = useGuildChannelResults(
        context.type === 'GUILD_CHANNEL' ? context.guildId : undefined,
        settled,
    )
    // useOnPressGuildTextChannel and useOnPressGuildVoiceChannel: the details slide away, then the chat switches to the channel.
    const open = (id: string) => {
        openFromDetails(id, onDismiss)
    }

    const rows: Row[] = []
    if (results.text.length > 0) {
        rows.push({
            key: 'text',
            kind: 'section',
            title: t('search.channels.text'),
        })
        for (const { id, lastMessageId } of results.text)
            rows.push({ key: id, kind: 'channel', id, lastMessageId })
    }
    if (results.voice.length > 0) {
        rows.push({
            key: 'voice',
            kind: 'section',
            title: t('search.channels.voice'),
        })
        for (const id of results.voice)
            rows.push({ key: id, kind: 'channel', id })
    }

    if (rows.length === 0 && settled !== '')
        return <ErrorScreen text={t('search.noResults')} />
    return (
        <FlashList
            data={rows}
            keyExtractor={row => row.key}
            keyboardShouldPersistTaps="handled"
            getItemType={row => row.kind}
            contentContainerStyle={styles.content}
            renderItem={({ item: row }) =>
                row.kind === 'section' ? (
                    <SectionHeader title={row.title} />
                ) : (
                    <ChannelRow
                        id={row.id}
                        lastMessageId={row.lastMessageId}
                        onPress={open}
                    />
                )
            }
        />
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    content: { paddingBottom: runtime.insets.bottom + theme.space.PX_16 },
    // SearchListRow's 16 across; GuildChannelRow's containerStyle replaces its tap-state padding with 10 down.
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space.PX_16,
        paddingVertical: theme.space.PX_10,
    },
    // GuildChannelRow simpleIcon: 20 dp, 8 dp before the name.
    icon: { width: 20, height: 20, marginRight: theme.space.PX_8 },
    label: { flex: 1 },
}))
