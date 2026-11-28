import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { streamOwnerId } from '../../core/discord/streams'
import { useSession, useSessionStore } from '../../core/react'
import { TableRow, TableRowIcon } from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { voiceStatesStore } from '../../stores/voiceStates'
import { toggleSelfMute } from '../voice/actions'
import {
    DEFAULT_VOLUME,
    localVolumesStore,
    MAX_VOLUME,
    setLocalVolume,
    toggleLocalMute,
} from '../voice/localVolumes'
import { rtcStore } from '../voice/rtc'
import { amplitudeToPerceptual } from '../voice/settings/perceptualVolume'
import { VolumeSlider } from '../voice/settings/VolumeSlider'
import { streamsStore } from '../voice/streams'
import { ProfileSection } from './ProfileSection'
import type { RtcContext } from '../../native/voiceTypes'

/** VolumeSlider's end: the highest volume, in perceptual units. */
const SLIDER_MAX = amplitudeToPerceptual(MAX_VOLUME, DEFAULT_VOLUME)

/**
 * UserProfileVoiceSettings: shown while the user is in our call (UserProfileActivity's `isInChannel`). Another
 * user's volume and local mute, and their stream's volume while we watch it. For ourselves, our mute.
 */
export function ProfileVoiceSettings({ userId }: { userId: string }) {
    const session = useSession()
    const callChannelId = useSessionStore(rtcStore, state => state.channelId)
    const inCall = useSessionStore(voiceStatesStore, state =>
        callChannelId === null
            ? false
            : (state.byChannel[callChannelId]?.some(
                  voice => voice.userId === userId,
              ) ?? false),
    )
    if (!inCall) return null
    if (userId === session.userId) return <CurrentUserVoiceSettings />
    return <UserVoiceSettings userId={userId} />
}

/** UserVoiceSettings: "Voice & Video Settings" with the volume and Mute. */
function UserVoiceSettings({ userId }: { userId: string }) {
    const session = useSession()
    const muted = useSessionStore(
        localVolumesStore,
        state => state.default[userId]?.muted === true,
    )
    // StreamActivityCard's "Stream Volume", for the stream we watch.
    const watching = useSessionStore(
        streamsStore,
        state =>
            state.streamKey !== null &&
            !state.own &&
            streamOwnerId(state.streamKey) === userId,
    )
    return (
        <ProfileSection title={t('userProfile.voiceVideoSettings')}>
            <TableRowGroup hasIcons>
                <UserVolume userId={userId} context="default" />
                {watching && <UserVolume userId={userId} context="stream" />}
                <TableRow
                    label={muted ? t('voice.unmute') : t('voice.mute')}
                    icon={
                        <TableRowIcon
                            name={
                                muted ? 'MicrophoneSlashIcon' : 'MicrophoneIcon'
                            }
                        />
                    }
                    onPress={() => toggleLocalMute(session, 'default', userId)}
                />
            </TableRowGroup>
        </ProfileSection>
    )
}

/**
 * One context's volume slider. The reference's profile labels it for accessibility only. Here it shows the label
 * as its settings do (UserSettingsVoiceOutputOptions): a TableRow titled "Volume" or "Stream Volume" over the
 * slider.
 */
function UserVolume({
    userId,
    context,
}: {
    userId: string
    context: RtcContext
}) {
    const session = useSession()
    const volume = useSessionStore(
        localVolumesStore,
        state => state[context][userId]?.volume ?? DEFAULT_VOLUME,
    )
    return (
        <TableRow
            label={
                context === 'stream'
                    ? t('userProfile.streamVolume')
                    : t('userProfile.volume')
            }
            subLabel={
                <View style={styles.slider}>
                    <VolumeSlider
                        value={volume}
                        max={SLIDER_MAX}
                        unity={DEFAULT_VOLUME}
                        onValueChange={amplitude =>
                            setLocalVolume(session, context, userId, amplitude)
                        }
                    />
                </View>
            }
        />
    )
}

/** CurrentUserVoiceSettings: "Voice Settings" with our own Mute. */
function CurrentUserVoiceSettings() {
    const session = useSession()
    const muted = useSessionStore(
        rtcStore,
        state => state.selfMute || state.selfDeaf,
    )
    return (
        <ProfileSection title={t('voice.settings')}>
            <TableRowGroup hasIcons>
                <TableRow
                    label={muted ? t('voice.unmute') : t('voice.mute')}
                    icon={
                        <TableRowIcon
                            name={
                                muted ? 'MicrophoneSlashIcon' : 'MicrophoneIcon'
                            }
                        />
                    }
                    onPress={() => toggleSelfMute(session)}
                />
            </TableRowGroup>
        </ProfileSection>
    )
}

const styles = StyleSheet.create(theme => ({
    // UserSettingsVoiceOutputOptions' `slider`: under the label.
    slider: { marginTop: theme.space.PX_4 },
}))
