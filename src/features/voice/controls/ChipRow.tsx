import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Permission } from '../../../core/discord/permissions'
import { useSession, useSessionStore } from '../../../core/react'
import { t } from '../../../i18n'
import { useChannelPermissions } from '../../../stores/permissions'
import { showGoLiveSheet } from '../goLive/GoLiveSheet'
import { stopStream } from '../streamActions'
import { streamsStore } from '../streams'
import { CameraChip } from './CameraChip'
import { VoiceChip } from './VoiceChip'

/** Camera and screen share, for those who may stream. */
function StreamChips({ channelId }: { channelId: string }) {
    const session = useSession()
    const permissions = useChannelPermissions(channelId)
    const sharing = useSessionStore(
        streamsStore,
        state => state.own && (state.streamKey !== null || state.starting),
    )
    if ((permissions & Permission.STREAM) === 0n) return null
    return (
        <>
            <CameraChip />
            <VoiceChip
                icon={sharing ? 'MobilePhoneDenyIcon' : 'MobilePhoneShareIcon'}
                label={
                    sharing ? t('voice.stopSharing') : t('voice.shareScreen')
                }
                on={sharing}
                // MobileGoLiveActionSheet picks the quality before the screen consent.
                onPress={() =>
                    sharing ? stopStream(session) : showGoLiveSheet()
                }
            />
        </>
    )
}

/**
 * The call's second row: equal-width chips for what the call can do. A soundboard chip joins these later.
 * `onOpenChat` opens the voice channel's text chat (VoicePanelVoiceControls' chat button).
 */
export function ChipRow({
    channelId,
    onOpenChat,
}: {
    channelId: string
    onOpenChat: () => void
}) {
    return (
        <View style={styles.row}>
            <StreamChips channelId={channelId} />
            <VoiceChip
                icon="ChatIcon"
                label={t('voice.openChat')}
                onPress={onOpenChat}
            />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    row: { flexDirection: 'row', gap: theme.space.PX_8 },
}))
