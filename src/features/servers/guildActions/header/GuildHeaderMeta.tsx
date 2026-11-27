import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import { Text } from '../../../../design/components/Text'
import { Icon } from '../../../../design/icons/Icon'
import { t } from '../../../../i18n'
import { showToast } from '../../../toasts'

const DOT_SIZE = 8

/** Community pill shown on community servers; tapping explains who can join. */
function CommunityPill({ discoverable }: { discoverable: boolean }) {
    const message = t(
        discoverable
            ? 'guildActions.publicServer'
            : 'guildActions.inviteOnlyServer',
    )
    const icon = discoverable ? 'GlobeEarthIcon' : 'LockIcon'
    return (
        <RipplePressable
            accessibilityRole="button"
            onPress={() =>
                showToast({
                    key: 'guild-community-visibility',
                    content: message,
                })
            }
            style={styles.pill}
        >
            <Icon name={icon} size="xxs" color="TEXT_DEFAULT" />
            <Text variant="text-xs/medium" color="TEXT_DEFAULT">
                {t('guildActions.communityServer')}
            </Text>
        </RipplePressable>
    )
}

/** Boost pill showing boost count and tier when the server has boosts. */
function BoostPill({ count, tier }: { count: number; tier: number }) {
    const label =
        count > 0
            ? t(
                  count === 1
                      ? 'guildActions.boosts.one'
                      : 'guildActions.boosts.other',
                  {
                      count,
                  },
              )
            : t('guildActions.boostTier', { tier })
    return (
        <View style={styles.pill}>
            <Icon
                name="BoostGemIcon"
                size="xxs"
                color="PREMIUM_NITRO_PINK_TEXT"
            />
            <Text variant="text-xs/medium" color="TEXT_DEFAULT">
                {label}
            </Text>
        </View>
    )
}

/** GuildActionSheetMemberCount: online or total member count with a status dot. */
function MemberCount({ online, count }: { online: boolean; count: number }) {
    const label = online
        ? t('guildActions.onlineCount', { count: count.toLocaleString() })
        : t(
              count === 1
                  ? 'servers.header.members.one'
                  : 'servers.header.members.other',
              { count: count.toLocaleString() },
          )
    return (
        <View style={styles.count}>
            <View
                style={[
                    styles.dot,
                    online ? styles.onlineDot : styles.totalDot,
                ]}
            />
            <Text variant="text-sm/medium" color="TEXT_MUTED" lineClamp={1}>
                {label}
            </Text>
        </View>
    )
}

/** Community and boost pills with the online and total member counts. */
export function GuildHeaderMeta({
    isCommunity,
    isDiscoverable,
    memberCount,
    onlineCount,
    boostCount,
    boostTier,
}: {
    isCommunity: boolean
    isDiscoverable: boolean
    memberCount: number
    onlineCount?: number
    boostCount: number
    boostTier: number
}) {
    const hasBoosts = boostCount > 0 || boostTier > 0
    if (!isCommunity && memberCount <= 0 && onlineCount == null && !hasBoosts)
        return null
    return (
        <View style={styles.meta}>
            {isCommunity && <CommunityPill discoverable={isDiscoverable} />}
            {hasBoosts && <BoostPill count={boostCount} tier={boostTier} />}
            <View style={styles.counts}>
                {onlineCount != null && (
                    <MemberCount online count={onlineCount} />
                )}
                {memberCount > 0 && (
                    <MemberCount online={false} count={memberCount} />
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    meta: {
        marginTop: theme.space.PX_12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.space.PX_12,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_6,
        paddingVertical: theme.space.PX_4,
        paddingHorizontal: theme.space.PX_8,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.BACKGROUND_MOD_STRONG,
    },
    counts: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: theme.space.PX_12,
    },
    count: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_6,
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: theme.radii.round,
    },
    onlineDot: { backgroundColor: theme.colors.TEXT_STATUS_ONLINE },
    totalDot: { backgroundColor: theme.colors.TEXT_STATUS_OFFLINE },
}))
