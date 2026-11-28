import { Permission } from '../../../core/discord/permissions'
import { useSession, useSessionStore } from '../../../core/react'
import { ToggleIconButton } from '../../../design/components/buttons/IconButton'
import { t } from '../../../i18n'
import { useChannelPermissions } from '../../../stores/permissions'
import { toggleSelfMute } from '../actions'
import { rtcStore } from '../rtc'

/** The microphone toggle. A server mute without permission to speak locks it. */
export function MuteButton({ channelId }: { channelId: string }) {
    const session = useSession()
    const permissions = useChannelPermissions(channelId)
    const canSpeak = (permissions & Permission.SPEAK) !== 0n
    const muted = useSessionStore(
        rtcStore,
        state => state.selfMute || state.selfDeaf || state.serverMute,
    )
    return (
        <ToggleIconButton
            size="md"
            icon="MicrophoneIcon"
            selectedIcon="MicrophoneDenyIcon"
            pressed={muted}
            disabled={muted && !canSpeak}
            accessibilityLabel={muted ? t('voice.unmute') : t('voice.mute')}
            onPress={() => toggleSelfMute(session)}
        />
    )
}
