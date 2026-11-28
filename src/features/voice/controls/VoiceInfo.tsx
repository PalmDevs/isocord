import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSessionStore } from '../../../core/react'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { guildsStore } from '../../../stores/guilds'
import { useCallChannelName } from '../channelTitle'
import { rtcStore } from '../rtc'
import { connectionStatus } from './connectionStatus'

/** The call's connection status over "channel / server", as the desktop client's voice connection panel shows them. */
export function VoiceInfo({
    accessibilityLabel,
    onPress,
}: {
    accessibilityLabel: string
    onPress: () => void
}) {
    const channelId = useSessionStore(rtcStore, state => state.channelId)
    const channelName = useCallChannelName(channelId)
    const guildId = useSessionStore(rtcStore, state => state.guildId)
    const guildName = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId]?.name : undefined,
    )
    const connection = useSessionStore(rtcStore, state => state.connection)
    const status = connectionStatus(connection)
    return (
        <RipplePressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            style={styles.info}
        >
            <View>
                <View style={styles.row}>
                    <Text
                        variant="text-md/semibold"
                        color={status.color}
                        lineClamp={1}
                    >
                        {status.label}
                    </Text>
                    <Icon
                        name="ChevronSmallRightIcon"
                        size="sm"
                        color="TEXT_MUTED"
                    />
                </View>
                <Text variant="text-sm/medium" color="TEXT_MUTED" lineClamp={1}>
                    {[channelName, guildName].filter(Boolean).join(' / ')}
                </Text>
            </View>
        </RipplePressable>
    )
}

const styles = StyleSheet.create(theme => ({
    info: {
        flex: 1,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: theme.space.PX_8,
        borderRadius: theme.radii.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
    },
}))
