import { useEffect } from 'react'
import { useStore } from 'zustand'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import {
    DEFAULT_FONT_SCALE_STATE,
    fontScaleStore,
    saveFontScale,
} from './fontScale'
import { SearchableSettingsScreen, SettingsScreen } from './SettingsList'

// SettingsOverviewScreen's getOverviewSettings, with only the settings Isocord implements.
export function SettingsOverviewScreen() {
    return (
        <SearchableSettingsScreen
            title={t('settings.title')}
            sections={[
                {
                    label: t('settings.appSettings'),
                    settings: [
                        'APPEARANCE',
                        'ACCESSIBILITY',
                        'CHAT',
                        'NOTIFICATIONS',
                        'ADVANCED',
                    ],
                },
                { settings: ['MANAGE_ACCOUNTS', 'LOGOUT'] },
                {
                    label: t('settings.developerSettings'),
                    settings: ['APP_VERSION', 'VIEW_DEBUG_LOGS', 'PERFORMANCE'],
                },
                {
                    label: t('settings.staffSettings'),
                    settings: ['DESIGN_SYSTEMS'],
                },
            ]}
        />
    )
}

/**
 * SettingsAppearanceScreen's useFontScalingData: a Save button in the header while the picked zoom level differs from
 * the saved one. Leaving the screen drops an unsaved pick.
 */
function FontScaleSaveButton() {
    const fontScale = useStore(fontScaleStore, state => state.fontScale)
    const persisted = useStore(
        fontScaleStore,
        state => state.persistedFontScale,
    )
    useEffect(() => () => fontScaleStore.setState(DEFAULT_FONT_SCALE_STATE), [])
    if (fontScale === persisted) return null
    return (
        <RipplePressable
            borderless
            radius={24}
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => saveFontScale(fontScale)}
        >
            <Text variant="text-md/medium" color="TEXT_BRAND">
                {t('settings.save')}
            </Text>
        </RipplePressable>
    )
}

// SettingsAppearanceScreen's getAppearanceSettings: the Theme section, its single picker a radio group of its own,
// and the Zoom level section, without Classic chat text size.
export function SettingsAppearanceScreen() {
    return (
        <SettingsScreen
            title={t('settings.appearance')}
            trailing={<FontScaleSaveButton />}
            sections={[
                {
                    label: t('settings.theme'),
                    settings: [
                        'SAME_AS_DEVICE_THEME',
                        'LIGHT_MODE_THEME_PICKER',
                        'DARK_MODE_THEME_PICKER',
                    ],
                },
                { settings: ['APPEARANCE_THEME_PICKER'] },
                {
                    label: t('settings.zoomLevel'),
                    settings: ['ANDROID_FONT_SCALE'],
                },
            ]}
        />
    )
}

// SettingsAppearanceLightModeThemePickerScreen
export function SettingsAppearanceLightModeScreen() {
    return (
        <SettingsScreen
            title={t('settings.theme.lightMode')}
            sections={[{ settings: ['LIGHT_MODE_THEME'] }]}
        />
    )
}

// SettingsAppearanceDarkModeThemePickerScreen
export function SettingsAppearanceDarkModeScreen() {
    return (
        <SettingsScreen
            title={t('settings.theme.darkMode')}
            sections={[{ settings: ['DARK_MODE_THEME'] }]}
        />
    )
}

// SettingsAccessibilityScreen's getAccessibilitySettingScreen: the animated emoji section.
export function SettingsAccessibilityScreen() {
    return (
        <SettingsScreen
            title={t('settings.accessibility')}
            sections={[{ settings: ['ANIMATE_EMOJI'] }]}
        />
    )
}

// SettingsChatScreen's getChatSettings: the Gestures section, plus Isocord's copy gestures.
export function SettingsChatScreen() {
    return (
        <SettingsScreen
            title={t('settings.chat')}
            sections={[
                {
                    label: t('settings.gestures'),
                    settings: [
                        'SWIPE_RIGHT_TO_LEFT',
                        'TAP_INLINE_CODE_TO_COPY',
                        'HOLD_EMBED_TO_COPY',
                    ],
                },
            ]}
        />
    )
}

// SwipeRightToLeftScreen (UserSettingsSwipeRightToLeft).
export function SettingsSwipeRightToLeftScreen() {
    return (
        <SettingsScreen
            title={t('settings.swipeRightToLeft')}
            sections={[{ settings: ['CHAT_GESTURES'] }]}
        />
    )
}

// SettingsNotificationScreen's getNotificationSettings: the In-app and System notifications sections.
export function SettingsNotificationsScreen() {
    return (
        <SettingsScreen
            title={t('settings.notifications')}
            sections={[
                {
                    label: t('settings.inAppNotifications.section'),
                    settings: ['IN_APP_NOTIFICATIONS', 'NEW_UNREADS'],
                },
                {
                    label: t('settings.systemNotifications.section'),
                    settings: [
                        'SYSTEM_NOTIFICATIONS',
                        'ANDROID_MESSAGE_NOTIFICATIONS',
                    ],
                },
                // buildOverviewCategoriesSection
                {
                    label: t('settings.notifyMeAbout'),
                    settings: [
                        'NOTIF_REALTIME',
                        'NOTIF_CATEGORY_SOCIAL',
                        'NOTIF_CATEGORY_SERVER',
                        'NOTIF_CATEGORY_OTHER',
                    ],
                },
            ]}
        />
    )
}

// RedesignSettingsRealtimeScreen and the Category Social, Server and Other screens.
export function SettingsNotifRealtimeScreen() {
    return (
        <SettingsScreen
            title={t('systemNotifications.groupRealtime')}
            sections={[{ settings: ['NOTIF_CALLS'] }]}
        />
    )
}

export function SettingsNotifSocialScreen() {
    return (
        <SettingsScreen
            title={t('systemNotifications.groupSocial')}
            sections={[
                {
                    settings: [
                        'NOTIF_DIRECT_MESSAGES',
                        'NOTIF_FRIEND_REQUESTS',
                        'NOTIF_REACTIONS',
                    ],
                },
            ]}
        />
    )
}

export function SettingsNotifServerScreen() {
    return (
        <SettingsScreen
            title={t('systemNotifications.groupServer')}
            sections={[
                {
                    settings: ['NOTIF_MESSAGES', 'NOTIF_FORUM', 'NOTIF_EVENTS'],
                },
            ]}
        />
    )
}

export function SettingsNotifOtherScreen() {
    return (
        <SettingsScreen
            title={t('systemNotifications.groupOther')}
            sections={[{ settings: ['NOTIF_SYSTEM_MESSAGES'] }]}
        />
    )
}

// SettingsAdvancedScreen's getAdvancedSettings: the General section.
export function SettingsAdvancedScreen() {
    return (
        <SettingsScreen
            title={t('settings.advanced')}
            sections={[
                {
                    label: t('settings.general'),
                    settings: ['DEVELOPER_MODE'],
                    subLabel: t('settings.developerMode.description'),
                },
            ]}
        />
    )
}
