import { InAppNotificationHost } from './InAppNotificationHost'
import { inAppNotificationsStore } from './store'
import type { Feature } from '../../core/feature'

/** In-app notifications for new messages (the reference's InAppNotificationStore and Notifications). */
export const inAppNotificationsFeature: Feature = {
    name: 'inAppNotifications',
    // Created up front so it hears MESSAGE_CREATE; after the core stores, so their state is current when it does.
    stores: [inAppNotificationsStore],
    overlays: { inAppNotifications: InAppNotificationHost },
}
