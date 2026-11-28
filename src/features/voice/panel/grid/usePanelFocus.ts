import { useEffect, useState } from 'react'
import {
    cancelAnimation,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { streamOwnerId } from '../../../../core/discord/streams'
import { useSession, useSessionStore } from '../../../../core/react'
import { VOICE_PANEL_LAYOUT_SPRING } from '../../../../design/tokens/motion'
import {
    guildVoiceState,
    voiceStatesStore,
} from '../../../../stores/voiceStates'
import { rtcStore } from '../../rtc'
import { streamsStore } from '../../streams'
import type { SharedValue } from 'react-native-reanimated'

/** A video the panel can show over its whole grid: a camera, or the stream we watch or own. */
export interface FocusTarget {
    kind: 'camera' | 'stream'
    userId: string
}

export interface Rect {
    x: number
    y: number
    width: number
    height: number
}

/** Returns the key of a target's tile in `PanelFocus.tiles`. */
export const focusKey = (target: FocusTarget) =>
    `${target.kind}:${target.userId}`

export interface PanelFocus {
    target: FocusTarget | null
    /** The focusable tiles' frames in the grid's content, by `focusKey`. The grid keeps them current. */
    tiles: SharedValue<Record<string, Rect>>
    /** How far the grid is scrolled. */
    scrollY: SharedValue<number>
    /** The tile's frame the focused video grows from and returns to. */
    from: SharedValue<Rect>
    /** The focused frame: the whole grid area. */
    area: Rect
    /** 0 in the tile, 1 over the whole grid. */
    progress: SharedValue<number>
    /** The video has finished growing and hides the whole grid, so the grid's videos may pause. */
    covered: boolean
    /** The video is shrinking back into its tile: it takes the tile's fit (VoicePanelVideoRenderer's unfocused cover). */
    closing: boolean
    /** The target ended and its tile left the grid: the video plays a leaving card's exit, then calls `ended`. */
    ending: boolean
    /** Lets the ended target go once its exit has played. */
    ended: () => void
    /** Grows the video out of its tile. */
    open: (target: FocusTarget) => void
    /** Shrinks the video back into its tile. */
    close: () => void
}

/**
 * Returns whether the focused video still exists: the camera is on, or the stream is still the one we have. `ended`
 * when its streamer stopped streaming: its tile is leaving, though it may last a render longer.
 */
function useTargetLive(
    target: FocusTarget | null,
): 'live' | 'closed' | 'ended' {
    const session = useSession()
    const camera = useSessionStore(rtcStore, state => {
        if (target?.kind !== 'camera') return true
        return target.userId === session.userId
            ? state.selfVideo
            : state.video.includes(target.userId)
    })
    const stream = useSessionStore(streamsStore, state => {
        if (target?.kind !== 'stream') return true
        return (
            state.streamKey !== null &&
            streamOwnerId(state.streamKey) === target.userId
        )
    })
    const guildId = useSessionStore(rtcStore, state => state.guildId)
    const streaming = useSessionStore(voiceStatesStore, state => {
        if (target?.kind !== 'stream' || target.userId === session.userId)
            return true
        return (
            guildVoiceState(state, guildId, target.userId)?.selfStream === true
        )
    })
    if (!streaming) return 'ended'
    return camera && stream ? 'live' : 'closed'
}

/** Returns the tile's frame on screen. A tile that left the grid has none, so the video keeps its last frame. */
function tileRect(
    tiles: SharedValue<Record<string, Rect>>,
    scrollY: SharedValue<number>,
    from: SharedValue<Rect>,
    of: FocusTarget,
): Rect {
    const tile = tiles.get()[focusKey(of)]
    if (!tile) return from.get()
    return { ...tile, y: tile.y - scrollY.get() }
}

/** Springs the focused video back into its tile, then lets the target go. */
function shrink(
    focus: Pick<PanelFocus, 'tiles' | 'scrollY' | 'from' | 'progress'>,
    target: FocusTarget,
    done: (target: null) => void,
) {
    focus.from.set(tileRect(focus.tiles, focus.scrollY, focus.from, target))
    focus.progress.set(
        withSpring(0, VOICE_PANEL_LAYOUT_SPRING, finished => {
            'worklet'
            if (finished) scheduleOnRN(done, null)
        }),
    )
}

/**
 * Returns the panel's focused video (VoicePanelUI's focused participant). Its frame springs from the tile to the
 * whole grid with LAYOUT_PHYSICS, as the reference's layout transition does, and back on close.
 */
export function usePanelFocus(area: Rect): PanelFocus {
    const [target, setTarget] = useState<FocusTarget | null>(null)
    const tiles = useSharedValue<Record<string, Rect>>({})
    const scrollY = useSharedValue(0)
    const from = useSharedValue<Rect>(area)
    const progress = useSharedValue(0)
    const [covered, setCovered] = useState(false)
    const [ending, setEnding] = useState(false)
    const [closing, setClosing] = useState(false)
    const live = useTargetLive(target)
    // A camera turned off shrinks back like a close, into its tile. A tile that left (a stream that ended) has
    // none: the video leaves as that card does (VoicePanelCard's YEETED state). The grid's effects ran first, so
    // `tiles` is current. An ended stream's tile can outlive it by a render, so it never shrinks into it.
    useEffect(() => {
        if (target === null || live === 'live') return
        setCovered(false)
        if (live === 'closed' && focusKey(target) in tiles.get()) {
            setClosing(true)
            shrink({ tiles, scrollY, from, progress }, target, setTarget)
        } else {
            // Leaves where it is: an unfinished growth would cover the grid again.
            cancelAnimation(progress)
            setEnding(true)
        }
    }, [target, live, tiles, scrollY, from, progress])
    return {
        target,
        tiles,
        scrollY,
        from,
        area,
        progress,
        covered,
        closing,
        ending,
        ended: () => {
            setEnding(false)
            setTarget(null)
        },
        open: next => {
            from.set(tileRect(tiles, scrollY, from, next))
            progress.set(0)
            progress.set(
                withSpring(1, VOICE_PANEL_LAYOUT_SPRING, finished => {
                    'worklet'
                    if (finished) scheduleOnRN(setCovered, true)
                }),
            )
            setEnding(false)
            setClosing(false)
            setTarget(next)
        },
        close: () => {
            if (!target || ending) return
            setCovered(false)
            setClosing(true)
            shrink({ tiles, scrollY, from, progress }, target, setTarget)
        },
    }
}
