import { useNavigation } from '@react-navigation/native'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Icon } from '../../../design/icons/Icon'
import { CHANNEL_DETAILS_SEARCH_TIMING } from '../../../design/tokens/motion'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { settingsStore } from '../../../stores/settings/settingsStore'
import { isMuted } from '../../../stores/unreadPolicy'
import { openChannelActionSheet } from '../../channelActions'
import { canEditChannel, openEditChannel } from '../../channelSettings'
import { openMuteSheet } from '../../notificationSettings'
import { SEARCH_BAR_HEIGHT } from './constants'
import type { ButtonSize } from '../../../design/components/buttons/Button'
import type { ChannelDetailsButton } from './constants'

/** getChannelDetailsButtons: search, mute and settings, for every channel. */
const BUTTONS: ChannelDetailsButton[] = ['search', 'mute', 'settings']

/** UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted: the server, the category or the channel is muted. */
function useIsMuted(channelId: string): boolean {
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    return useSessionStore(
        settingsStore,
        state => channel !== undefined && isMuted(state, channel),
    )
}

/**
 * The buttons layer of ChannelDetailsNavigationBar: the back arrow and the icon buttons on the right. It fades
 * out, and stops taking touches, while the search bar is up.
 */
export function NavigationBar({
    channelId,
    searching,
    onBack,
    onSearch,
}: {
    channelId: string
    searching: boolean
    onBack: () => void
    onSearch: () => void
}) {
    const { theme } = useUnistyles()
    const session = useSession()
    const navigation = useNavigation()
    const muted = useIsMuted(channelId)
    const size = theme.modules.mobile
        .CHANNEL_DETAILS_NAV_ICON_BUTTON_SIZE as ButtonSize
    // SettingsButton: ChannelSettingsOverview of a server channel, else the channel's long press sheet (a DM, a group
    // DM). Without MANAGE_CHANNELS, and for a thread, the screen would go straight back, so the sheet opens too.
    const openSettings = () => {
        const channel = session.get(channelsStore).getState().channels[
            channelId
        ]
        if (channel && canEditChannel(session, channel))
            openEditChannel(navigation, channelId)
        else openChannelActionSheet(channelId, navigation)
    }
    const animated = useAnimatedStyle(() => ({
        opacity: withTiming(searching ? 0 : 1, CHANNEL_DETAILS_SEARCH_TIMING),
    }))
    return (
        <Animated.View
            pointerEvents={searching ? 'none' : 'auto'}
            style={[styles.bar, animated]}
        >
            <RipplePressable
                borderless
                radius={20}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                hitSlop={12}
                onPress={onBack}
            >
                <Icon
                    name="ArrowLargeLeftIcon"
                    color="INTERACTIVE_TEXT_DEFAULT"
                />
            </RipplePressable>
            <View style={styles.buttons}>
                {BUTTONS.map(button =>
                    button === 'search' ? (
                        <IconButton
                            key={button}
                            icon="MagnifyingGlassIcon"
                            variant="icon-only"
                            size={size}
                            accessibilityLabel={t('details.search')}
                            onPress={onSearch}
                        />
                    ) : button === 'mute' ? (
                        <IconButton
                            key={button}
                            icon={muted ? 'BellSlashIcon' : 'BellIcon'}
                            variant="icon-only"
                            size={size}
                            accessibilityLabel={t('details.mute')}
                            // MuteButton navigates to the mute screen (MuteSettingsScreen), here its sheet.
                            onPress={() => openMuteSheet(channelId)}
                        />
                    ) : (
                        <IconButton
                            key={button}
                            icon="SettingsIcon"
                            variant="icon-only"
                            size={size}
                            accessibilityLabel={t('details.settings')}
                            onPress={openSettings}
                        />
                    ),
                )}
            </View>
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    bar: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space.PX_16,
        paddingVertical: theme.space.PX_4,
        height: SEARCH_BAR_HEIGHT,
    },
    buttons: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: theme.modules.mobile.CHANNEL_DETAILS_NAV_BUTTONS_GAP,
    },
}))
