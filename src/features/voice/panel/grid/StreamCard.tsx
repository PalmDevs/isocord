import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../../core/react'
import { ActivityIndicator } from '../../../../design/components/ActivityIndicator'
import { Button } from '../../../../design/components/buttons/Button'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import { t } from '../../../../i18n'
import VideoView from '../../../../native/IsocordVideoViewNativeComponent'
import { openProfileSheet } from '../../../userProfile/openProfileSheet'
import { LiveTag } from '../../rows/LiveTag'
import { streamsStore } from '../../streams'
import { useShownVideo } from '../../useShownVideo'
import { ParticipantLabel } from './ParticipantLabel'
import { useParticipantName } from './useParticipantName'

/** Shape of the stream we watch or own: a 16:9 screen. */
export const STREAM_ASPECT_RATIO = 16 / 9

interface StreamCardProps {
    userId: string
    guildId: string | null
    width: number
    height: number
}

/**
 * VoicePanelStreamPreview: another user's stream that we do not watch. The whole card is its press target, as the
 * reference's Pressable is: a tap watches it. A long press opens the streamer's profile, as on every VoicePanelCard.
 */
export function StreamCard({
    userId,
    guildId,
    onWatch,
}: StreamCardProps & { onWatch: () => void }) {
    const session = useSession()
    const name = useParticipantName(userId, guildId)
    const openProfile = () =>
        openProfileSheet(session, userId, guildId ?? undefined)
    return (
        <View style={styles.card}>
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={t('voice.watchStream')}
                onPress={onWatch}
                onLongPress={openProfile}
                style={styles.fill}
            />
            <View style={styles.tag}>
                <LiveTag />
            </View>
            <Button
                size="sm"
                variant="secondary-overlay"
                text={t('voice.watchStream')}
                style={styles.center}
                onPress={onWatch}
            />
            <ParticipantLabel name={name} onPress={openProfile} />
        </View>
    )
}

/**
 * `userId`'s stream, which we watch or own. The header stops a watched one, the chip ours. Once connected it is
 * focusable: tapping it grows the stream over the grid. A long press opens the streamer's profile. The video
 * pauses while `covered`.
 */
export function WatchedStreamCard({
    userId,
    guildId,
    width,
    height,
    covered,
    onFocus,
}: StreamCardProps & { covered: boolean; onFocus: () => void }) {
    const session = useSession()
    // The video waits for the stream connection: until then there is nothing to show.
    const connected = useSessionStore(
        streamsStore,
        state => state.server !== null,
    )
    const name = useParticipantName(userId, guildId)
    const openProfile = () =>
        openProfileSheet(session, userId, guildId ?? undefined)
    useShownVideo({
        context: 'stream',
        userId,
        shown: connected,
        width,
        height,
        full: true,
    })
    return (
        <View style={styles.card}>
            {connected ? (
                <VideoView
                    context="stream"
                    userId={userId}
                    paused={covered}
                    fit="contain"
                    style={styles.fill}
                />
            ) : (
                <ActivityIndicator />
            )}
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={name}
                onPress={connected ? onFocus : undefined}
                onLongPress={openProfile}
                style={styles.fill}
            />
            <View pointerEvents="none" style={styles.tag}>
                <LiveTag />
            </View>
            <ParticipantLabel name={name} onPress={openProfile} />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    card: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.BLACK,
    },
    fill: { ...StyleSheet.absoluteFillObject },
    center: { alignSelf: 'center' },
    tag: {
        position: 'absolute',
        top: theme.space.PX_8,
        left: theme.space.PX_8,
    },
}))
