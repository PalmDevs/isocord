import { useNavigation, useRoute } from '@react-navigation/native'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { GuildFeature } from '../../core/discord/guild'
import { useSessionStore } from '../../core/react'
import {
    SegmentedControl,
    SegmentedControlPages,
} from '../../design/components/inputs/SegmentedControl'
import { useSegmentedControlState } from '../../design/components/inputs/useSegmentedControlState'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { t } from '../../i18n'
import { guildsStore } from '../../stores/guilds'
import { ChannelBrowser } from './ChannelBrowser'
import { CustomizeCommunity } from './CustomizeCommunity'

/** GuildOnboardingTab, in the segmented control's order. */
const TABS = ['customize', 'browse'] as const

export type ChannelsAndRolesTab = (typeof TABS)[number]

/**
 * ChannelsAndRolesModal: the Customize and All Channels tabs where the server has onboarding questions
 * (useGuildOnboardingAvailable), else only the channel browser. Opened from the channel list's top row and from
 * `<id:customize>` and `<id:browse>` links.
 */
export function ChannelsAndRolesScreen() {
    const navigation = useNavigation()
    const { guildId, tab } = useRoute().params as {
        guildId: string
        tab?: ChannelsAndRolesTab
    }
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const onboarding =
        guild?.features?.includes(GuildFeature.GUILD_ONBOARDING_HAS_PROMPTS) ??
        false
    const browse = guild && <ChannelBrowser guild={guild} />
    // The pages swipe, as the reference's segmented control pages do.
    const control = useSegmentedControlState({
        items: [
            {
                id: 'customize',
                label: t('channelsAndRoles.customize'),
                page: guild && (
                    <CustomizeCommunity
                        guild={guild}
                        onBrowse={() =>
                            control.setActiveIndex(TABS.indexOf('browse'))
                        }
                    />
                ),
            },
            {
                id: 'browse',
                label: t('channelsAndRoles.allChannels'),
                page: browse,
            },
        ],
        defaultIndex: TABS.indexOf(tab ?? 'customize'),
    })

    return (
        <View style={styles.screen}>
            <NavigatorHeader
                title={t(
                    onboarding
                        ? 'channelsAndRoles.title'
                        : 'channelBrowser.title',
                )}
                onBack={() => navigation.goBack()}
            />
            {guild && onboarding ? (
                <>
                    <View style={styles.tabBar}>
                        <SegmentedControl state={control} />
                    </View>
                    <SegmentedControlPages state={control} />
                </>
            ) : (
                browse
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    screen: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOW },
    tabBar: {
        paddingHorizontal: theme.space.PX_12,
        paddingTop: theme.space.PX_16,
    },
}))
