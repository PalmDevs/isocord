import { useIsFocused, useNavigation } from '@react-navigation/native'
import { Image } from 'expo-image'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { PixelRatio, Pressable, View } from 'react-native'
import Animated, {
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { guildBannerUrl } from '../../core/discord/cdn'
import { GuildFeature } from '../../core/discord/guild'
import { computePermissions, Permission } from '../../core/discord/permissions'
import { useSession, useSessionStore } from '../../core/react'
import { Button } from '../../design/components/buttons/Button'
import { IconButton } from '../../design/components/buttons/IconButton'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import {
    ActionSheet,
    BottomSheetTitleHeader,
} from '../../design/components/sheets/Sheet'
import {
    openActionSheet,
    useSheetStore,
} from '../../design/components/sheets/sheetStore'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { SPRING_STANDARD } from '../../design/tokens/motion'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { can } from '../../stores/permissions'
import { openGuildActionSheet, openInviteSheet } from './guildActions'
import { useServersPanels } from './useServersPanels'
import type { ReactNode } from 'react'
import type { HostInstance } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { Guild } from '../../stores/guilds'

// Placeholder for sheets not yet built (events).
function openPlaceholderSheet(key: string, title: string) {
    openActionSheet(
        key,
        <ActionSheet header={<BottomSheetTitleHeader title={title} />} />,
    )
}

/** getGuildBannerURL: webp at the media proxy size for a 360pt wide banner, animated only when asked. */
function bannerUrl(guild: Guild, animate: boolean): string {
    const size = 2 ** Math.ceil(Math.log2(360 * PixelRatio.get()))
    return guildBannerUrl(guild.id, guild.banner!, size, animate)
}

/**
 * ReanimatedGuildBanner: the banner at the top of the channel list. It scrolls with the list and fades out as it
 * leaves; pressing it darkens it and opens the guild action sheet.
 */
export function GuildBanner({
    guild,
    scrollY,
    height,
}: {
    guild: Guild
    scrollY: SharedValue<number>
    height: number
}) {
    const reducedMotion = useReducedMotion()
    const focused = useIsFocused()
    const sheetOpen = useSheetStore(state => state.sheets.length > 0)
    // The chat, a forward's stacked chat or the details cover the list: decoding frames nobody sees redrew the whole
    // window every frame. Paused rather than swapped for the still image, so it plays on at once when a swipe
    // uncovers the list.
    const navigation = useNavigation()
    const { listCovered, openGuildSearch } = useServersPanels()
    const image = useRef<Image>(null)
    const pressed = useSharedValue(0)
    const animate =
        !reducedMotion &&
        !sheetOpen &&
        focused &&
        (guild.features?.includes(GuildFeature.ANIMATED_BANNER) ?? false)
    // Only an animated banner has playback to drive. A still image has nothing to pause, and its native view may not
    // be registered yet (frozen or just mounted), which rejects the call.
    useEffect(() => {
        if (!animate) return
        if (listCovered) void image.current?.stopAnimating()
        else void image.current?.startAnimating()
    }, [animate, listCovered])

    const bannerStyle = useAnimatedStyle(() => {
        const y = scrollY.get()
        return {
            opacity: interpolate(y, [0, height], [1, 0], 'clamp'),
            // Overscroll (negative offsets) stretches the banner down instead of leaving a gap.
            transform: [
                { translateY: y >= 0 ? 0 : y / 2 },
                { scale: y >= 0 ? 1 : (height - y) / height },
            ],
        }
    })
    const overlayStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pressed.get(), [0, 1], [0, 0.3]),
    }))

    if (!guild.banner) return null
    return (
        <Animated.View style={bannerStyle}>
            <Pressable
                accessibilityIgnoresInvertColors
                onPress={() =>
                    openGuildActionSheet(guild, navigation, openGuildSearch)
                }
                onPressIn={() => pressed.set(withSpring(1, SPRING_STANDARD))}
                onPressOut={() => pressed.set(withSpring(0, SPRING_STANDARD))}
                style={styles.banner(height)}
            >
                <Image
                    ref={image}
                    // A banner that loads while covered starts paused.
                    autoplay={!listCovered}
                    source={bannerUrl(guild, animate)}
                    recyclingKey={guild.id}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    style={styles.fill}
                />
                <Animated.View style={[styles.bannerOverlay, overlayStyle]} />
            </Pressable>
        </Animated.View>
    )
}

/** shouldRenderInvite: some channel the user can see lets them create an invite. */
function useCanInvite(guild: Guild): boolean {
    const session = useSession()
    return useSessionStore(channelsStore, state =>
        (state.byGuild[guild.id] ?? []).some(id =>
            can(
                session,
                id,
                Permission.VIEW_CHANNEL | Permission.CREATE_INSTANT_INVITE,
            ),
        ),
    )
}

/**
 * useCanSeeEventsInChannelList, permission half: the user may create events. Guilds with scheduled events also
 * show the button in the reference, but those are not stored yet.
 */
function canCreateEvents(guild: Guild, userId: string): boolean {
    const permissions = computePermissions(guild, undefined, userId)
    return (
        (permissions &
            (Permission.CREATE_EVENTS | Permission.MANAGE_EVENTS)) !==
        0n
    )
}

/** GuildSearchAndInvite with useButtonComponent and useEventsButton, as the sticky header shows it. */
function GuildSearchAndInvite({ guild }: { guild: Guild }) {
    const session = useSession()
    const { openGuildSearch } = useServersPanels()
    const canInvite = useCanInvite(guild)
    return (
        <View style={styles.actions}>
            <Button
                variant="secondary"
                size="sm"
                grow
                icon="MagnifyingGlassIcon"
                text={t('servers.header.search')}
                // The reference opens a guild-wide search screen (navigateToSearchWithPrefetch); until there is one, the
                // selected channel's details searching on the Channels tab.
                onPress={openGuildSearch}
                style={styles.search}
            />
            {canInvite && (
                <IconButton
                    variant="secondary"
                    size="sm"
                    icon="GroupPlusIcon"
                    accessibilityLabel={t('servers.header.invite')}
                    onPress={() => openInviteSheet(guild)}
                />
            )}
            {canCreateEvents(guild, session.userId) && (
                <IconButton
                    variant="secondary"
                    size="sm"
                    icon="CalendarIcon"
                    accessibilityLabel={t('servers.header.events')}
                    onPress={() =>
                        openPlaceholderSheet(
                            'guild-events',
                            t('servers.header.events'),
                        )
                    }
                />
            )}
        </View>
    )
}

/**
 * GuildInfoHeader + ChannelListStickyHeader: name, member count, search, invite, events and a divider.
 * Sits below the banner and pins to the top once the banner scrolls away.
 * An overlay outside the list. The reference counter-translates it inside the scroll content,
 * which drops frames and can lose the pin on re-render.
 */
export function GuildHeader({
    guild,
    scrollY,
    bannerHeight,
    onHeight,
    backdrop,
}: {
    guild: Guild
    scrollY: SharedValue<number>
    bannerHeight: number
    /** The header's height, which the list leaves room for above its first row. */
    onHeight: (height: number) => void
    /**
     * The panel's gradient, so the sticky header hides the channels below it on a gradient theme.
     * shortcut: lined up with the panel, not the header's offset below a banner, add it if the seam shows.
     */
    backdrop: ReactNode
}) {
    const navigation = useNavigation()
    const { openGuildSearch } = useServersPanels()
    // Measured before the frame is drawn, so the list's room follows a server switch in the same frame. onLayout
    // arrived a few frames later, and until then the first rows sat under the header. onLayout still covers
    // changes that don't come from rendering this header, like a new width.
    const container = useRef<HostInstance>(null)
    useLayoutEffect(() => {
        container.current?.measureLayout(
            container.current,
            (_x, _y, _w, height) => onHeight(height),
        )
    })
    const position = useAnimatedStyle(() => ({
        transform: [{ translateY: Math.max(0, bannerHeight - scrollY.get()) }],
    }))
    // useStickyServerHeaderSubtitle: only community servers show their member count.
    const memberCount = guild.features?.includes(GuildFeature.COMMUNITY)
        ? guild.memberCount
        : 0

    return (
        <Animated.View
            ref={container}
            onLayout={event => onHeight(event.nativeEvent.layout.height)}
            style={[styles.container, position]}
        >
            {backdrop}
            <RipplePressable
                accessibilityRole="button"
                accessibilityHint={t('servers.header.optionsHint')}
                onPress={() =>
                    openGuildActionSheet(guild, navigation, openGuildSearch)
                }
            >
                <View style={styles.header}>
                    <Text
                        variant="heading-lg/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        lineClamp={1}
                        style={styles.title}
                    >
                        {guild.name}
                    </Text>
                    {/* TODO GuildBadgeV2 (verified, partnered, boost level) goes here. */}
                    <Icon
                        name="ChevronSmallRightIcon"
                        size="xxs"
                        color="TEXT_SUBTLE"
                        style={styles.chevron}
                    />
                </View>
                {memberCount > 0 && (
                    <View style={styles.subheader}>
                        <Text
                            variant="text-sm/medium"
                            color="TEXT_MUTED"
                            lineClamp={1}
                        >
                            {t(
                                memberCount === 1
                                    ? 'servers.header.members.one'
                                    : 'servers.header.members.other',
                                { count: memberCount.toLocaleString() },
                            )}
                        </Text>
                        <View style={styles.dot} />
                        <Text
                            variant="text-sm/medium"
                            color="TEXT_MUTED"
                            lineClamp={1}
                        >
                            {t('servers.header.community')}
                        </Text>
                    </View>
                )}
            </RipplePressable>
            <GuildSearchAndInvite guild={guild} />
            <View style={styles.divider} />
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    banner: (height: number) => ({ height, overflow: 'hidden' }),
    fill: { width: '100%', height: '100%' },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.BLACK,
    },
    // ChannelListStickyHeader's container (showExtraButtons) on RedesignGuildHeader's PANEL_BG wrapper.
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        gap: theme.space.PX_8,
        paddingTop: theme.space.PX_16,
        backgroundColor: theme.colors.PANEL_BG,
        // Clips the backdrop, which is as big as the screen.
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
        paddingHorizontal: theme.space.PX_16,
    },
    title: { flexShrink: 1 },
    chevron: { flexShrink: 0, flexGrow: 0 },
    subheader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_16,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.TEXT_SUBTLE,
    },
    // GuildSearchAndInvite: SEARCH_BAR_MARGIN_BOTTOM, 12 between buttons with useButtonComponent.
    actions: {
        flexDirection: 'row',
        gap: theme.space.PX_12,
        paddingHorizontal: theme.space.PX_16,
        marginBottom: theme.space.PX_8,
    },
    search: { flex: 1 },
    divider: {
        height: 1,
        marginHorizontal: theme.space.PX_16,
        backgroundColor: theme.colors.BORDER_SUBTLE,
    },
}))
