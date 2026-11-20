import { registerFeature } from '../core/feature'
import { accountsFeature } from '../features/accounts'
import { alertsFeature } from '../features/alerts'
import { captchaFeature } from '../features/captcha'
import { channelBrowserFeature } from '../features/channelBrowser'
import { channelSettingsFeature } from '../features/channelSettings'
import { debugLogsFeature } from '../features/debugLogs'
import { expressionsFeature } from '../features/expressions'
import { filePreviewFeature } from '../features/filePreview'
import { inAppNotificationsFeature } from '../features/inAppNotifications'
import { mediaViewerFeature } from '../features/mediaViewer'
import { perfFeature } from '../features/perf'
import { globalSearchFeature } from '../features/search/global'
import { systemNotificationsFeature } from '../features/systemNotifications'
import '../features/expressions/picker'
import '../features/upload/composerSlots'
import { GalleryPageScreen } from '../features/gallery/GalleryPageScreen'
import { GalleryScreen } from '../features/gallery/GalleryScreen'
import { serversUiStore } from '../features/servers/store'
import { settingsFeature } from '../features/settings'
import { shareFeature } from '../features/share'
import { sheetsFeature } from '../features/sheets'
import { toastsFeature } from '../features/toasts'
import { registerProfileSheet } from '../features/userProfile/openProfileSheet'
import { UserProfileSheet } from '../features/userProfile/UserProfileSheet'
import { storesFeature } from '../stores'

registerProfileSheet(UserProfileSheet)

// Built-in features, in registration order. External plugins will register the same way.
registerFeature(storesFeature)
registerFeature({ name: 'servers', stores: [serversUiStore] })
registerFeature(expressionsFeature)
registerFeature(captchaFeature)
registerFeature(accountsFeature)
registerFeature(globalSearchFeature)
registerFeature(settingsFeature)
registerFeature(channelBrowserFeature)
registerFeature(channelSettingsFeature)
registerFeature(debugLogsFeature)
registerFeature(filePreviewFeature)
registerFeature(shareFeature)
// Before alerts, sheets and toasts, which open over the viewer (reactions, the reaction picker).
registerFeature(mediaViewerFeature)
registerFeature(alertsFeature)
registerFeature(sheetsFeature)
registerFeature(inAppNotificationsFeature)
registerFeature(systemNotificationsFeature)
// Last, so toasts draw above alerts, sheets and in-app notifications.
registerFeature(toastsFeature)
// After toasts, so the overlay's numbers stay visible over everything.
registerFeature(perfFeature)
registerFeature({
    name: 'gallery',
    screens: { gallery: GalleryScreen, galleryPage: GalleryPageScreen },
})
