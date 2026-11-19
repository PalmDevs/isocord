import { DebugLogsScreen } from './DebugLogsScreen'
import type { Feature } from '../../core/feature'

/** Settings → Developer Settings → Logs: the app's log buffer (`core/log.ts`). */
export const debugLogsFeature: Feature = {
    name: 'debugLogs',
    screens: { debugLogs: DebugLogsScreen },
}
