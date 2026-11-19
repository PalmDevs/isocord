import { Pressable, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSessionStore } from '../../../core/react'
import { StatusAvatar } from '../../../design/components/avatars/StatusAvatar'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { displayName, usersStore } from '../../../stores/users'
import { GroupAvatar } from '../../messages/GroupAvatar'
import { useDm } from '../../messages/useDm'
import type { ReactNode } from 'react'

const AVATAR_SIZE = 40

/**
 * useRecipientsLabel: the people of a group DM that has a name, which does not show them, as "a, b, c, and 2
 * others". An unnamed group is named by them already.
 */
function useRecipientsLabel(channelId: string): string | undefined {
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    // Joined inside the selector: a fresh array each read would never compare equal.
    const joined = useSessionStore(usersStore, state =>
        channel?.name
            ? (channel.recipient_ids ?? [])
                  .map(id => displayName(state.users[id]))
                  .join('\u0000')
            : '',
    )
    const [first = '', second = '', third = ''] = joined.split('\u0000')
    const count = joined === '' ? 0 : joined.split('\u0000').length
    if (count === 0) return undefined
    if (count === 1) return t('search.recipients.one', { first })
    if (count === 2) return t('search.recipients.two', { first, second })
    if (count === 3)
        return t('search.recipients.three', { first, second, third })
    return t(
        count === 4 ? 'search.recipients.manyOne' : 'search.recipients.many',
        { first, second, third, count: count - 3 },
    )
}

/** list/rows/DMRow and GroupDMRow: avatar with status (or the group icon), name, and for a named group the people in it. */
export function DmRow({
    channelId,
    onPress,
}: {
    channelId: string
    onPress: (channelId: string) => void
}) {
    const dm = useDm(channelId)
    const recipients = useRecipientsLabel(channelId)
    const { theme } = useUnistyles()
    if (!dm) return null
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={dm.name}
            onPress={() => onPress(channelId)}
            style={styles.row}
            android_ripple={styles.ripple}
        >
            {dm.recipient ? (
                <StatusAvatar
                    user={dm.recipient}
                    size={AVATAR_SIZE}
                    status={dm.presence?.status ?? 'offline'}
                    mobile={dm.presence?.mobile}
                    streaming={dm.presence?.streaming}
                    // CutoutBackgroundProvider: the DMs search's background (DmRow only shows in that search, and
                    // pressing it is a ripple).
                    cutoutBackground={theme.colors.BACKGROUND_BASE_LOW}
                />
            ) : (
                <GroupAvatar
                    id={channelId}
                    name={dm.name}
                    icon={dm.icon}
                    size={AVATAR_SIZE}
                />
            )}
            <View style={styles.label}>
                <Text
                    variant="text-md/medium"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                    lineClamp={1}
                >
                    {dm.name}
                </Text>
                {dm.isGroup ? (
                    recipients ? (
                        <Text
                            variant="text-sm/medium"
                            color="TEXT_MUTED"
                            lineClamp={1}
                        >
                            {recipients}
                        </Text>
                    ) : null
                ) : dm.recipient && dm.recipient.username !== dm.name ? (
                    <Text
                        variant="text-sm/medium"
                        color="TEXT_MUTED"
                        lineClamp={1}
                    >
                        {dm.recipient.username}
                    </Text>
                ) : null}
            </View>
        </Pressable>
    )
}

/** list/rows/GenericTextRow and the text variant of SearchHistoryRow: a magnifying glass and the text. */
export function TextRow({
    text,
    onPress,
    trailing,
}: {
    text: string
    onPress: () => void
    trailing?: ReactNode
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={text}
            onPress={onPress}
            style={styles.row}
            android_ripple={styles.ripple}
        >
            <View style={styles.icon}>
                <Icon name="MagnifyingGlassIcon" size="sm" color="TEXT_MUTED" />
            </View>
            <View style={styles.label}>
                <Text
                    variant="text-md/semibold"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                    lineClamp={1}
                >
                    {text}
                </Text>
            </View>
            {trailing}
        </Pressable>
    )
}

/** list/SearchListSection: a title with an optional trailing action. */
export function SectionHeader({
    title,
    trailing,
}: {
    title: string
    trailing?: ReactNode
}) {
    return (
        <View style={styles.section}>
            <Text variant="text-sm/semibold" color="TEXT_MUTED">
                {title}
            </Text>
            {trailing}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space.PX_16,
        paddingVertical: theme.space.PX_8,
        minHeight: 56,
    },
    ripple: { color: theme.colors.MOBILE_ANDROID_BUTTON_BACKGROUND_RIPPLE },
    icon: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        flex: 1,
        marginLeft:
            theme.modules.mobile.MESSAGES_ITEM_CHANNEL_AVATAR_MARGIN_END,
        marginRight: theme.space.PX_8,
    },
    section: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.space.PX_16,
        paddingTop: theme.space.PX_16,
        paddingBottom: theme.space.PX_8,
    },
}))
