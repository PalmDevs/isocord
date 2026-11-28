import './src/app/startupTrace'
import './src/app/env'
// Unistyles' StyleSheet.configure, before any module below creates a stylesheet (the overlay registers eagerly).
import './src/design/tokens'
import { AppRegistry } from 'react-native'
import { name as appName } from './app.json'
import { App } from './src/app/App'
import { endSection } from './src/core/trace'
import { registerCallTask } from './src/features/voice/callTask'
import { registerVoiceOverlay } from './src/features/voice/overlay/MobileVoiceOverlay'

endSection()
AppRegistry.registerComponent(appName, () => App)
registerCallTask()
registerVoiceOverlay()
