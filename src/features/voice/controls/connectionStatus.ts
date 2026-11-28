import { t } from '../../../i18n'
import type { SemanticColor } from '../../../design/tokens'
import type { VoiceConnection } from '../rtc'

/** Constants.ConnectionStatus: how the status text is coloured. */
type ConnectionStatus = 'connected' | 'connecting' | 'error'

const STATUS_COLORS: Record<ConnectionStatus, SemanticColor> = {
    connected: 'TEXT_VOICE_CONNECTED',
    connecting: 'TEXT_FEEDBACK_WARNING',
    error: 'TEXT_VOICE_DISCONNECTED',
}

/** RTCConnectionUtils.getStatus: the connection state in words, and the colour of its ConnectionStatus. */
export function connectionStatus(connection: VoiceConnection): {
    label: string
    color: SemanticColor
} {
    switch (connection) {
        case 'joining':
            return {
                label: t('voice.status.waitingForServer'),
                color: STATUS_COLORS.connecting,
            }
        case 'connecting':
            return {
                label: t('voice.status.rtcConnecting'),
                color: STATUS_COLORS.connecting,
            }
        case 'connected':
            return {
                label: t('voice.status.connected'),
                color: STATUS_COLORS.connected,
            }
        case 'reconnecting':
            return {
                label: t('voice.status.connecting'),
                color: STATUS_COLORS.connecting,
            }
        case 'disconnected':
        case 'idle':
            return {
                label: t('voice.status.disconnected'),
                color: STATUS_COLORS.error,
            }
    }
}
