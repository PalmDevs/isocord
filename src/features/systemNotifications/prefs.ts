import { createStore } from 'zustand/vanilla'
import { notificationKind } from '../../native/NativeIsocordConstants'
import native from '../../native/NativeIsocordNotifications'

/** One of `notificationKind`, the kinds under "Notify me about". */
export type NotificationKind = string

/** The system notification settings, kept natively so the service can read them without JS. */
export const systemNotificationsStore = createStore(() => ({
    enabled: native.isEnabled(),
    everyMessage: native.notifyEveryMessage(),
    kinds: Object.fromEntries(
        Object.values(notificationKind).map(kind => [
            kind,
            native.kindEnabled(kind),
        ]),
    ) as Record<NotificationKind, boolean>,
}))

export function setNotificationKind(
    kind: NotificationKind,
    enabled: boolean,
): void {
    native.setKindEnabled(kind, enabled)
    systemNotificationsStore.setState(state => ({
        kinds: { ...state.kinds, [kind]: enabled },
    }))
}
