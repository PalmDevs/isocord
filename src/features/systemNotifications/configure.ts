import { encodeProperties } from '../../core/api/identity'
import { GATEWAY_CAPABILITIES } from '../../core/constants'
import { t } from '../../i18n'
import native from '../../native/IsocordNotifications'
import type { Session } from '../../core/session'

/** The account as GatewayService needs it (AccountConfig in NotificationPrefs.kt). */
export function configure(session: Session): void {
    const { identity } = session.rest
    // The background session is never the app in use (SessionHeartbeatScheduler, RequestGatewaySocket).
    const properties = {
        ...identity.superProperties(),
        client_app_state: 'background',
    }
    native.configure(
        JSON.stringify({
            userId: session.userId,
            token: session.token,
            capabilities: GATEWAY_CAPABILITIES,
            properties: JSON.stringify({
                ...properties,
                is_fast_connect: false,
                gateway_connect_reasons: 'NO_REASONS',
            }),
            headers: session.rest.accountHeaders(encodeProperties(properties)),
            strings: {
                groupRealtime: t('systemNotifications.groupRealtime'),
                groupSocial: t('systemNotifications.groupSocial'),
                groupServer: t('systemNotifications.groupServer'),
                channelDirectMessages: t('systemNotifications.directMessages'),
                channelMessages: t('systemNotifications.messages'),
                channelConnection: t('systemNotifications.connection'),
                channelInApp: t('settings.inAppNotifications.section'),
                groupOther: t('systemNotifications.groupOther'),
                channelCalls: t('systemNotifications.calls'),
                channelFriendRequests: t('systemNotifications.friendRequests'),
                channelReactions: t('systemNotifications.reactions'),
                channelForum: t('systemNotifications.forum'),
                channelEvents: t('systemNotifications.events'),
                channelSystem: t('systemNotifications.systemMessages'),
                incomingCall: t('systemNotifications.incomingCall'),
                decline: t('systemNotifications.decline'),
                accept: t('systemNotifications.accept'),
                answerCall: t('systemNotifications.answerCall'),
                declineCall: t('systemNotifications.declineCall'),
                ignore: t('systemNotifications.ignore'),
                // Templates: the service fills in {username} and {emoji}.
                friendRequest: t('systemNotifications.friendRequest'),
                friendAccepted: t('systemNotifications.friendAccepted'),
                reacted: t('systemNotifications.reacted'),
                happeningNow: t('systemNotifications.happeningNow'),
                connected: t('systemNotifications.connected'),
                connecting: t('systemNotifications.connecting'),
                reply: t('systemNotifications.reply'),
                markAsRead: t('systemNotifications.markAsRead'),
                spoiler: t('systemNotifications.spoiler'),
                you: t('messages.previewYou'),
                unnamedGroup: t('messages.unnamedGroup'),
                previewImage: t('messages.previewImage'),
                previewVideo: t('messages.previewVideo'),
                previewAudio: t('messages.previewAudio'),
                previewFile: t('messages.previewFile'),
                previewSticker: t('messages.previewSticker'),
                previewEmbed: t('messages.previewEmbed'),
                previewForwarded: t('messages.previewForwarded'),
            },
        }),
    )
}
