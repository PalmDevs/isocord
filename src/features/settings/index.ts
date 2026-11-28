import { SettingsAppearanceCustomThemeScreen } from './appearance/CustomThemeScreen'
import {
    SettingsAccessibilityScreen,
    SettingsAdvancedScreen,
    SettingsAppearanceDarkModeScreen,
    SettingsAppearanceLightModeScreen,
    SettingsAppearanceScreen,
    SettingsChatScreen,
    SettingsNotificationsScreen,
    SettingsNotifOtherScreen,
    SettingsNotifRealtimeScreen,
    SettingsNotifServerScreen,
    SettingsNotifSocialScreen,
    SettingsOverviewScreen,
    SettingsSwipeRightToLeftScreen,
    SettingsVoiceScreen,
} from './screens'
import type { Feature } from '../../core/feature'

/** The app's settings (user_settings in the reference). Opened from the You tab. */
export const settingsFeature: Feature = {
    name: 'settings',
    screens: {
        settings: SettingsOverviewScreen,
        settingsAppearance: SettingsAppearanceScreen,
        settingsAppearanceLightMode: SettingsAppearanceLightModeScreen,
        settingsAppearanceDarkMode: SettingsAppearanceDarkModeScreen,
        settingsAppearanceCustomTheme: SettingsAppearanceCustomThemeScreen,
        settingsAccessibility: SettingsAccessibilityScreen,
        settingsChat: SettingsChatScreen,
        settingsSwipeRightToLeft: SettingsSwipeRightToLeftScreen,
        settingsNotifications: SettingsNotificationsScreen,
        settingsNotifRealtime: SettingsNotifRealtimeScreen,
        settingsNotifSocial: SettingsNotifSocialScreen,
        settingsNotifServer: SettingsNotifServerScreen,
        settingsNotifOther: SettingsNotifOtherScreen,
        settingsAdvanced: SettingsAdvancedScreen,
        settingsVoice: SettingsVoiceScreen,
    },
}
