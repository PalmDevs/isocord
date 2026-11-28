import { useEffect, useRef, useState } from 'react'
import {
    GestureDetector,
    GestureStateManager,
    useManualGesture,
} from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { useStore } from 'zustand'
import { useSession, useSessionStore } from '../../../core/react'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { useScreenReaderEnabled } from '../../../design/useScreenReaderEnabled'
import { t } from '../../../i18n'
import haptics from '../../../native/IsocordHaptics'
import native from '../../../native/IsocordVoice'
import { channelsStore } from '../../../stores/channels/channels'
import { useChannelPermissions } from '../../../stores/permissions'
import { setSelfDeaf, setSelfMute } from '../actions'
import { rtcStore } from '../rtc'
import { channelForcesPushToTalk } from '../settings/applyVoiceSettings'
import { voiceSettingsStore } from '../settings/voiceSettings'

/** Returns whether the call sends only while the button is held: the setting, or a channel without USE_VAD. */
export function usePushToTalk(channelId: string): boolean {
    const mode = useStore(voiceSettingsStore, state => state.inputMode)
    const guildId = useSessionStore(rtcStore, state => state.guildId)
    const type = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.type,
    )
    const permissions = useChannelPermissions(channelId)
    return (
        mode === 'pushToTalk' ||
        channelForcesPushToTalk(guildId, type, permissions)
    )
}

/**
 * Returns whether the button is held and the gesture that holds it. Pressing it while deafened undeafens, and
 * while muted unmutes, as PTTButton's `onPressIn` does. Both press and release give HapticUtils' IMPACT_MEDIUM.
 * The reference vibrates on press only.
 *
 * The finger owns the gesture from touch down: it activates at once, so GH cancels the dock, PIP and sheet pans
 * that have not activated yet. PTTButton does the same with a manually activated pan and a panel lock. It lets go
 * when the finger lifts or leaves the button (`shouldCancelWhenOutside`). The reference keeps holding outside.
 *
 * A screen reader can't hold a button, so with one on the gesture is off and a press toggles sending instead (ours,
 * the reference has no such mode).
 */
function usePushToTalkHold() {
    const screenReader = useScreenReaderEnabled()
    const session = useSession()
    const [held, setHeld] = useState(false)
    // The dock's and the PIP's buttons can both be mounted: only the held one releases.
    const holding = useRef(false)
    // Releases on unmount, like the reference's effect cleanup.
    useEffect(
        () => () => {
            if (holding.current) native?.setPushToTalk(false)
        },
        [],
    )
    const press = () => {
        if (holding.current) return
        const { selfMute, selfDeaf } = session.get(rtcStore).getState()
        if (selfDeaf) setSelfDeaf(session, false)
        else if (selfMute) setSelfMute(session, false)
        native?.setPushToTalk(true)
        holding.current = true
        setHeld(true)
        haptics.impactMedium()
    }
    const release = () => {
        if (!holding.current) return
        native?.setPushToTalk(false)
        holding.current = false
        setHeld(false)
        haptics.impactMedium()
    }
    const gesture = useManualGesture({
        enabled: !screenReader,
        shouldCancelWhenOutside: true,
        // The Pressable inside keeps its ripple.
        cancelsJSResponder: false,
        onTouchesDown: event => {
            'worklet'
            GestureStateManager.activate(event.handlerTag)
        },
        onTouchesUp: event => {
            'worklet'
            GestureStateManager.deactivate(event.handlerTag)
        },
        onActivate: () => {
            'worklet'
            scheduleOnRN(press)
        },
        onFinalize: () => {
            'worklet'
            scheduleOnRN(release)
        },
    })
    const toggle = () => (holding.current ? release() : press())
    return { held, gesture, toggle: screenReader ? toggle : undefined }
}

/**
 * VoicePanelMicButton's PTTButton: sends while held. It takes the mute button's place. `compact` is the PIP's: an
 * icon the size of the mute button, without the label.
 */
export function PushToTalkButton({ compact = false }: { compact?: boolean }) {
    const { held, gesture, toggle } = usePushToTalkHold()
    const color = held ? 'BLACK' : 'ICON_STRONG'
    return (
        <GestureDetector gesture={gesture}>
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={t('voice.pushToTalk')}
                accessibilityState={{ selected: held }}
                accessibilityHint={
                    toggle ? t('voice.pushToTalkToggleHint') : undefined
                }
                onPress={toggle}
                style={[
                    compact ? styles.compact : styles.wide,
                    held && styles.held,
                ]}
            >
                <Icon
                    name="MicrophoneIcon"
                    size={compact ? 'sm' : 'md'}
                    color={color}
                />
                {!compact && (
                    <Text variant="text-md/semibold" color={color}>
                        {t('voice.pushToTalk')}
                    </Text>
                )}
            </RipplePressable>
        </GestureDetector>
    )
}

const styles = StyleSheet.create(theme => ({
    // Its own row in the dock, a `lg` button across the full width.
    wide: {
        height: theme.space.PX_48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.PX_8,
        borderRadius: theme.modules.button.BORDER_RADIUS_LG,
        backgroundColor: theme.colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
    },
    // The PIP's `md` icon button, square like MuteButton.
    compact: {
        width: theme.space.PX_40,
        height: theme.space.PX_40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.modules.button.BORDER_RADIUS,
        backgroundColor: theme.colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
    },
    // VoicePanelStyles `iconBgSelected` and `iconFillSelected`.
    held: { backgroundColor: theme.colors.WHITE },
}))
