import { Icon } from '../../../design/icons/Icon'
import type { ImageStyle, StyleProp } from 'react-native'
import type { SemanticColor } from '../../../design/tokens'
import type { VoiceState } from '../../../stores/voiceStates'

/**
 * VoiceUserItem's mute and deafen icons: a server mute or deafen is critical red, the user's own is `color`. A user
 * this account muted for itself (`localMute`) gets the deny icon in `color`. Renders a fragment, so the parent lays
 * the icons out.
 */
export function VoiceStateIcons({
    voice,
    color,
    localMute = false,
    style,
}: {
    voice: VoiceState
    color: SemanticColor
    localMute?: boolean
    style?: StyleProp<ImageStyle>
}) {
    const serverMuted = voice.mute || voice.suppress
    return (
        <>
            {(serverMuted || localMute || voice.selfMute) && (
                <Icon
                    name={
                        serverMuted || localMute
                            ? 'MicrophoneDenyIcon'
                            : 'MicrophoneSlashIcon'
                    }
                    size="xs"
                    color={serverMuted ? 'TEXT_FEEDBACK_CRITICAL' : color}
                    style={style}
                />
            )}
            {(voice.deaf || voice.selfDeaf) && (
                <Icon
                    name={
                        voice.deaf
                            ? 'HeadphonesDenyIcon'
                            : 'HeadphonesSlashIcon'
                    }
                    size="xs"
                    color={voice.deaf ? 'TEXT_FEEDBACK_CRITICAL' : color}
                    style={style}
                />
            )}
        </>
    )
}
