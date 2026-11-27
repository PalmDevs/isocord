import { useStore } from 'zustand'
import {
    accountsStore,
    currentAccount,
    removeAccount,
} from '../../core/accounts'
import { logout } from '../../core/api/auth'
import { CLIENT } from '../../core/constants'
import { showConfirmModal } from '../../design/components/modals/showAlert'
import {
    setModeTheme,
    setSameAsDeviceTheme,
    setTheme,
} from '../../design/tokens'
import { t } from '../../i18n'
import { notificationKind } from '../../native/IsocordConstants'
import { setChatGesture } from '../../stores/settings/chatGestures'
import {
    setAnimateEmoji,
    setDeveloperMode,
    setNewNotifications,
    setShowInAppNotifications,
    setSwipeRightToLeftMode,
} from '../../stores/settings/settingsActions'
import {
    canSaveSettings,
    SwipeRightToLeftMode,
} from '../../stores/settings/settingsStore'
import {
    setNotificationKind,
    setNotifyEveryMessage,
    setSystemNotifications,
} from '../systemNotifications'
import { themeName } from './appearance/themeNames'
import { FONT_SCALES, fontScaleStore } from './fontScale'
import type { Session } from '../../core/session'
import type { TableRowVariant } from '../../design/components/table/TableRow'
import type { IconName } from '../../design/icons/Icon'
import type { SystemTheme, ThemeChoice, ThemeState } from '../../design/tokens'
import type { MessageKey } from '../../i18n'
import type { ChatGestureState } from '../../stores/settings/chatGestures'
import type { SettingsState } from '../../stores/settings/settingsStore'
import type { NotificationKind } from '../systemNotifications'

/** What a setting reads from. Settings are plain functions of it, so rows need no hooks of their own. */
export interface SettingContext {
    session: Session
    settings: SettingsState
    themeState: ThemeState
    systemNotifications: {
        enabled: boolean
        everyMessage: boolean
        kinds: Record<NotificationKind, boolean>
    }
    chatGestures: ChatGestureState
}

export type SettingKey =
    | 'APPEARANCE'
    | 'SAME_AS_DEVICE_THEME'
    | 'APPEARANCE_THEME_PICKER'
    | 'LIGHT_MODE_THEME_PICKER'
    | 'LIGHT_MODE_THEME'
    | 'DARK_MODE_THEME_PICKER'
    | 'DARK_MODE_THEME'
    | 'ANDROID_FONT_SCALE'
    | 'ACCESSIBILITY'
    | 'ANIMATE_EMOJI'
    | 'CHAT'
    | 'SWIPE_RIGHT_TO_LEFT'
    | 'CHAT_GESTURES'
    | 'TAP_INLINE_CODE_TO_COPY'
    | 'HOLD_EMBED_TO_COPY'
    | 'NOTIFICATIONS'
    | 'IN_APP_NOTIFICATIONS'
    | 'NEW_UNREADS'
    | 'SYSTEM_NOTIFICATIONS'
    | 'ANDROID_MESSAGE_NOTIFICATIONS'
    | 'NOTIF_REALTIME'
    | 'NOTIF_CATEGORY_SOCIAL'
    | 'NOTIF_CATEGORY_SERVER'
    | 'NOTIF_CATEGORY_OTHER'
    | 'NOTIF_CALLS'
    | 'NOTIF_DIRECT_MESSAGES'
    | 'NOTIF_FRIEND_REQUESTS'
    | 'NOTIF_REACTIONS'
    | 'NOTIF_MESSAGES'
    | 'NOTIF_FORUM'
    | 'NOTIF_EVENTS'
    | 'NOTIF_SYSTEM_MESSAGES'
    | 'ADVANCED'
    | 'DEVELOPER_MODE'
    | 'MANAGE_ACCOUNTS'
    | 'LOGOUT'
    | 'APP_VERSION'
    | 'VIEW_DEBUG_LOGS'
    | 'PERFORMANCE'
    | 'DESIGN_SYSTEMS'

interface SettingBase {
    title: () => string
    /** useSearchTerms: more words search matches besides the title. */
    searchTerms?: () => string[]
    /** The setting whose screen holds this one; search results open that screen. */
    parent?: SettingKey
    icon?: IconName
    variant?: TableRowVariant
    /** usePredicate: the row is left out when this returns false. */
    predicate?: (context: SettingContext) => boolean
}

export interface RadioOption {
    value: string
    label: string
    subLabel?: string
}

/** createSlider's useProps. */
export interface SliderSettingProps {
    value?: number
    minimumValue?: number
    maximumValue?: number
    step?: number
    onValueChange?: (value: number) => void
    /** The icons either side of the track; pressing one steps the value down or up. */
    startIcon?: IconName
    endIcon?: IconName
    valueLabel?: string
    /** What "Reset to default" sets. */
    defaultValue?: number
}

/** SettingBuilders' node types (SettingRendererConstants.NodeType), minus the volume slider and the guild selector. */
export type SettingNode = SettingBase &
    (
        | {
              type: 'route'
              /** Root stack route the row opens. */
              screen: string
              trailing?: (context: SettingContext) => string | undefined
          }
        | {
              type: 'toggle'
              description?: () => string
              value: (context: SettingContext) => boolean
              onValueChange: (context: SettingContext, value: boolean) => void
              disabled?: (context: SettingContext) => boolean
          }
        | {
              type: 'radio'
              options: () => RadioOption[]
              value: (context: SettingContext) => string
              onValueChange: (context: SettingContext, value: string) => void
              disabled?: (context: SettingContext) => boolean
          }
        | {
              type: 'swatches'
              /** The device mode these swatches pick for, none for the app's theme. */
              mode?: SystemTheme
              value: (context: SettingContext) => ThemeChoice
              onValueChange: (
                  context: SettingContext,
                  value: ThemeChoice,
              ) => void
          }
        | { type: 'pressable'; onPress: (context: SettingContext) => void }
        | {
              type: 'slider'
              /** A hook, like the reference's useProps. */
              useProps: () => SliderSettingProps
          }
        | {
              type: 'static'
              trailing?: (context: SettingContext) => string | undefined
          }
    )

const systemNotificationsOn = ({ systemNotifications }: SettingContext) =>
    systemNotifications.enabled

/** A "Notify me about" category: its route, shown while system notifications are on. */
const notifCategory = (title: MessageKey, screen: string): SettingNode => ({
    type: 'route',
    parent: 'NOTIFICATIONS',
    title: () => t(title),
    screen,
    predicate: systemNotificationsOn,
})

/** One kind of notification, on unless turned off. */
const notifKind = (
    kind: NotificationKind,
    title: MessageKey,
    parent: SettingKey,
): SettingNode => ({
    type: 'toggle',
    parent,
    title: () => t(title),
    value: ({ systemNotifications }) => systemNotifications.kinds[kind] ?? true,
    onValueChange: (_context, value) => setNotificationKind(kind, value),
})

/** Account settings can only be saved once READY has given the current ones. */
const cannotSave = ({ settings }: SettingContext) => !canSaveSettings(settings)

const sameAsDevice = ({ themeState }: SettingContext) => themeState.sameAsDevice

/** The theme one device mode uses: the picker screens of LightModeThemeSetting and DarkModeThemeSetting, as swatches. */
const modeThemePicker = (
    mode: SystemTheme,
    parent: SettingKey,
): SettingNode => ({
    type: 'swatches',
    parent,
    mode,
    title: () => t('settings.theme'),
    value: ({ themeState }) => themeState[mode],
    onValueChange: (_context, value) => setModeTheme(mode, value),
})

// AndroidFontScaleSetting's useFontScaleSliderProps: the slider moves through FONT_SCALES by index.
function useFontScaleSliderProps(): SliderSettingProps {
    const { persistedFontScale, fontScale } = useStore(fontScaleStore)
    const defaultValue = FONT_SCALES.indexOf(1)
    const index = FONT_SCALES.indexOf(persistedFontScale)
    return {
        value: index === -1 ? defaultValue : index,
        minimumValue: 0,
        maximumValue: FONT_SCALES.length - 1,
        step: 1,
        // The slider reports a float; snap it back to an index.
        onValueChange: value =>
            fontScaleStore.setState({
                fontScale: FONT_SCALES[Math.round(value)] ?? 1,
            }),
        startIcon: 'CircleMinusIcon',
        endIcon: 'CirclePlusIcon',
        valueLabel: `${fontScale * 100}%`,
        defaultValue,
    }
}

// LogoutSetting's handleLogout, as the You tab did.
function logOut() {
    const account = currentAccount(accountsStore.getState())
    if (!account) return
    logout(account)
    removeAccount(account.id)
}

/** The settings Isocord implements, keyed like the reference's MobileUserSettings. SETTING_RENDERER_CONFIG in SettingsRendererConfig. */
export const SETTING_RENDERER_CONFIG: Record<SettingKey, SettingNode> = {
    // AppearanceSetting
    APPEARANCE: {
        type: 'route',
        title: () => t('settings.appearance'),
        icon: 'PaintPaletteIcon',
        screen: 'settingsAppearance',
        // useAppearanceSettingTrailing: ActiveThemeType.SYSTEM reads "Automatic".
        trailing: context =>
            sameAsDevice(context)
                ? t('settings.theme.automatic')
                : themeName(
                      context.themeState.theme,
                      context.themeState.customs,
                  ),
    },
    // SameAsDeviceThemeSetting
    SAME_AS_DEVICE_THEME: {
        type: 'toggle',
        parent: 'APPEARANCE',
        title: () => t('settings.theme.sameAsDevice'),
        description: () => t('settings.theme.sameAsDevice.description'),
        value: sameAsDevice,
        onValueChange: (_context, value) => setSameAsDeviceTheme(value),
    },
    // AppearanceThemePickerSetting opens a picker screen. Here the themes are swatches in place.
    // Kept on the device only, never synced to the account.
    APPEARANCE_THEME_PICKER: {
        type: 'swatches',
        parent: 'APPEARANCE',
        title: () => t('settings.theme'),
        value: ({ themeState }) => themeState.theme,
        onValueChange: (_context, value) => setTheme(value),
        predicate: context => !sameAsDevice(context),
    },
    // LightModeThemeSetting
    LIGHT_MODE_THEME_PICKER: {
        type: 'route',
        parent: 'APPEARANCE',
        title: () => t('settings.theme.lightMode'),
        screen: 'settingsAppearanceLightMode',
        trailing: ({ themeState }) =>
            themeName(themeState.light, themeState.customs),
        predicate: sameAsDevice,
    },
    LIGHT_MODE_THEME: modeThemePicker('light', 'LIGHT_MODE_THEME_PICKER'),
    // DarkModeThemeSetting
    DARK_MODE_THEME_PICKER: {
        type: 'route',
        parent: 'APPEARANCE',
        title: () => t('settings.theme.darkMode'),
        screen: 'settingsAppearanceDarkMode',
        trailing: ({ themeState }) =>
            themeName(themeState.dark, themeState.customs),
        predicate: sameAsDevice,
    },
    DARK_MODE_THEME: modeThemePicker('dark', 'DARK_MODE_THEME_PICKER'),
    // AndroidFontScaleSetting. Saved from the Appearance screen's header, which restarts the app.
    ANDROID_FONT_SCALE: {
        type: 'slider',
        parent: 'APPEARANCE',
        title: () => t('settings.zoomLevel'),
        useProps: useFontScaleSliderProps,
    },
    // AccessibilitySetting
    ACCESSIBILITY: {
        type: 'route',
        title: () => t('settings.accessibility'),
        icon: 'AccessibilityIcon',
        screen: 'settingsAccessibility',
    },
    // AnimateEmojiSetting
    ANIMATE_EMOJI: {
        type: 'toggle',
        parent: 'ACCESSIBILITY',
        title: () => t('settings.animateEmoji'),
        value: ({ settings }) => settings.textAndImages.animateEmoji ?? true,
        onValueChange: ({ session }, value) => setAnimateEmoji(session, value),
        disabled: cannotSave,
    },
    // ChatSetting
    CHAT: {
        type: 'route',
        title: () => t('settings.chat'),
        icon: 'ImageTextIcon',
        screen: 'settingsChat',
    },
    // SwipeRightToLeftSetting
    SWIPE_RIGHT_TO_LEFT: {
        type: 'route',
        parent: 'CHAT',
        title: () => t('settings.swipeRightToLeft'),
        screen: 'settingsSwipeRightToLeft',
        trailing: ({ settings }) =>
            settings.swipeRightToLeftMode === SwipeRightToLeftMode.REPLY
                ? t('settings.swipe.reply')
                : settings.swipeRightToLeftMode ===
                    SwipeRightToLeftMode.CHANNEL_DETAILS
                  ? t('settings.swipe.channelDetails')
                  : undefined,
    },
    // ChatGestureSettings: UNSET reads as REPLY (useSwipeToReplySettingValue).
    CHAT_GESTURES: {
        type: 'radio',
        parent: 'SWIPE_RIGHT_TO_LEFT',
        title: () => t('settings.swipingRightToLeft'),
        searchTerms: () => [t('settings.swipe.searchTerms')],
        options: () => [
            {
                value: String(SwipeRightToLeftMode.CHANNEL_DETAILS),
                label: t('settings.swipe.channelDetails'),
                subLabel: t('settings.swipe.channelDetails.description'),
            },
            {
                value: String(SwipeRightToLeftMode.REPLY),
                label: t('settings.swipe.reply'),
            },
        ],
        value: ({ settings }) =>
            String(settings.swipeRightToLeftMode || SwipeRightToLeftMode.REPLY),
        onValueChange: ({ session }, value) =>
            setSwipeRightToLeftMode(session, Number(value)),
        disabled: cannotSave,
    },
    // Isocord's own: the reference always copies inline code on a tap (onTapInlineCode). Kept on the device.
    TAP_INLINE_CODE_TO_COPY: {
        type: 'toggle',
        parent: 'CHAT',
        title: () => t('settings.tapInlineCodeToCopy'),
        value: ({ chatGestures }) => chatGestures.tapInlineCodeToCopy,
        onValueChange: (_context, value) =>
            setChatGesture('tapInlineCodeToCopy', value),
    },
    // Isocord's own: the reference always copies a held embed part (onTapCopyText). Kept on the device.
    HOLD_EMBED_TO_COPY: {
        type: 'toggle',
        parent: 'CHAT',
        title: () => t('settings.holdEmbedToCopy'),
        value: ({ chatGestures }) => chatGestures.holdEmbedToCopy,
        onValueChange: (_context, value) =>
            setChatGesture('holdEmbedToCopy', value),
    },
    // NotificationsSetting
    NOTIFICATIONS: {
        type: 'route',
        title: () => t('settings.notifications'),
        icon: 'BellIcon',
        screen: 'settingsNotifications',
    },
    // InAppNotificationsSetting, without Focus Mode.
    IN_APP_NOTIFICATIONS: {
        type: 'toggle',
        parent: 'NOTIFICATIONS',
        title: () => t('settings.inAppNotifications'),
        value: ({ settings }) => settings.showInAppNotifications ?? true,
        onValueChange: ({ session }, value) =>
            setShowInAppNotifications(session, value),
        disabled: cannotSave,
    },
    // Isocord's own: the reference dropped its toggle for AccountNotificationFlags.USE_NEW_NOTIFICATIONS, which
    // Discord still respects.
    NEW_UNREADS: {
        type: 'toggle',
        parent: 'NOTIFICATIONS',
        title: () => t('settings.newUnreads'),
        value: ({ settings }) => settings.newNotifications ?? false,
        onValueChange: ({ session }, value) =>
            setNewNotifications(session, value),
        disabled: cannotSave,
    },
    // SystemNotificationsSetting: on Android 13+ turning it on asks for the notification permission first. Isocord
    // stores it on the device; the reference reads the system's permission and channel states instead.
    SYSTEM_NOTIFICATIONS: {
        type: 'toggle',
        parent: 'NOTIFICATIONS',
        title: () => t('settings.systemNotifications'),
        value: ({ systemNotifications }) => systemNotifications.enabled,
        onValueChange: (_context, value) => void setSystemNotifications(value),
    },
    // AndroidMessageNotificationsSetting
    ANDROID_MESSAGE_NOTIFICATIONS: {
        type: 'toggle',
        parent: 'NOTIFICATIONS',
        title: () => t('settings.notifyEveryMessage'),
        predicate: ({ systemNotifications }) => systemNotifications.enabled,
        value: ({ systemNotifications }) => systemNotifications.everyMessage,
        onValueChange: (_context, value) => setNotifyEveryMessage(value),
    },
    // MobileNotifSettingsRoutes: the "Notify me about" categories, each a screen of the kinds in it
    // (MobileNotifSettingsRouteBuilders). There, kinds the system controls are left to its channel settings; Isocord
    // lists them all, as its own toggles.
    NOTIF_REALTIME: notifCategory(
        'systemNotifications.groupRealtime',
        'settingsNotifRealtime',
    ),
    NOTIF_CATEGORY_SOCIAL: notifCategory(
        'systemNotifications.groupSocial',
        'settingsNotifSocial',
    ),
    NOTIF_CATEGORY_SERVER: notifCategory(
        'systemNotifications.groupServer',
        'settingsNotifServer',
    ),
    NOTIF_CATEGORY_OTHER: notifCategory(
        'systemNotifications.groupOther',
        'settingsNotifOther',
    ),
    NOTIF_CALLS: notifKind(
        notificationKind.calls,
        'systemNotifications.calls',
        'NOTIF_REALTIME',
    ),
    NOTIF_DIRECT_MESSAGES: notifKind(
        notificationKind.directMessages,
        'systemNotifications.directMessages',
        'NOTIF_CATEGORY_SOCIAL',
    ),
    NOTIF_FRIEND_REQUESTS: notifKind(
        notificationKind.friendRequests,
        'systemNotifications.friendRequests',
        'NOTIF_CATEGORY_SOCIAL',
    ),
    NOTIF_REACTIONS: notifKind(
        notificationKind.reactions,
        'systemNotifications.reactions',
        'NOTIF_CATEGORY_SOCIAL',
    ),
    NOTIF_MESSAGES: notifKind(
        notificationKind.messages,
        'systemNotifications.messages',
        'NOTIF_CATEGORY_SERVER',
    ),
    NOTIF_FORUM: notifKind(
        notificationKind.forumPosts,
        'systemNotifications.forum',
        'NOTIF_CATEGORY_SERVER',
    ),
    NOTIF_EVENTS: notifKind(
        notificationKind.events,
        'systemNotifications.events',
        'NOTIF_CATEGORY_SERVER',
    ),
    NOTIF_SYSTEM_MESSAGES: notifKind(
        notificationKind.systemMessages,
        'systemNotifications.systemMessages',
        'NOTIF_CATEGORY_OTHER',
    ),
    // AdvancedSetting
    ADVANCED: {
        type: 'route',
        title: () => t('settings.advanced'),
        icon: 'SettingsIcon',
        screen: 'settingsAdvanced',
    },
    // DeveloperModeSetting
    DEVELOPER_MODE: {
        type: 'toggle',
        parent: 'ADVANCED',
        title: () => t('settings.developerMode'),
        value: ({ settings }) => settings.developerMode ?? false,
        onValueChange: ({ session }, value) => setDeveloperMode(session, value),
        disabled: cannotSave,
    },
    // Isocord's account switcher; the reference switches accounts from the You tab.
    MANAGE_ACCOUNTS: {
        type: 'route',
        title: () => t('accounts.manage'),
        icon: 'UserCircleIcon',
        screen: 'manageAccounts',
    },
    // LogoutSetting
    LOGOUT: {
        type: 'pressable',
        title: () => t('you.signOut'),
        icon: 'DoorExitIcon',
        variant: 'danger',
        onPress: () =>
            showConfirmModal({
                key: 'logout',
                title: t('you.signOut'),
                content: t('settings.logOut.confirm'),
                confirmText: t('you.signOut'),
                cancelText: t('common.back'),
                onConfirm: logOut,
            }),
    },
    // AppVersionSetting: the build Isocord identifies as.
    APP_VERSION: {
        type: 'static',
        title: () => t('settings.appVersion'),
        icon: 'ClydeIcon',
        trailing: () =>
            `${CLIENT.version} (${CLIENT.versionCode}) - ${CLIENT.releaseChannel}`,
        predicate: ({ settings }) => settings.developerMode === true,
    },
    // ViewDebugLogsSetting. The reference opens an action sheet of log screens; Isocord has only Debug Logs, so it opens that.
    VIEW_DEBUG_LOGS: {
        type: 'route',
        title: () => t('settings.logs'),
        icon: 'ChannelListMagnifyingGlassIcon',
        screen: 'debugLogs',
        predicate: ({ settings }) => settings.developerMode === true,
    },
    // Isocord's perf monitor; the reference has none in its settings.
    PERFORMANCE: {
        type: 'route',
        title: () => t('settings.performance'),
        icon: 'SpeedometerIcon',
        screen: 'perf',
        predicate: ({ settings }) => settings.developerMode === true,
    },
    // DesignSystemsSetting: Isocord's component gallery. The reference shows it to staff only.
    DESIGN_SYSTEMS: {
        type: 'route',
        title: () => t('settings.designSystem'),
        icon: 'PaintPaletteIcon',
        screen: 'gallery',
    },
}

/** One group of a settings screen (createList's sections). */
export interface SettingSection {
    label?: string
    subLabel?: string
    settings: SettingKey[]
}
