import { useEffect } from 'react'
import { PixelRatio } from 'react-native'
import { useSession } from '../../core/react'
import { FULL_QUALITY, shownKey, sinkStore, tileQuality } from './sinkWants'
import type { RtcContext } from '../../native/voiceTypes'

/**
 * Tells the sink wants that a video is on screen while `shown`. A tile asks for a quality that fits its size, a
 * `full` one (the watched stream) or the `focused` video for the best. Its entry goes when the video does, so a
 * collapsed panel asks for nothing.
 */
export function useShownVideo({
    context,
    userId,
    shown,
    width,
    height,
    full = false,
    focused = false,
}: {
    context: RtcContext
    userId: string
    shown: boolean
    width: number
    height: number
    full?: boolean
    focused?: boolean
}): void {
    const session = useSession()
    const pixels = Math.round(width * height * PixelRatio.get() ** 2)
    const quality = full || focused ? FULL_QUALITY : tileQuality(pixels)
    useEffect(() => {
        if (!shown) return
        const store = session.get(sinkStore)
        const video = { context, userId, quality, pixels }
        const key = shownKey(video, focused)
        store.setState(state => ({ shown: { ...state.shown, [key]: video } }))
        return () =>
            store.setState(state => {
                const { [key]: _gone, ...rest } = state.shown
                return { shown: rest }
            })
    }, [session, context, userId, shown, quality, pixels, focused])
}
