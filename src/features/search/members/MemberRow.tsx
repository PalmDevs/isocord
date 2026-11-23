import { memo } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { flattenColor } from '../../../design/components/avatars/flattenColor'
import { StatusAvatar } from '../../../design/components/avatars/StatusAvatar'
import { BotTag } from '../../../design/components/BotTag'
import { Skeleton, SkeletonPulse } from '../../../design/components/Skeleton'
import { Text } from '../../../design/components/Text'
import { TableRow } from '../../../design/components/table/TableRow'
import { Icon } from '../../../design/icons/Icon'
import { guildsStore } from '../../../stores/guilds'
import { membersStore } from '../../../stores/members'
import { presencesStore } from '../../../stores/presences'
import { displayName, usersStore } from '../../../stores/users'
import { authorStyle } from '../../chat/author'
import { hexColor } from '../../chat/color'
import { openUserProfile } from '../../chat/headerActions'
import { activityLine } from './activityLine'

const AVATAR_SIZE = 32
export const MEMBER_PLACEHOLDER_ROW_HEIGHT = 56

export interface MemberRowProps {
    userId: string
    guildId?: string
    ownerId?: string
    /** The member is in the offline group: no status dot, no activity. */
    offline?: boolean
    /** First and last of a group: the card's corners are rounded. */
    start?: boolean
    end?: boolean
}

/** list/rows/GuildChannelMemberRow and UserRow: avatar with status, name in the role colour, owner crown, app tag, activity. */
export const MemberRow = memo(function MemberRow({
    userId,
    guildId,
    ownerId,
    offline = false,
    start,
    end,
}: MemberRowProps) {
    const session = useSession()
    const user = useSessionStore(usersStore, state => state.users[userId])
    const member = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId]?.[userId] : undefined,
    )
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    const presence = useSessionStore(
        presencesStore,
        state => state.presences[userId],
    )
    const { theme } = useUnistyles()
    if (!user) return <MemberPlaceholderRow start={start} end={end} />

    const color = authorStyle(guild, member).color
    // CutoutBackgroundProvider: the row's card over the details' background. The status is then drawn with views,
    // not react-native-svg masks, which redrew every row in software as the list scrolled.
    const cutout = flattenColor(
        theme.colors.CARD_MUTED_BG,
        theme.colors.MOBILE_ACTIONSHEET_BACKGROUND,
    )
    const status = offline ? undefined : presence?.status
    const line = offline ? undefined : activityLine(presence)
    const name = member?.nick ?? displayName(user)

    return (
        <TableRow
            start={start}
            end={end}
            onPress={() => openUserProfile(session, userId, guildId)}
            accessibilityLabel={name}
            icon={
                <StatusAvatar
                    user={user}
                    size={AVATAR_SIZE}
                    status={status === 'offline' ? undefined : status}
                    mobile={!offline && presence?.mobile}
                    streaming={!offline && presence?.streaming}
                    cutoutBackground={cutout}
                />
            }
            label={
                <View style={styles.name}>
                    <Text
                        variant="text-md/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        lineClamp={1}
                        style={[
                            styles.nameText,
                            color !== undefined && { color: hexColor(color) },
                        ]}
                    >
                        {name}
                    </Text>
                    {ownerId === userId && (
                        <Icon
                            name="CrownIcon"
                            size="xs"
                            color="TEXT_FEEDBACK_WARNING"
                        />
                    )}
                    {user.bot && <BotTag />}
                </View>
            }
            subLabel={line}
            subLabelLineClamp={1}
        />
    )
})

/** placeholders/MemberRowPlaceholder: a FormRowPlaceholder, an avatar and two lines, in the card of a row. */
export function MemberPlaceholderRow({
    animate = true,
    start,
    end,
}: {
    animate?: boolean
    start?: boolean
    end?: boolean
}) {
    // UsersFastList.Placeholder uses static shapes for unloaded member slots.
    const Content = animate ? SkeletonPulse : View
    return (
        <View
            style={styles.placeholder(start, end)}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            <Content style={styles.placeholderContent}>
                <Skeleton
                    width={AVATAR_SIZE}
                    height={AVATAR_SIZE}
                    radius={AVATAR_SIZE / 2}
                />
                <View style={styles.placeholderLines}>
                    <Skeleton width="45%" height={14} radius={4} />
                </View>
            </Content>
        </View>
    )
}

/**
 * UsersFastList's PlaceholderSection, USERS_LIST_SECTION_HEIGHT tall, for a group not loaded yet. The reference
 * leaves it empty; isocord draws a strip where the group's name goes.
 */
export function MemberPlaceholderSection() {
    return (
        <SkeletonPulse style={styles.placeholderSection}>
            <Skeleton width="30%" height={14} radius={4} />
        </SkeletonPulse>
    )
}

/** UsersFastList section: the group's name and count, in text-md/medium subtle. */
export function MemberSectionHeader({ title }: { title: string }) {
    return (
        <Text
            accessibilityRole="header"
            variant="text-md/medium"
            color="TEXT_SUBTLE"
            style={styles.section}
        >
            {title}
        </Text>
    )
}

const styles = StyleSheet.create(theme => ({
    name: { flexDirection: 'row', alignItems: 'center', gap: theme.space.PX_4 },
    nameText: { flexShrink: 1 },
    // MessageTagView: white on the brand colour.
    section: {
        // USERS_LIST_PADDING_BETWEEN_SECTIONS above and USERS_LIST_SECTION_BOTTOM_PADDING below.
        paddingTop: theme.space.PX_24,
        paddingBottom: theme.space.PX_8,
    },
    // USERS_LIST_SECTION_HEIGHT: the padding between sections, the 18 dp title and the section's bottom padding.
    placeholderSection: {
        height: theme.space.PX_24 + 18 + theme.space.PX_8,
        paddingTop: theme.space.PX_24,
        paddingBottom: theme.space.PX_8,
        justifyContent: 'center',
    },
    placeholder: (start?: boolean, end?: boolean) => ({
        height: MEMBER_PLACEHOLDER_ROW_HEIGHT,
        backgroundColor: theme.colors.CARD_MUTED_BG,
        borderTopLeftRadius: start
            ? theme.modules.mobile.TABLE_ROW_BORDER_RADIUS
            : 0,
        borderTopRightRadius: start
            ? theme.modules.mobile.TABLE_ROW_BORDER_RADIUS
            : 0,
        borderBottomLeftRadius: end
            ? theme.modules.mobile.TABLE_ROW_BORDER_RADIUS
            : 0,
        borderBottomRightRadius: end
            ? theme.modules.mobile.TABLE_ROW_BORDER_RADIUS
            : 0,
    }),
    placeholderContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.modules.mobile.TABLE_ROW_PADDING,
        gap: theme.modules.mobile.TABLE_ROW_PADDING,
    },
    placeholderLines: { flex: 1 },
}))
