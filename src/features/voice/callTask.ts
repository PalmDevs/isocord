import { AppRegistry } from 'react-native'
import native from '../../native/IsocordVoice'

/**
 * Registers the call's headless task. React Native runs JS timers in the background only while a headless task is
 * active, and the gateway's heartbeat needs them. The task never ends itself: the native call ends it on leave.
 */
export const registerCallTask = () => {
    if (!native) return
    AppRegistry.registerHeadlessTask(
        native.getConstants().callTaskKey,
        () => () => new Promise<void>(() => {}),
    )
}
