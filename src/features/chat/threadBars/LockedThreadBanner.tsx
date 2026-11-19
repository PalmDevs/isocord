import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { canLockThread, toggleLock } from '../../channelSettings'
import type { Channel } from '../../../stores/channels/channels'

/** ChatBanner's LockedThreadChatBanner: the locked notice, with Unlock for thread moderators. */
export function LockedThreadBanner({
    channel,
    forumPost,
}: {
    channel: Channel
    forumPost: boolean
}) {
    const session = useSession()
    return (
        <View style={styles.banner}>
            <Icon name="LockIcon" size="xs" color="ICON_MUTED" />
            <Text variant="text-sm/medium" lineClamp={4} style={styles.text}>
                {t(
                    forumPost
                        ? 'chat.threadBar.lockedPost'
                        : 'chat.threadBar.lockedThread',
                )}
            </Text>
            {canLockThread(session, channel) && (
                <View style={styles.button}>
                    <Button
                        size="sm"
                        variant="secondary"
                        text={t('chat.threadBar.unlock')}
                        accessibilityLabel={t(
                            forumPost
                                ? 'threadActions.unlockPost'
                                : 'threadActions.unlockThread',
                        )}
                        onPress={() => void toggleLock(session, channel)}
                    />
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_16,
        overflow: 'hidden',
        paddingVertical: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_16,
        backgroundColor: theme.colors.CHAT_BANNER_BG,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.CHAT_BORDER,
    },
    text: { flex: 1 },
    button: { flexShrink: 0 },
}))
