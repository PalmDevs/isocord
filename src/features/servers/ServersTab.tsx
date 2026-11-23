import { useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { logger } from '../../core/log'
import { useSession, useSessionReady, useSessionStore } from '../../core/react'
import { Skeleton, SkeletonPulse } from '../../design/components/Skeleton'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { splashContentNativeId } from '../../native/NativeIsocordConstants'
import { guildsStore } from '../../stores/guilds'
import { settingsStore } from '../../stores/settings/settingsStore'
import { useTabSelected } from '../main/useTabSelected'
import { bannerHeightFor } from './bannerHeightFor'
import { ChannelList, ChannelListSkeleton } from './ChannelList'
import { GuildBanner, GuildHeader } from './GuildHeader'
import { GuildsBar } from './GuildsBar'
import { buildGuildList } from './guildList'
import { serversUiStore } from './store'
import { useServersPanels } from './useServersPanels'

// DIAG: stuck Servers chat panel. Remove once found.
const diag = logger('PanelsDiag')

export function ServersTab() {
    const session = useSession()
    const focused = useTabSelected()
    const { setTabFocused } = useServersPanels()
    const selectedGuildId = useSessionStore(
        serversUiStore,
        state => state.selectedGuildId,
    )
    const guild = useSessionStore(guildsStore, state =>
        selectedGuildId ? state.guilds[selectedGuildId] : undefined,
    )
    const ready = useSessionReady()
    const hasGuilds = useSessionStore(
        guildsStore,
        state => Object.keys(state.guilds).length > 0,
    )

    // The chat panel only counts as visible, and only takes swipes, while this tab is the selected one.
    useEffect(() => {
        diag.debug(`servers tab focused=${focused}`)
        setTabFocused(focused)
        return () => {
            diag.debug('servers tab focus cleanup')
            setTabFocused(false)
        }
    }, [focused, setTabFocused])

    // Nothing selected yet, or the selected server is gone: fall back to the first one in the list. A persisted
    // selection that is merely not loaded yet (cached startup) is kept and only shown as the first server meanwhile;
    // it is replaced once the gateway is connected and the server is definitely absent.
    const [fallbackId, setFallbackId] = useState<string>()
    const fallbackGuild = useSessionStore(guildsStore, state =>
        fallbackId ? state.guilds[fallbackId] : undefined,
    )
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-resolve when the selected guild or guild set changes
    useEffect(() => {
        const resolve = () => {
            const guilds = session.get(guildsStore).getState().guilds
            const selected = session
                .get(serversUiStore)
                .getState().selectedGuildId
            if (selected && guilds[selected]) return setFallbackId(undefined)
            if (Object.keys(guilds).length === 0) return
            const first = buildGuildList(
                session.get(settingsStore).getState().folders,
                guilds,
            )[0]
            const firstId =
                first?.type === 'guild' ? first.guildId : first?.guildIds[0]
            if (!firstId) return
            if (selected && session.gateway.state !== 'connected')
                return setFallbackId(firstId)
            setFallbackId(undefined)
            session.get(serversUiStore).setState({ selectedGuildId: firstId })
        }
        resolve()
        const offState = session.gateway.events.on('state', resolve)
        return () => offState()
    }, [session, guild, hasGuilds])
    const shown = guild ?? fallbackGuild

    const scrollY = useSharedValue(0)
    const [panelWidth, setPanelWidth] = useState(0)
    const [headerHeight, setHeaderHeight] = useState(0)
    const { height: windowHeight } = useWindowDimensions()
    const bannerHeight = shown
        ? bannerHeightFor(shown, panelWidth, windowHeight)
        : 0

    return (
        <View nativeID={splashContentNativeId} style={styles.container}>
            <GuildsBar />
            <View
                style={styles.panel}
                onLayout={event =>
                    setPanelWidth(event.nativeEvent.layout.width)
                }
            >
                {shown ? (
                    <>
                        <ChannelList
                            guild={shown}
                            scrollY={scrollY}
                            bannerHeight={bannerHeight}
                            headerHeight={headerHeight}
                            header={
                                // The banner scrolls with the channels; the guild header is drawn over the gap below it.
                                <View
                                    style={styles.listTop(
                                        bannerHeight + headerHeight,
                                    )}
                                >
                                    <GuildBanner
                                        guild={shown}
                                        scrollY={scrollY}
                                        height={bannerHeight}
                                    />
                                </View>
                            }
                        />
                        <GuildHeader
                            // An animated style picks up a new bannerHeight a frame after the commit, so switching
                            // between servers with and without a banner drew the header at the old offset for a
                            // frame. A remount computes the first style during render, in the same commit as the list.
                            key={bannerHeight}
                            guild={shown}
                            scrollY={scrollY}
                            bannerHeight={bannerHeight}
                            onHeight={setHeaderHeight}
                        />
                    </>
                ) : !ready && !hasGuilds ? (
                    <>
                        {/* Same boxes as the guild header, so the swap does not move anything. */}
                        <SkeletonPulse style={styles.skeletonHeader}>
                            <Skeleton
                                width={160}
                                height={28}
                                style={styles.skeletonInset}
                            />
                            <Skeleton
                                height={32}
                                style={[
                                    styles.skeletonInset,
                                    styles.skeletonSearch,
                                ]}
                            />
                            <View style={styles.skeletonDivider} />
                        </SkeletonPulse>
                        <ChannelListSkeleton />
                    </>
                ) : (
                    <Text color="TEXT_MUTED" style={styles.empty}>
                        {hasGuilds ? '' : t('servers.empty')}
                    </Text>
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: {
        flex: 1,
        flexDirection: 'row',
        paddingTop: runtime.insets.top,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWEST,
    },
    panel: {
        flex: 1,
        overflow: 'hidden',
        borderTopLeftRadius: theme.radii.xl,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: theme.colors.BORDER_SUBTLE,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
    },
    listTop: (height: number) => ({ height }),
    // GuildHeader's container, title row, search button and divider.
    skeletonHeader: { gap: theme.space.PX_8, paddingTop: theme.space.PX_16 },
    skeletonInset: { marginHorizontal: theme.space.PX_16 },
    skeletonSearch: { marginBottom: theme.space.PX_8 },
    skeletonDivider: {
        height: 1,
        marginHorizontal: theme.space.PX_16,
        backgroundColor: theme.colors.BORDER_SUBTLE,
    },
    empty: { padding: theme.space.PX_16, textAlign: 'center' },
}))
