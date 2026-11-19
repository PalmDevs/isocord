import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { snowflakeTimestamp } from '../../core/discord/snowflake'
import { useSession } from '../../core/react'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { ackChannel } from '../../stores/readStates'
import { formatTimestamp } from './timestamp'
import type { NewMessages } from './useNewMessages'

/**
 * Renders the "N new messages since <time>" strip under the chat header (ChatBanner, NewMessagesChatBar).
 * A tap scrolls to the first of them. The close button marks the chat read.
 */
export function NewMessagesBar({
    channelId,
    newMessages: { count, estimated, oldestUnreadId, newestId },
    onPress,
}: {
    channelId: string
    newMessages: NewMessages
    onPress: () => void
}) {
    const session = useSession()
    const values = {
        count: count.toLocaleString(),
        timestamp:
            formatTimestamp(
                Math.floor(snowflakeTimestamp(oldestUnreadId) / 1000),
                't',
            ) ?? '',
    }

    return (
        <View style={styles.bar}>
            <RipplePressable
                accessibilityRole="button"
                style={styles.text}
                onPress={onPress}
            >
                <Text variant="text-sm/semibold" color="TEXT_OVERLAY_LIGHT">
                    {t(
                        estimated
                            ? 'chat.newMessages.estimated'
                            : count === 1
                              ? 'chat.newMessages.one'
                              : 'chat.newMessages.other',
                        values,
                    )}
                </Text>
            </RipplePressable>
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={t('chat.markAsRead')}
                style={styles.close}
                onPress={() => ackChannel(session, channelId, newestId)}
            >
                <Icon name="XSmallBoldIcon" size="sm" color="WHITE" />
            </RipplePressable>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    bar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        minHeight: 45,
        backgroundColor: theme.colors.BACKGROUND_BRAND,
    },
    text: {
        flex: 1,
        justifyContent: 'center',
        paddingLeft: theme.space.PX_16,
        paddingVertical: theme.space.PX_10,
    },
    close: {
        justifyContent: 'center',
        paddingHorizontal: theme.space.PX_12,
    },
}))
