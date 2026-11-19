import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { isRecording, recordSpan } from '../../core/trace'
import { Text } from '../../design/components/Text'
import { usePerfStore } from './store'

/** A frame gap this long means the JS thread was busy; it's recorded as a span. */
const JS_STALL_MS = 100
/** Longer gaps are the app being in the background, where frames stop, not a stall. */
const BACKGROUND_GAP_MS = 3000

/** JS frames per second, counted like the reference's JSFPSMonitor: requestAnimationFrame callbacks per 1s window. */
function useJsFps(): number {
    const [fps, setFps] = useState(0)
    useEffect(() => {
        let frame = 0
        let count = 0
        let windowStart = performance.now()
        let last = windowStart
        const loop = (now: number) => {
            const gap = now - last
            if (gap > BACKGROUND_GAP_MS) {
                count = 0
                windowStart = now
            } else if (gap > JS_STALL_MS && isRecording())
                recordSpan({
                    name: 'js stall',
                    start: last,
                    duration: gap,
                    thread: 'js',
                })
            last = now
            count++
            if (now - windowStart >= 1000) {
                setFps(Math.round((count * 1000) / (now - windowStart)))
                count = 0
                windowStart = now
            }
            frame = requestAnimationFrame(loop)
        }
        frame = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(frame)
    }, [])
    return fps
}

function Stats() {
    const jsFps = useJsFps()
    const uiFps = usePerfStore(state => state.uiFps)
    const jank = usePerfStore(state => state.jank)
    const worstMs = usePerfStore(state => Math.round(state.worstMs))
    const heap = usePerfStore(
        state =>
            `${Math.round(state.jsHeapMb)}/${Math.round(state.javaHeapMb)}/${Math.round(state.nativeHeapMb)}`,
    )
    return (
        <View style={styles.overlay} pointerEvents="none">
            <Text
                variant="text-xxs/semibold"
                color="TEXT_STRONG"
                tabularNumbers
            >
                {`JS ${jsFps}  UI ${uiFps}  jank ${jank}  worst ${worstMs}ms`}
            </Text>
            <Text variant="text-xxs/semibold" color="TEXT_MUTED" tabularNumbers>
                {`heap JS/Java/native ${heap} MB`}
            </Text>
        </View>
    )
}

/** The perf monitor's always-on-top numbers (Settings → Performance → Show overlay). UI counts drawn frames, so it rests at 0 when nothing changes. */
export function PerfOverlay() {
    const overlay = usePerfStore(state => state.overlay)
    return overlay ? <Stats /> : null
}

const styles = StyleSheet.create((theme, runtime) => ({
    overlay: {
        position: 'absolute',
        top: runtime.insets.top,
        right: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_6,
        paddingVertical: theme.space.PX_4,
        borderRadius: theme.radii.xs,
        backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGHEST,
    },
}))
