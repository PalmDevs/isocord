import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../../core/react'
import { Avatar } from '../../../../design/components/avatars/Avatar'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import VideoView from '../../../../native/IsocordVideoViewNativeComponent'
import { usersStore } from '../../../../stores/users'
import { openProfileSheet } from '../../../userProfile/openProfileSheet'
import { useMirrorOwnCamera } from '../../cameras'
import { rtcStore } from '../../rtc'
import { useShownVideo } from '../../useShownVideo'
import { ParticipantLabel } from './ParticipantLabel'
import { useParticipantName } from './useParticipantName'
import type { VoiceState } from '../../../../stores/voiceStates'

/** The avatar fills this share of a card's shorter side. */
const AVATAR_RATIO = 0.5
/** The speaking ring's width. */
const SPEAKING_RING = 2

/**
 * VoicePanelCard: a participant's card, filling the frame `GridCard` gives it. Their avatar, or their camera while
 * it is on, with the name, mute and deafen marks below, and a ring while they speak. A long press or the name opens
 * their profile (showUserProfileActionSheet with isVoiceContext). Tapping a camera grows it over the grid
 * (useIsVoicePanelParticipantFocusable), tapping an avatar opens the profile. The video pauses while `covered`.
 */
export function ParticipantCard({
    voice,
    width,
    height,
    covered,
    onFocus,
}: {
    voice: VoiceState
    width: number
    height: number
    covered: boolean
    onFocus: () => void
}) {
    const session = useSession()
    const user = useSessionStore(usersStore, state => state.users[voice.userId])
    const name = useParticipantName(voice.userId, voice.guildId)
    const own = voice.userId === session.userId
    const mirrorOwn = useMirrorOwnCamera()
    const speaking = useSessionStore(rtcStore, state =>
        state.speaking.includes(voice.userId),
    )
    const camera = useSessionStore(rtcStore, state =>
        own ? state.selfVideo : state.video.includes(voice.userId),
    )
    // Our own camera is not received.
    useShownVideo({
        context: 'default',
        userId: voice.userId,
        shown: camera && !own,
        width,
        height,
    })
    const openProfile = () =>
        openProfileSheet(session, voice.userId, voice.guildId ?? undefined)
    return (
        <View style={[styles.card, speaking && styles.speaking]}>
            {camera ? (
                <VideoView
                    context="default"
                    userId={voice.userId}
                    // Our front camera is shown mirrored, as in the reference's own preview.
                    mirror={own && mirrorOwn}
                    paused={covered}
                    fit="cover"
                    style={styles.fill}
                />
            ) : (
                <Avatar
                    user={user ?? { id: voice.userId, avatar: null }}
                    size={Math.min(width, height) * AVATAR_RATIO}
                />
            )}
            {/* Departure: the reference's single tap shows or hides the controls, which ours never hide. */}
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={name}
                onPress={camera ? onFocus : openProfile}
                onLongPress={openProfile}
                style={styles.fill}
            />
            <ParticipantLabel name={name} voice={voice} onPress={openProfile} />
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
        borderWidth: SPEAKING_RING,
        borderColor: 'transparent',
        backgroundColor: theme.colors.VOICE_VIDEO_VIDEO_TILE_BACKGROUND,
    },
    speaking: { borderColor: theme.colors.STATUS_SPEAKING },
    fill: { ...StyleSheet.absoluteFillObject },
}))
