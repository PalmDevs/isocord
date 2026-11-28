import { AppRegistry, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native-unistyles'
import {
    activeSession,
    SessionContext,
    useSession,
    useSessionStore,
} from '../../../core/react'
import overlayNative, {
    componentName,
} from '../../../native/IsocordVoiceOverlay'
import { PIP_PADDING } from '../panel/dock/dockConstants'
import { VoicePip } from '../panel/dock/VoicePip'
import { requestPanel } from '../panel/panelRequest'
import { dismissPreJoin } from '../prejoin/preJoinStore'
import { rtcStore } from '../rtc'

/**
 * The call bubble's contents (OverlayVoiceBubble), drawn in native's overlay window: the in-app PIP on its card.
 * Native moves the window. React only handles the buttons. The session is the app's own, which the call keeps.
 */
function MobileVoiceOverlay() {
    const session = activeSession()
    if (!session) return null
    return (
        <GestureHandlerRootView style={styles.root}>
            <SessionContext value={session}>
                <OverlayPip />
            </SessionContext>
        </GestureHandlerRootView>
    )
}

/** The PIP of the current call. Its expand opens the app on the full panel (Open Discord, then the panel). */
function OverlayPip() {
    const session = useSession()
    const channelId = useSessionStore(rtcStore, state => state.channelId)
    if (!channelId) return null
    return (
        <View style={styles.card}>
            <VoicePip
                channelId={channelId}
                onPress={() => {
                    // The call takes the card back from another channel's pre-join.
                    dismissPreJoin(session)
                    requestPanel(session)
                    overlayNative.openApp()
                }}
            />
        </View>
    )
}

/** Registers the bubble's React root. Native starts it in its own surface when the bubble shows. */
export function registerVoiceOverlay(): void {
    AppRegistry.registerComponent(componentName, () => MobileVoiceOverlay)
}

const styles = StyleSheet.create(theme => ({
    // Sized by the PIP. Native measures the root unbounded and sizes the window to it.
    root: { alignSelf: 'flex-start' },
    // DockCard's PIP frame: its background, and corners concentric with the buttons'.
    card: {
        overflow: 'hidden',
        backgroundColor: theme.colors.MOBILE_VOICE_PANEL_BACKGROUND,
        borderRadius:
            theme.modules.button.BORDER_RADIUS + theme.space[PIP_PADDING],
    },
}))
