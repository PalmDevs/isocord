import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { navigateRoot } from '../../../core/rootNavigation'
import { ChipRow } from './ChipRow'
import { MainButtons } from './MainButtons'
import { PushToTalkButton, usePushToTalk } from './PushToTalkButton'
import { VoiceInfo } from './VoiceInfo'

/** The settings feature's Voice & Video screen. */
const VOICE_SETTINGS_SCREEN = 'settingsVoice'

/**
 * The call's controls, the desktop client's voice connection panel with mute and deafen moved up beside
 * disconnect: status and channel with the main buttons, then a row of chips. The dock and the panel both show it.
 * `onInfoPress` is the status area's tap, which opens or closes the panel. In push to talk, the hold button
 * takes a row of its own under the chips.
 *
 * The gear opens Voice & Video settings. The reference opens a sheet over the panel. A screen goes under the
 * overlay, so `onCollapse` closes the panel first. Once collapsed, a pushed screen turns the dock into the PIP.
 */
export function VoiceControls({
    channelId,
    infoLabel,
    onInfoPress,
    onOpenChat,
    onCollapse,
}: {
    channelId: string
    infoLabel: string
    onInfoPress: () => void
    onOpenChat: () => void
    onCollapse?: () => void
}) {
    const pushToTalk = usePushToTalk(channelId)
    return (
        <View style={styles.controls}>
            <View style={styles.main}>
                <VoiceInfo
                    accessibilityLabel={infoLabel}
                    onPress={onInfoPress}
                />
                <MainButtons
                    channelId={channelId}
                    onOpenSettings={() => {
                        onCollapse?.()
                        navigateRoot(VOICE_SETTINGS_SCREEN)
                    }}
                />
            </View>
            <ChipRow channelId={channelId} onOpenChat={onOpenChat} />
            {pushToTalk && <PushToTalkButton />}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    controls: {
        gap: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_8,
        paddingBottom: theme.space.PX_8,
    },
    main: { flexDirection: 'row', alignItems: 'center' },
}))
