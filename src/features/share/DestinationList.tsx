import { FlatList, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { ChannelType } from '../../core/discord/channelType'
import { useSessionStore } from '../../core/react'
import { Avatar } from '../../design/components/avatars/Avatar'
import { GuildIcon } from '../../design/components/avatars/GuildIcon'
import { SearchField } from '../../design/components/inputs/SearchField'
import { Text } from '../../design/components/Text'
import { TableCheckboxRow } from '../../design/components/table/TableControlRows'
import { t } from '../../i18n'
import { guildsStore } from '../../stores/guilds'
import { GroupAvatar } from '../messages/GroupAvatar'
import type { Destination } from './destinations'

/** GuildIconWithChannelType's SMALL_32 and the user rows' avatar. */
const ICON_SIZE = 32

/**
 * SearchableDestinationList: the search field over the places to pick, each a checkbox row.
 * Past `full`, rows that aren't picked are disabled (`disableSelection`).
 */
export function DestinationList({
    destinations,
    selected,
    full,
    query,
    onQueryChange,
    onToggle,
}: {
    destinations: Destination[]
    selected: string[]
    full: boolean
    query: string
    onQueryChange: (query: string) => void
    onToggle: (channelId: string) => void
}) {
    const { theme } = useUnistyles()
    return (
        <View style={styles.container}>
            <View style={styles.searchBar}>
                <SearchField
                    size="md"
                    value={query}
                    onChangeText={onQueryChange}
                    accessibilityLabel={t('share.searchLabel')}
                />
            </View>
            <FlatList
                data={destinations}
                keyExtractor={item => item.channel.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text
                        variant="text-md/medium"
                        color="TEXT_MUTED"
                        style={styles.empty}
                    >
                        {t('search.noResults')}
                    </Text>
                }
                renderItem={({ item, index }) => {
                    const checked = selected.includes(item.channel.id)
                    return (
                        <TableCheckboxRow
                            label={item.name}
                            subLabel={item.unavailable ?? subLabelOf(item)}
                            icon={<DestinationIcon destination={item} />}
                            checked={checked}
                            disabled={
                                item.unavailable !== undefined ||
                                (full && !checked)
                            }
                            start={index === 0}
                            end={index === destinations.length - 1}
                            onPress={() => onToggle(item.channel.id)}
                        />
                    )
                }}
                // Leaves room for the composer, which floats over the list's end.
                ListFooterComponent={
                    <View
                        style={{
                            height: theme.modules.mobile
                                .CHAT_INPUT_FLOATING_SCRIM_GRADIENT_HEIGHT,
                        }}
                    />
                }
            />
        </View>
    )
}

/** ChannelRow's server name, UserRow's username. */
const subLabelOf = (destination: Destination) =>
    destination.guildName ?? destination.user?.username

/** A server channel's server, a DM's user, a group DM's icon. */
function DestinationIcon({ destination }: { destination: Destination }) {
    const { channel, user, name } = destination
    const guild = useSessionStore(guildsStore, state =>
        channel.guild_id ? state.guilds[channel.guild_id] : undefined,
    )
    if (user) return <Avatar user={user} size={ICON_SIZE} />
    if (channel.type === ChannelType.GROUP_DM)
        return (
            <GroupAvatar
                id={channel.id}
                name={name}
                icon={channel.icon}
                size={ICON_SIZE}
            />
        )
    if (!guild) return null
    return (
        <GuildIcon
            guild={{ id: guild.id, name: guild.name, icon: guild.icon ?? null }}
            size={ICON_SIZE}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    container: { flex: 1 },
    searchBar: {
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: theme.space.PX_8,
    },
    list: { paddingHorizontal: theme.space.PX_16 },
    empty: { textAlign: 'center', padding: theme.space.PX_16 },
}))
