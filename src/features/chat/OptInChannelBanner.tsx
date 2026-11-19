import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession } from '../../core/react'
import { Button } from '../../design/components/buttons/Button'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { setChannelOptIn } from '../../stores/settings/settingsActions'

/** ChatBanner's OptInChannelBanner: "+ Add" puts the channel on the channel list (setOptInChannel). */
export function OptInChannelBanner({
    guildId,
    channelId,
}: {
    guildId: string
    channelId: string
}) {
    const session = useSession()
    return (
        <View style={styles.banner}>
            <Text variant="text-sm/semibold" lineClamp={2} style={styles.text}>
                {t('chat.optIn.notOnList')}
            </Text>
            <View style={styles.button}>
                <Button
                    size="sm"
                    text={t('chat.optIn.add')}
                    onPress={() =>
                        setChannelOptIn(session, guildId, channelId, true)
                    }
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    banner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
        paddingVertical: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_16,
        backgroundColor: theme.colors.CHAT_BANNER_BG,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.CHAT_BORDER,
    },
    text: { flex: 1 },
    button: { flexShrink: 0, marginLeft: theme.space.PX_8 },
}))
