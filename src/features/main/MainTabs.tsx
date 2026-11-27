import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import {
    CommonActions,
    StackActions,
    useNavigation,
} from '@react-navigation/native'
import { useEffect, useEffectEvent } from 'react'
import { Linking, Pressable, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useStore } from 'zustand'
import { endMainWait } from '../../app/startupTrace'
import { accountsStore, currentAccount } from '../../core/accounts'
import { parseDiscordChannelUrl } from '../../core/discord/channelUrl'
import { logger } from '../../core/log'
import { useSession, useSessionStore } from '../../core/react'
import { StatusAvatar } from '../../design/components/avatars/StatusAvatar'
import { Badge } from '../../design/components/Badge'
import { showToast } from '../../design/components/overlays/toastStore'
import { Text } from '../../design/components/Text'
import { ThemedGradient } from '../../design/components/ThemedGradient'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { dmGuild, linkScheme } from '../../native/NativeIsocordConstants'
import { channelsStore, isPrivate } from '../../stores/channels/channels'
import { holdLinkedChannel } from '../../stores/channels/linkedChannels'
import { guildsStore } from '../../stores/guilds'
import { presencesStore } from '../../stores/presences'
import { readStatesStore } from '../../stores/readStates'
import { parseChatLink } from '../chat/links/chatLink'
import { openChannel, openInvite, setOpener } from '../chat/links/openChannel'
import { MessagesPanels } from '../messages/MessagesPanels'
import { MessagesTab } from '../messages/MessagesTab'
import { useMessagesPanels } from '../messages/useMessagesPanels'
import { isMentionItem, isUnreadMention } from '../notifications/api'
import { NotificationsTab } from '../notifications/NotificationsTab'
import { notificationsStore } from '../notifications/store'
import { SearchPreviewHost } from '../search/preview'
import { ServersPanels } from '../servers/ServersPanels'
import { ServersTab } from '../servers/ServersTab'
import { serversUiStore } from '../servers/store'
import { useServersPanels } from '../servers/useServersPanels'
import { useSharedContent } from '../share'
import { YouTab } from '../you/YouTab'
import { resolveInitialTab, saveLastTab } from './lastTab'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import type { ReactNode } from 'react'
import type { IconName } from '../../design/icons/Icon'
import type { MessageKey } from '../../i18n'
import type { ShareParams } from '../share'

const Tab = createBottomTabNavigator()

/** The window's origin: a tab's gradient spans the window, lined up with the guild header's copy. */
const WINDOW_ORIGIN = { x: 0, y: 0 }

/**
 * Each tab draws its own gradient, so it hides the tab it replaces. The navigator keeps the tab left shown under the
 * new one for a few frames, and see-through tabs stacked their dims into near black.
 */
const renderTabScene = ({ children }: { children: ReactNode }) => (
    <View style={styles.scene}>
        <ThemedGradient offset={WINDOW_ORIGIN} />
        {children}
    </View>
)

const TABS: Record<string, { label: MessageKey; icon: IconName }> = {
    servers: { label: 'tabs.servers', icon: 'ServerIcon' },
    messages: { label: 'tabs.messages', icon: 'ChatIcon' },
    notifications: { label: 'tabs.notifications', icon: 'BellIcon' },
    you: { label: 'tabs.you', icon: 'UserIcon' },
}

function YouIcon() {
    const session = useSession()
    const account = useStore(accountsStore, currentAccount)
    const presence = useSessionStore(
        presencesStore,
        state => state.presences[session.userId],
    )
    const { theme } = useUnistyles()
    if (!account) return <Icon name="UserIcon" />
    return (
        <StatusAvatar
            user={account}
            size={24}
            status={presence?.status ?? 'offline'}
            mobile={presence?.mobile}
            streaming={presence?.streaming}
            // CutoutBackgroundProvider: the tab bar's background; a tab has no pressed or selected background.
            cutoutBackground={theme.colors.TAB_BAR_BACKGROUND}
        />
    )
}

/** Mentions across all servers, across all private conversations, or the unread notifications. */
function useTabBadge(route: string): { count: number; low: boolean } {
    const serverMentions = useSessionStore(readStatesStore, state => {
        let total = 0
        for (const id in state.guildBadges)
            total += state.guildBadges[id]?.mentions ?? 0
        return total
    })
    // Gray when every server mention is a low importance one (private conversations always notify).
    const serversLow = useSessionStore(readStatesStore, state => {
        for (const id in state.guildBadges) {
            const badge = state.guildBadges[id]
            if (badge && badge.mentions > 0 && !badge.lowImportance)
                return false
        }
        return true
    })
    const privateIds = useSessionStore(channelsStore, state => state.privateIds)
    const messageMentions = useSessionStore(readStatesStore, state =>
        privateIds.reduce((total, id) => total + (state.mentions[id] ?? 0), 0),
    )
    const notifications = useSessionStore(
        notificationsStore,
        state => state.items,
    )
    // Counted inside the selector: an ack of another channel re-renders nothing unless the count changes.
    const unreadNotifications = useSessionStore(
        readStatesStore,
        state =>
            notifications.filter(
                item =>
                    isMentionItem(item) && isUnreadMention(item, state.acks),
            ).length,
    )
    return route === 'servers'
        ? { count: serverMentions, low: serversLow }
        : {
              count:
                  route === 'messages'
                      ? messageMentions
                      : route === 'notifications'
                        ? unreadNotifications
                        : 0,
              low: false,
          }
}

function TabButton({
    route,
    focused,
    onPress,
}: {
    route: string
    focused: boolean
    onPress: () => void
}) {
    const tab = TABS[route]
    const badge = useTabBadge(route)
    if (!tab) return null
    return (
        <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t(tab.label)}
            onPress={onPress}
            style={styles.tab}
        >
            <View style={styles.icon}>
                {route === 'you' ? (
                    <YouIcon />
                ) : (
                    <Icon
                        name={tab.icon}
                        color={
                            focused
                                ? 'INTERACTIVE_ICON_ACTIVE'
                                : 'INTERACTIVE_ICON_DEFAULT'
                        }
                    />
                )}
                {badge.count > 0 && (
                    <View style={styles.badge}>
                        <Badge
                            count={badge.count}
                            ring="TAB_BAR_BACKGROUND"
                            lowImportance={badge.low}
                        />
                    </View>
                )}
            </View>
            {/* modules.mobile.TAB_LABEL_TEXT_STYLE */}
            <Text
                variant="text-xs/medium"
                color={
                    focused
                        ? 'TAB_LABEL_TEXT_FOCUSED'
                        : 'TAB_LABEL_TEXT_DEFAULT'
                }
                lineClamp={1}
            >
                {t(tab.label)}
            </Text>
        </Pressable>
    )
}

function TabBar({ state, navigation }: BottomTabBarProps) {
    const session = useSession()
    const active = state.routes[state.index]?.name
    useEffect(() => {
        saveLastTab(session.storage, active)
    }, [active, session])
    return (
        <View style={styles.bar}>
            {state.routes.map((route, index) => (
                <TabButton
                    key={route.key}
                    route={route.name}
                    focused={state.index === index}
                    onPress={() => {
                        const focused = state.index === index
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                            data: {
                                behavior: {
                                    scrollToTop: focused,
                                    popToTop: focused,
                                },
                            },
                        })
                        if (!focused && !event.defaultPrevented)
                            navigation.navigate(route.name, route.params)
                    }}
                />
            ))}
        </View>
    )
}

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />
const NOOP = () => {}

/**
 * Lets a chat open another one the way the lists do: the channel is selected in its tab, which is switched to, and
 * its chat panel slides in over the list. The panel of the tab that was left closes with it.
 */
// DIAG: stuck Servers chat panel. Remove once found.
const diag = logger('PanelsDiag')

function ChannelOpener() {
    const session = useSession()
    // Root stack navigation from beside the tab navigator.
    const navigation = useNavigation()
    // External openers use the focused screen's history when main is covered.
    const navigate = (name: string, params: object) =>
        navigation.dispatch({
            ...CommonActions.navigate(name, params),
            source: undefined,
        })
    const servers = useServersPanels()
    const messages = useMessagesPanels()
    useEffect(() =>
        setOpener('channel', (channelId, messageId) => {
            const channel = session.get(channelsStore).getState().channels[
                channelId
            ]
            diag.debug(
                `open channel ${channelId} known=${channel !== undefined}`,
            )
            // Not held yet: a first DM from a notification, before its CHANNEL_CREATE or READY.
            if (!channel || isPrivate(channel)) {
                navigate('main', { screen: 'messages' })
                messages.openChat(channelId, messageId)
            } else if (channel.guild_id) {
                const guildId = channel.guild_id
                session.get(serversUiStore).setState(state => ({
                    selectedGuildId: guildId,
                    selectedChannelIds: {
                        ...state.selectedChannelIds,
                        [guildId]: channelId,
                    },
                }))
                navigate('main', { screen: 'servers' })
                servers.openChat(channelId, messageId)
            }
        }),
    )
    useEffect(() =>
        setOpener('channelBrowser', (guildId, tab) =>
            navigate('channelBrowser', { guildId, tab }),
        ),
    )
    useEffect(() =>
        setOpener('plaintextFilePreview', (url, fileName) =>
            navigate('plaintextFilePreview', { url, fileName }),
        ),
    )
    useEffect(() =>
        setOpener('invite', (code, url) => navigate('invite', { code, url })),
    )
    // A fresh screen for each share, above the currently focused screen.
    const openShareScreen = (params: ShareParams) =>
        navigation.dispatch(StackActions.push('share', params))
    useEffect(() => setOpener('share', openShareScreen))
    // Another app shared something: the share screen opens over whatever is on screen.
    useSharedContent(content => openShareScreen({ kind: 'share', content }))
    // A tapped system notification opens the app on isocord://channel/<guildId|@me>/<channelId>/<messageId>
    // (MessageNotifier.kt), with the app already running or not. After the effect above, so the opener is set.
    // Android App Links also deliver Discord channel/message URLs here.
    const open = useEffectEvent(async (url: string | null | undefined) => {
        if (!url) return
        // The message is left out for a channel or a post (alerts in NotificationContent.kt).
        const link = parseChatLink(url)
        diag.debug(`app link kind=${link?.kind}`)
        if (link?.kind === 'invite') {
            openInvite(link.code, link.url)
            return
        }
        if (link?.kind === 'channel') {
            // Our own notification links open channels not held yet (a first DM, before READY).
            if (
                !url.startsWith(linkScheme) &&
                !(await holdLinkedChannel(session, link.channelId))
            ) {
                showToast({
                    content: t('chat.mention.noAccess'),
                    key: 'no-access',
                })
                return
            }
            openChannel(link.channelId, link.messageId)
            return
        }
        const discordLink = parseDiscordChannelUrl(url)
        if (!discordLink) return
        if (discordLink.guildId === dmGuild) {
            navigate('main', { screen: 'messages' })
        } else if (
            session.get(guildsStore).getState().guilds[discordLink.guildId]
        ) {
            session.get(serversUiStore).setState({
                selectedGuildId: discordLink.guildId,
            })
            navigate('main', { screen: 'servers' })
        } else {
            showToast({
                content: t('chat.mention.noAccess'),
                key: 'no-access',
            })
        }
    })
    useEffect(() => {
        void Linking.getInitialURL().then(open)
        const subscription = Linking.addEventListener('url', event => {
            void open(event.url)
        })
        return () => subscription.remove()
    }, [])
    return null
}

/** The four main tabs. Replaces the reference client's floating "You bar" with a plain tab bar. */
export function MainTabs() {
    const session = useSession()
    useEffect(endMainWait, [])
    return (
        // The Servers chat panel slides over the whole tab navigator, tab bar included.
        <ServersPanels>
            <MessagesPanels>
                <ChannelOpener />
                {/* The Notifications tab's message preview slides over the tab bar too, under the chat panels. */}
                <SearchPreviewHost onDismiss={NOOP} closeOnJump>
                    <Tab.Navigator
                        key={session.userId}
                        implementation="custom"
                        initialRouteName={resolveInitialTab(session.storage)}
                        tabBar={renderTabBar}
                        screenOptions={{
                            headerShown: false,
                            inactiveBehavior: 'none',
                        }}
                        screenLayout={renderTabScene}
                    >
                        <Tab.Screen name="servers" component={ServersTab} />
                        <Tab.Screen name="messages" component={MessagesTab} />
                        <Tab.Screen
                            name="notifications"
                            component={NotificationsTab}
                        />
                        <Tab.Screen name="you" component={YouTab} />
                    </Tab.Navigator>
                </SearchPreviewHost>
            </MessagesPanels>
        </ServersPanels>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    scene: { flex: 1, overflow: 'hidden' },
    bar: {
        flexDirection: 'row',
        paddingBottom: runtime.insets.bottom,
        borderTopWidth: 1,
        borderTopColor: theme.colors.BORDER_SUBTLE,
        backgroundColor: theme.colors.TAB_BAR_BACKGROUND,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: theme.space.PX_4 },
    icon: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: { position: 'absolute', top: -2, left: 16 },
}))
