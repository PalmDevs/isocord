import native from '../../native/NativeIsocordNotifications'
import { forwardAlerts } from './alerts'
import { configure } from './configure'
import { forward } from './forward'
import { systemNotificationsStore } from './prefs'
import type { Feature } from '../../core/feature'

/**
 * System notifications: in the background from a gateway session of their own, in front from what the app's session
 * forwards (forward.ts). Messages are forwarded by the in-app notifications, which follow the same decision.
 */
export const systemNotificationsFeature: Feature = {
    name: 'systemNotifications',
    setup: session => {
        configure(session)
        const { gateway } = session
        // Only one connection at a time: in the background the service's session takes over from the app's.
        const pause = () => {
            gateway.pauseInBackground =
                systemNotificationsStore.getState().enabled
        }
        pause()
        const cleanups = [
            systemNotificationsStore.subscribe(pause),
            // READY brings the account's language (LocaleStore), which the REST headers carry.
            gateway.dispatch.on('READY', () => configure(session)),
            // Read here or anywhere else: the notification drops what is read, the service's session being paused.
            gateway.dispatch.on('MESSAGE_ACK', ack => {
                if (systemNotificationsStore.getState().enabled)
                    native.ack(ack.channel_id, ack.message_id)
            }),
            // Ends the app session's replay window (Handover.kt). READY does too, forwarded by the alerts.
            gateway.dispatch.on('RESUMED', () =>
                forward(session, 'RESUMED', {}, {}),
            ),
            forwardAlerts(session),
        ]
        return () => {
            for (const cleanup of cleanups) cleanup()
        }
    },
}
