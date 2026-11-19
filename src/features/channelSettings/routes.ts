import type { NavigationProp, ParamListBase } from '@react-navigation/native'

/** The root stack routes of the screens here. */
export const CHANNEL_SETTINGS_ROUTES = {
    editChannel: 'editChannel',
    duplicateChannel: 'duplicateChannel',
    customizeGroup: 'customizeGroup',
} as const

/** The params of every route here. */
export interface ChannelRouteParams {
    channelId: string
}

type Navigation = Pick<NavigationProp<ParamListBase>, 'navigate'>

/** ChannelLongPressActionSheet's Edit Channel and Edit Category rows: ChannelSettingsOverview. */
export const openEditChannel = (navigation: Navigation, channelId: string) =>
    navigation.navigate(CHANNEL_SETTINGS_ROUTES.editChannel, { channelId })

/** ChannelLongPressActionSheet's Duplicate Channel row: CreateChannelModal with `cloneChannelId`. */
export const openDuplicateChannel = (
    navigation: Navigation,
    channelId: string,
) =>
    navigation.navigate(CHANNEL_SETTINGS_ROUTES.duplicateChannel, {
        channelId,
    })

/** ChannelLongPressActionSheet's Customize Group row: showChatGDMCustomizeActionSheet. */
export const openEditGroup = (navigation: Navigation, channelId: string) =>
    navigation.navigate(CHANNEL_SETTINGS_ROUTES.customizeGroup, { channelId })
