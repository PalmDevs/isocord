import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { snowflakeTimestamp } from '../../core/discord/snowflake'
import { useSessionStore } from '../../core/react'
import { GuildIcon } from '../../design/components/avatars/GuildIcon'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { guildsStore } from '../../stores/guilds'
import { DIVIDER_DOT } from './constants'
import { ProfileSection } from './ProfileSection'
import type { ReactNode } from 'react'

/** GuildIconSizes.XXSMALL. */
const GUILD_ICON_SIZE = 16

/** ConnectionsUtils.getCreatedAtDate: a short month, the day and the year. */
const createdAtDate = (time: string | number) =>
    new Date(time).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })

/**
 * UserProfileAboutMeCard's MemberJoinDates: when the user joined Discord, from their id, and when they joined the
 * server shown, after a dot.
 */
export function ProfileMemberSince({
    userId,
    guildId,
    joinedAt,
}: {
    userId: string
    guildId: string | undefined
    joinedAt: string | undefined
}) {
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    return (
        <ProfileSection title={t('userProfile.memberSince')}>
            <View style={styles.dates}>
                <DateWithIcon
                    icon={
                        <Icon name="ClydeIcon" size="xs" color="TEXT_DEFAULT" />
                    }
                    accessibilityLabel={t('userProfile.joinedDiscord', {
                        date: createdAtDate(snowflakeTimestamp(userId)),
                    })}
                >
                    {createdAtDate(snowflakeTimestamp(userId))}
                </DateWithIcon>
                {guild && joinedAt && (
                    <>
                        <Text
                            variant="text-md/normal"
                            color="TEXT_DEFAULT"
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                        >
                            {DIVIDER_DOT}
                        </Text>
                        <DateWithIcon
                            icon={
                                <GuildIcon
                                    guild={guild}
                                    size={GUILD_ICON_SIZE}
                                />
                            }
                            accessibilityLabel={t('userProfile.joinedGuild', {
                                guildName: guild.name,
                                date: createdAtDate(joinedAt),
                            })}
                        >
                            {createdAtDate(joinedAt)}
                        </DateWithIcon>
                    </>
                )}
            </View>
        </ProfileSection>
    )
}

/** UserProfileAboutMeCard's TextWithIcon. */
function DateWithIcon({
    icon,
    accessibilityLabel,
    children,
}: {
    icon: ReactNode
    accessibilityLabel: string
    children: string
}) {
    return (
        <View
            accessible
            accessibilityLabel={accessibilityLabel}
            style={styles.date}
        >
            {icon}
            <Text variant="text-md/normal" color="TEXT_DEFAULT">
                {children}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    dates: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: theme.space.PX_6,
    },
    date: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: theme.space.PX_6,
    },
}))
