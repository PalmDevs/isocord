import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { activityAssetUrl, applicationIconUrl } from '../../core/discord/cdn'
import { useSession, useSessionStore } from '../../core/react'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { fetchApplication, useApplication } from '../../stores/applications'
import { presencesStore } from '../../stores/presences'
import { ACTIVITY_IMAGE_SIZE, ActivityType } from './constants'
import type { IconName } from '../../design/icons/Icon'
import type { MessageKey } from '../../i18n'
import type { Presence } from '../../stores/presences'

type Activity = NonNullable<Presence['activity']>

const ACTIVITY_KEYS: Partial<Record<number, MessageKey>> = {
    [ActivityType.PLAYING]: 'userProfile.activity.playing',
    [ActivityType.STREAMING]: 'userProfile.activity.streaming',
    [ActivityType.LISTENING]: 'userProfile.activity.listening',
    [ActivityType.WATCHING]: 'userProfile.activity.watching',
    [ActivityType.COMPETING]: 'userProfile.activity.competing',
}

/** getTimestampBadgeIcon: the activities with a TimestampBadge, and its icon. */
const TIMER_ICONS: Partial<Record<number, IconName>> = {
    [ActivityType.PLAYING]: 'GameControllerIcon',
    [ActivityType.LISTENING]: 'MusicIcon',
    [ActivityType.WATCHING]: 'TvIcon',
}

/** UserProfileActivity's smallImage, on a ring of smallImageBackground. */
const SMALL_IMAGE_SIZE = 24
const SMALL_IMAGE_RING = 4
/** useTimestampTickedNow: the timer ticks every second. */
const TICK_MS = 1000

/**
 * UserProfileActivityCard in a compact row: the large image (else the app's icon) with the small image over its
 * corner, the activity, details and state, and the time since it started.
 */
export function ProfileActivity({ userId }: { userId: string }) {
    const session = useSession()
    const activity = useSessionStore(
        presencesStore,
        state => state.presences[userId]?.activity,
    )
    const applicationId = activity?.applicationId
    const application = useApplication(applicationId)
    useEffect(() => {
        if (applicationId) fetchApplication(session, applicationId)
    }, [session, applicationId])
    const activityKey = activity ? ACTIVITY_KEYS[activity.type] : undefined
    if (!activity || !activityKey) return null
    const appIcon =
        applicationId && application?.icon
            ? applicationIconUrl(
                  applicationId,
                  application.icon,
                  ACTIVITY_IMAGE_SIZE * 3,
              )
            : undefined
    const timerIcon = TIMER_ICONS[activity.type]
    return (
        <View style={styles.card}>
            <View style={styles.activity}>
                <ActivityImage activity={activity} appIcon={appIcon} />
                <View style={styles.activityText}>
                    <Text variant="text-sm/semibold" color="TEXT_DEFAULT">
                        {t(activityKey, {
                            name: application?.name ?? activity.name,
                        })}
                    </Text>
                    {activity.details && (
                        <Text variant="text-sm/medium" color="TEXT_DEFAULT">
                            {activity.details}
                        </Text>
                    )}
                    {activity.state && (
                        <Text variant="text-sm/medium" color="TEXT_MUTED">
                            {activity.state}
                        </Text>
                    )}
                    {timerIcon && activity.start !== undefined && (
                        <Elapsed icon={timerIcon} start={activity.start} />
                    )}
                </View>
            </View>
        </View>
    )
}

/** useImageForActivity: the large asset with the small one over it, else the app's icon, else UnknownGameIcon. */
function ActivityImage({
    activity,
    appIcon,
}: {
    activity: Activity
    appIcon: string | undefined
}) {
    const asset = (key: string, size: number) =>
        activityAssetUrl(activity.applicationId, key, size * 3)
    const large = activity.largeImage
        ? asset(activity.largeImage, ACTIVITY_IMAGE_SIZE)
        : appIcon
    return (
        <View>
            {large ? (
                <Image source={large} style={styles.largeImage} />
            ) : (
                <View style={[styles.largeImage, styles.unknown]}>
                    <Icon name="UnknownGameIcon" color="ICON_MUTED" />
                </View>
            )}
            {activity.largeImage && activity.smallImage && (
                <View style={styles.smallImageRing}>
                    <Image
                        source={asset(activity.smallImage, SMALL_IMAGE_SIZE)}
                        style={styles.smallImage}
                    />
                </View>
            )}
        </View>
    )
}

/** TimestampBadge: the badge icon and the time since `start`, ticking each second. */
function Elapsed({ icon, start }: { icon: IconName; start: number }) {
    const [now, setNow] = useState(Date.now)
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), TICK_MS)
        return () => clearInterval(timer)
    }, [])
    return (
        <View style={styles.elapsed}>
            <Icon name={icon} size="xxs" color="TEXT_FEEDBACK_POSITIVE" />
            <Text
                variant="text-sm/bold"
                color="TEXT_FEEDBACK_POSITIVE"
                tabularNumbers
            >
                {formatElapsed(Math.max(0, now - start))}
            </Text>
        </View>
    )
}

/** formatActiveTimestamp: `h:mm:ss`, or `m:ss` under an hour. */
function formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor(seconds / 60) % 60
    const pad = (value: number) => String(value).padStart(2, '0')
    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}`
        : `${minutes}:${pad(seconds % 60)}`
}

const styles = StyleSheet.create(theme => ({
    card: {
        padding: theme.space.PX_12,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.CARD_MUTED_BG,
    },
    activity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
    },
    largeImage: {
        width: ACTIVITY_IMAGE_SIZE,
        height: ACTIVITY_IMAGE_SIZE,
        borderRadius: theme.radii.sm,
    },
    unknown: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.BACKGROUND_MOD_SUBTLE,
    },
    smallImageRing: {
        position: 'absolute',
        right: -SMALL_IMAGE_RING,
        bottom: -SMALL_IMAGE_RING,
        padding: SMALL_IMAGE_RING,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOW,
    },
    smallImage: {
        width: SMALL_IMAGE_SIZE,
        height: SMALL_IMAGE_SIZE,
        borderRadius: SMALL_IMAGE_SIZE / 2,
    },
    activityText: { flexShrink: 1 },
    elapsed: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
    },
}))
