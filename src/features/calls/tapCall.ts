import { showSimpleActionSheet } from '../../design/components/sheets/showSimpleActionSheet'
import { t } from '../../i18n'
import { joinCall, startCall } from './actions'
import { callsStore, isCallActive } from './calls'
import type { Session } from '../../core/session'

/** useIsCallActive.checkIsCallActive: the channel's call is going and the card is its message. */
function isCardActive(
    session: Session,
    channelId: string,
    messageId: string,
): boolean {
    const state = session.get(callsStore).getState()
    return (
        isCallActive(state, channelId) &&
        state.calls[channelId]?.messageId === messageId
    )
}

/**
 * MessagesHandlers.handleTapCall: a tapped call card joins its call while it is going. An ended call's card offers
 * to start a voice or video call (the "CallTap" sheet).
 */
export function handleTapCall(
    session: Session,
    channelId: string,
    messageId: string,
): void {
    if (isCardActive(session, channelId, messageId)) {
        void joinCall(session, channelId)
        return
    }
    showSimpleActionSheet({
        key: 'CallTap',
        hasIcons: true,
        options: [
            {
                label: t('calls.startVoiceCall'),
                icon: 'PhoneCallIcon',
                onPress: () => void startCall(session, channelId),
            },
            {
                label: t('calls.startVideoCall'),
                icon: 'VideoIcon',
                onPress: () => void startCall(session, channelId, true),
            },
        ],
    })
}
