// biome-ignore lint/correctness/useReactNativePlatformComponents: Isocord only runs on Android.
import { Linking, PermissionsAndroid, Platform } from 'react-native'
import { accountsStore } from '../../core/accounts'
import native from '../../native/NativeIsocordNotifications'
import { systemNotificationsStore } from './prefs'

/**
 * SystemNotificationsSetting's `_handleEnableSystemNotification`: turning it on asks for the notification permission
 * first, and opens the app's settings when it was refused for good. Then, unlike the reference (which needs no
 * connection of its own), it asks to be left out of battery optimisation, without which the system cuts the
 * connection.
 */
export async function setSystemNotifications(enabled: boolean): Promise<void> {
    if (enabled && Platform.OS === 'android' && Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        )
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)
                void Linking.openSettings()
            return
        }
    }
    native.setEnabled(enabled)
    systemNotificationsStore.setState({ enabled })
    if (enabled && !native.isIgnoringBatteryOptimizations())
        native.requestIgnoreBatteryOptimizations()
}

export function setNotifyEveryMessage(everyMessage: boolean): void {
    native.setNotifyEveryMessage(everyMessage)
    systemNotificationsStore.setState({ everyMessage })
}

// Logged out of every account: nothing may keep running with a token that is gone.
accountsStore.subscribe(state => {
    if (state.currentId === null) native.clearAccount()
})
