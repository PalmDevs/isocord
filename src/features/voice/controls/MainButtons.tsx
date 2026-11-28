import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { t } from '../../../i18n'
import { DeafenButton } from './DeafenButton'
import { DisconnectButton } from './DisconnectButton'
import { MuteButton } from './MuteButton'
import { usePushToTalk } from './PushToTalkButton'

/** Voice settings, mute, deafen and disconnect, on the call's first row. Push to talk replaces mute (useControlsButtons). */
export function MainButtons({
    channelId,
    onOpenSettings,
}: {
    channelId: string
    onOpenSettings: () => void
}) {
    const pushToTalk = usePushToTalk(channelId)
    return (
        <View style={styles.buttons}>
            <IconButton
                size="md"
                variant="icon-only"
                icon="SettingsIcon"
                accessibilityLabel={t('voice.settings')}
                onPress={onOpenSettings}
            />
            {!pushToTalk && <MuteButton channelId={channelId} />}
            <DeafenButton />
            <DisconnectButton />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    buttons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
    },
}))
