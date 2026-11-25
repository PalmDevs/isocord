import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../core/react'
import { flattenColor } from '../../design/components/avatars/flattenColor'
import { GuildIcon } from '../../design/components/avatars/GuildIcon'
import { StatusAvatar } from '../../design/components/avatars/StatusAvatar'
import { Tabs, TabsPages } from '../../design/components/layout/Tabs'
import { useTabsState } from '../../design/components/layout/useTabsState'
import {
    ActionSheet,
    BottomSheetTitleHeader,
} from '../../design/components/sheets/Sheet'
import { SheetDrag } from '../../design/components/sheets/SheetDrag'
import {
    hideActionSheet,
    openActionSheet,
} from '../../design/components/sheets/sheetStore'
import { TableRow } from '../../design/components/table/TableRow'
import { t } from '../../i18n'
import { guildsStore } from '../../stores/guilds'
import { presencesStore } from '../../stores/presences'
import { displayName } from '../../stores/users'
import { openProfileSheet } from './openProfileSheet'
import { useProfileMutuals } from './useProfileMutuals'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { MessageKey } from '../../i18n'
import type { MutualGuild } from '../../stores/userProfiles'
import type { User } from '../../stores/users'

const MUTUALS_SHEET_KEY = 'user-profile-mutuals'
const LIST_HEIGHT_RATIO = 0.6
const ROW_ICON_SIZE = 32

type MutualsTab = 'friends' | 'servers'

const STATUS_KEYS: Record<string, MessageKey> = {
    online: 'messages.status.online',
    idle: 'messages.status.idle',
    dnd: 'messages.status.dnd',
    offline: 'messages.status.offline',
    invisible: 'messages.status.offline',
}

/** Opens the mutual friends and servers of a user in a sheet stacked over their profile. */
export function openMutualsSheet(
    userId: string,
    guildId: string | undefined,
    tab: MutualsTab,
): void {
    openActionSheet(
        MUTUALS_SHEET_KEY,
        <MutualsSheet userId={userId} guildId={guildId} initialTab={tab} />,
        { stackingBehavior: 'stack' },
    )
}

/**
 * UserProfileMutualsActionSheet: "Mutual Friends & Servers" over two tabs, each a list of grouped rows. Rows round
 * their own ends (start, end), as the channel's Members tab does, since a TableRowGroup cannot wrap a FlashList.
 */
function MutualsSheet({
    userId,
    guildId,
    initialTab,
}: {
    userId: string
    guildId: string | undefined
    initialTab: MutualsTab
}) {
    const { friends, guilds } = useProfileMutuals(userId, guildId)
    const { height } = useWindowDimensions()
    const atTop = useSharedValue(true)
    // SegmentedControlPages: the other tab mounts once the sheet is open, not during its slide.
    const [opened, setOpened] = useState(false)
    // The slide waits for the selected list's rows: FlashList mounts them over several commits.
    const [loaded, setLoaded] = useState(false)
    const listProps = {
        contentContainerStyle: styles.list,
        // A frame after onLoad: the rows past the viewport render alongside it and mount first.
        onLoad: () => requestAnimationFrame(() => setLoaded(true)),
        onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) =>
            atTop.set(event.nativeEvent.contentOffset.y <= 1),
        scrollEventThrottle: 16,
    }
    const state = useTabsState({
        items: [
            {
                key: 'friends',
                label: t('userProfile.mutualFriends'),
                count: friends.length,
                page: (
                    <FlashList
                        data={friends}
                        keyExtractor={friend => friend.id}
                        renderItem={({ item, index }) => (
                            <FriendRow
                                friend={item}
                                start={index === 0}
                                end={index === friends.length - 1}
                            />
                        )}
                        {...listProps}
                    />
                ),
            },
            {
                key: 'servers',
                label: t('userProfile.mutualServers'),
                count: guilds.length,
                page: (
                    <FlashList
                        data={guilds}
                        keyExtractor={mutual => mutual.id}
                        renderItem={({ item, index }) => (
                            <ServerRow
                                userId={userId}
                                mutual={item}
                                start={index === 0}
                                end={index === guilds.length - 1}
                            />
                        )}
                        {...listProps}
                    />
                ),
            },
        ],
        defaultIndex: initialTab === 'servers' ? 1 : 0,
    })
    return (
        <ActionSheet
            holdOpen={!loaded}
            onOpen={() => setOpened(true)}
            header={
                <View>
                    <BottomSheetTitleHeader
                        title={t('userProfile.mutualsTitle')}
                    />
                    <Tabs state={state} grow />
                </View>
            }
            footer={
                <SheetDrag
                    scrollAtTop={atTop}
                    style={{ height: height * LIST_HEIGHT_RATIO }}
                >
                    <TabsPages
                        state={state}
                        holdNeighbours={!opened}
                        style={styles.pages}
                    />
                </SheetDrag>
            }
        />
    )
}

interface RowEnds {
    start: boolean
    end: boolean
}

/** MutualFriendRow: avatar with status, name, and the custom status or presence. */
function FriendRow({ friend, start, end }: { friend: User } & RowEnds) {
    const { theme } = useUnistyles()
    const session = useSession()
    const presence = useSessionStore(
        presencesStore,
        state => state.presences[friend.id],
    )
    const status = presence?.status ?? 'offline'
    return (
        <TableRow
            label={displayName(friend)}
            subLabel={
                presence?.customStatus ??
                t(STATUS_KEYS[status] ?? 'messages.status.offline')
            }
            icon={
                <StatusAvatar
                    user={friend}
                    size={ROW_ICON_SIZE}
                    status={status}
                    mobile={presence?.mobile}
                    streaming={presence?.streaming}
                    cutoutBackground={flattenColor(
                        theme.colors.TABLEROW_BACKGROUND_DEFAULT,
                        theme.colors.MOBILE_ACTIONSHEET_BACKGROUND,
                    )}
                />
            }
            arrow
            start={start}
            end={end}
            onPress={() => {
                hideActionSheet(MUTUALS_SHEET_KEY)
                openProfileSheet(session, friend.id)
            }}
        />
    )
}

/** MutualGuildRow: icon, name, and the user's nickname there. A tap switches the profile to that server's. */
function ServerRow({
    userId,
    mutual,
    start,
    end,
}: { userId: string; mutual: MutualGuild } & RowEnds) {
    const session = useSession()
    const guild = useSessionStore(guildsStore, state => state.guilds[mutual.id])
    if (!guild) return null
    return (
        <TableRow
            label={guild.name}
            subLabel={mutual.nick ?? undefined}
            icon={<GuildIcon guild={guild} size={ROW_ICON_SIZE} />}
            arrow
            onPress={() => {
                hideActionSheet(MUTUALS_SHEET_KEY)
                openProfileSheet(session, userId, guild.id)
            }}
            start={start}
            end={end}
        />
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    pages: { flex: 1 },
    // UsersFastList: 16 dp sides, as the Members tab.
    list: {
        paddingTop: theme.space.PX_16,
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_24,
    },
}))
