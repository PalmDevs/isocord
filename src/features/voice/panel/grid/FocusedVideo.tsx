import { View } from 'react-native'
import Animated, {
    interpolate,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { useSession, useSessionStore } from '../../../../core/react'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import {
    VOICE_CARD_OPACITY_TIMING,
    VOICE_CARD_SCALE_SPRING,
    VOICE_PANEL_LAYOUT_SPRING,
} from '../../../../design/tokens/motion'
import VideoView from '../../../../native/IsocordVideoViewNativeComponent'
import {
    guildVoiceState,
    voiceStatesStore,
} from '../../../../stores/voiceStates'
import { openProfileSheet } from '../../../userProfile/openProfileSheet'
import { useMirrorOwnCamera } from '../../cameras'
import { LiveTag } from '../../rows/LiveTag'
import { useShownVideo } from '../../useShownVideo'
import { HIDDEN_SCALE, LEAVE_DROP } from './GridCard'
import { ParticipantLabel } from './ParticipantLabel'
import { useParticipantName } from './useParticipantName'
import type { FocusTarget, PanelFocus } from './usePanelFocus'

/** The focused camera or stream over the grid. Tapping it puts it back in its tile, a long press opens the profile. */
export function FocusedVideo({
    focus,
    guildId,
}: {
    focus: PanelFocus
    guildId: string | null
}) {
    if (!focus.target) return null
    return <Focused focus={focus} target={focus.target} guildId={guildId} />
}

/**
 * Returns the focused video's frame: from its tile's frame to the whole grid by `progress`. While `ending`, it fades,
 * shrinks and sinks like GridCard's leaving card, then calls `ended`.
 */
function useFocusedFrame(focus: PanelFocus) {
    const { from, area, progress, ending, ended } = focus
    const frame = useAnimatedStyle(() => {
        const rect = from.get()
        const p = progress.get()
        const top = interpolate(p, [0, 1], [rect.y, area.y])
        const height = interpolate(p, [0, 1], [rect.height, area.height])
        return {
            left: interpolate(p, [0, 1], [rect.x, area.x]),
            // `progress` stands still while ending, so the sink starts once.
            top: ending
                ? withSpring(
                      top + height * LEAVE_DROP,
                      VOICE_PANEL_LAYOUT_SPRING,
                  )
                : top,
            width: interpolate(p, [0, 1], [rect.width, area.width]),
            height,
        }
    })
    // A style of its own, with no shared values: it only changes with `ending`.
    const exit = useAnimatedStyle(() => ({
        opacity: withTiming(
            ending ? 0 : 1,
            VOICE_CARD_OPACITY_TIMING,
            finished => {
                'worklet'
                if (finished && ending) scheduleOnRN(ended)
            },
        ),
        transform: [
            {
                scale: withSpring(
                    ending ? HIDDEN_SCALE : 1,
                    VOICE_CARD_SCALE_SPRING,
                ),
            },
        ],
    }))
    return [frame, exit]
}

function Focused({
    focus,
    target,
    guildId,
}: {
    focus: PanelFocus
    target: FocusTarget
    guildId: string | null
}) {
    const session = useSession()
    const name = useParticipantName(target.userId, guildId)
    const { area } = focus
    const stream = target.kind === 'stream'
    // A camera's pill carries the mute and deafen marks, as in its tile.
    const voice = useSessionStore(voiceStatesStore, state =>
        stream ? undefined : guildVoiceState(state, guildId, target.userId),
    )
    const mirrorOwn = useMirrorOwnCamera()
    useShownVideo({
        context: stream ? 'stream' : 'default',
        userId: target.userId,
        shown: stream || target.userId !== session.userId,
        width: area.width,
        height: area.height,
        focused: true,
    })
    const frameStyle = useFocusedFrame(focus)
    const openProfile = () =>
        openProfileSheet(session, target.userId, guildId ?? undefined)
    return (
        <Animated.View
            pointerEvents={focus.ending ? 'none' : 'auto'}
            style={[styles.frame(stream), frameStyle]}
        >
            {/* Opaque: the grid's tile under the frame must not show through the contained video's bars. */}
            {!stream && <View style={styles.tile} />}
            <VideoView
                context={stream ? 'stream' : 'default'}
                userId={target.userId}
                // Our front camera is mirrored, as in its tile.
                mirror={
                    !stream && target.userId === session.userId && mirrorOwn
                }
                // VoicePanelVideoRenderer: a focused stream fits, a camera covers when its orientation matches.
                // Shrinking back, it takes its tile's fit, so the swap to the tile shows no change.
                fit={stream ? 'contain' : focus.closing ? 'cover' : 'camera'}
                style={styles.fill}
            />
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={name}
                onPress={focus.close}
                // VoicePanelCard onLongPress: the profile, focused or not.
                onLongPress={openProfile}
                style={styles.fill}
            />
            {stream && (
                <View style={styles.tag}>
                    <LiveTag />
                </View>
            )}
            <ParticipantLabel name={name} voice={voice} onPress={openProfile} />
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    frame: (stream: boolean) => ({
        position: 'absolute',
        overflow: 'hidden',
        borderRadius: theme.radii.lg,
        backgroundColor: stream
            ? theme.colors.BLACK
            : theme.colors.MOBILE_VOICE_PANEL_BACKGROUND,
    }),
    // The tile's translucent colour over the panel's, as a grid card shows it.
    tile: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.VOICE_VIDEO_VIDEO_TILE_BACKGROUND,
    },
    fill: { ...StyleSheet.absoluteFillObject },
    tag: {
        position: 'absolute',
        top: theme.space.PX_8,
        left: theme.space.PX_8,
    },
}))
