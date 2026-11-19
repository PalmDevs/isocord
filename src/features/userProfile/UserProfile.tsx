import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../core/react'
import { BotTag } from '../../design/components/BotTag'
import { Skeleton, SkeletonPulse } from '../../design/components/Skeleton'
import { useCloseSheet } from '../../design/components/sheets/sheetContext'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { membersStore } from '../../stores/members'
import { fetchUserProfile } from '../../stores/userProfiles'
import { isNonUserBot } from '../../stores/users'
import { ProfileActions } from './ProfileActions'
import { ProfileActivity } from './ProfileActivity'
import { ProfileBadges } from './ProfileBadges'
import { ProfileBio } from './ProfileBio'
import { ProfileConnections } from './ProfileConnections'
import { ProfileGuildTag } from './ProfileGuildTag'
import { ProfileHeader } from './ProfileHeader'
import { ProfileMemberSince } from './ProfileMemberSince'
import { ProfileModeration } from './ProfileModeration'
import { ProfileMutuals } from './ProfileMutuals'
import { ProfileNote } from './ProfileNote'
import { ProfileRoles } from './ProfileRoles'
import { ProfileSection } from './ProfileSection'
import { ProfileThemeScope } from './profileTheme'
import { useProfileView } from './useProfileView'
import type { ReactNode } from 'react'
import type { ProfileView } from './useProfileView'

const LOADING_BIO_LINES = 2

export interface UserProfileProps {
    userId: string
    /** The server whose profile is shown, undefined for the main profile. */
    guildId: string | undefined
    /** The plain background behind the profile, for the avatar's cutout. */
    background: string
    /** The button at the banner's top right, such as the more menu. None when left out. */
    action?: ReactNode
    /** Shown under the name, username and mutuals. */
    afterIdentity?: ReactNode
}

/**
 * UserProfileContent: the header and the main tab, in the theme the profile's colours pick. The owner draws the
 * gradient behind it. What the client already knows shows at once, the fetch fills in the rest.
 */
export function UserProfile({
    userId,
    guildId,
    background,
    action,
    afterIdentity,
}: UserProfileProps) {
    const session = useSession()
    const view = useProfileView(userId, guildId)
    const [failed, setFailed] = useState(false)
    const hasProfile = view ? !isNonUserBot(view.user) : true
    useEffect(() => {
        setFailed(false)
        if (!hasProfile) return
        fetchUserProfile(session, userId, guildId).catch(() => setFailed(true))
    }, [session, userId, guildId, hasProfile])
    if (!view) return null
    return (
        <ProfileThemeScope colors={view.themeColors}>
            <ProfileHeader
                view={view}
                background={background}
                action={action}
            />
            <ProfileContent
                view={view}
                loading={hasProfile && !view.profile && !failed}
                afterIdentity={afterIdentity}
            />
        </ProfileThemeScope>
    )
}

function ProfileContent({
    view,
    loading,
    afterIdentity,
}: {
    view: ProfileView
    loading: boolean
    afterIdentity: ReactNode
}) {
    const session = useSession()
    const closeSheet = useCloseSheet()
    const { user, profile, guildId } = view
    const roleIds = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId]?.[user.id]?.roles : undefined,
    )
    return (
        <View style={styles.content}>
            <View style={styles.identity}>
                <ProfileIdentity view={view} />
                {/* Nothing is mutual with yourself. */}
                {user.id !== session.userId && (
                    <ProfileMutuals
                        userId={user.id}
                        guildId={guildId}
                        friends={profile?.mutual_friends ?? []}
                        guilds={profile?.mutual_guilds ?? []}
                    />
                )}
            </View>
            {afterIdentity}
            <ProfileActions user={user} />
            <ProfileActivity userId={user.id} />
            {loading && <BioSkeleton />}
            {view.bio ? (
                <ProfileSection title={t('userProfile.bio')}>
                    <ProfileBio
                        bio={view.bio}
                        guildId={guildId}
                        onLink={closeSheet}
                    />
                </ProfileSection>
            ) : null}
            <ProfileMemberSince
                userId={user.id}
                guildId={guildId}
                joinedAt={profile?.guild_member?.joined_at}
            />
            {guildId && (
                <ProfileRoles
                    guildId={guildId}
                    roleIds={profile?.guild_member?.roles ?? roleIds ?? []}
                />
            )}
            {guildId && (
                <ProfileModeration
                    guildId={guildId}
                    userId={user.id}
                    name={view.name}
                />
            )}
            <ProfileConnections accounts={profile?.connected_accounts ?? []} />
            <ProfileNote userId={user.id} />
        </View>
    )
}

/** UserProfilePrimaryInfo: the display name, then the username, pronouns, tags and badges. */
function ProfileIdentity({ view }: { view: ProfileView }) {
    const { user, profile, guildId } = view
    return (
        <View style={styles.namesAndPronouns}>
            <Text
                variant="heading-xl/semibold"
                color="MOBILE_TEXT_HEADING_PRIMARY"
            >
                {view.name}
            </Text>
            <View style={styles.usernameLine}>
                <Text variant="text-md/medium" color="TEXT_DEFAULT">
                    {view.pronouns
                        ? `${user.username} • ${view.pronouns}`
                        : user.username}
                </Text>
                {user.bot && <BotTag />}
                <ProfileGuildTag user={user} />
                <ProfileBadges
                    badges={[
                        ...(profile?.badges ?? []),
                        ...(guildId ? (profile?.guild_badges ?? []) : []),
                    ]}
                />
            </View>
        </View>
    )
}

function BioSkeleton() {
    return (
        <SkeletonPulse style={styles.skeleton}>
            {Array.from({ length: LOADING_BIO_LINES }, (_, line) => (
                <Skeleton
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder lines
                    key={line}
                    width={line === 0 ? '90%' : '60%'}
                    height={16}
                />
            ))}
        </SkeletonPulse>
    )
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: theme.space.PX_24,
        // UserProfileSection: 12 above and 8 below each section.
        gap: theme.space.PX_24,
    },
    skeleton: { gap: theme.space.PX_8 },
    identity: { paddingTop: theme.space.PX_48, gap: theme.space.PX_8 },
    namesAndPronouns: { gap: theme.space.PX_4 },
    usernameLine: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: theme.space.PX_8,
    },
}))
