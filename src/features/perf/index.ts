import { PerfOverlay } from './PerfOverlay'
import { PerfScreen } from './PerfScreen'
import type { Feature } from '../../core/feature'

/** The in-app perf monitor: span timings, frame stats and an overlay (Settings → Performance). */
export const perfFeature: Feature = {
    name: 'perf',
    screens: { perf: PerfScreen },
    overlays: { perf: PerfOverlay },
}
