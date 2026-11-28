import { useEffect, useState } from 'react'
import { withSpring } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { DOCK_MODE_SPRING } from '../../../../design/tokens/motion'
import type { DockMotion } from './useDockMotion'

export interface PreJoinMorph {
    /** The server whose pre-join the card still shows, null once it has turned into the call. */
    guildId: string | null
    /** The pre-join contents' measured height. */
    height: number
    onHeight: (height: number) => void
}

/**
 * Returns the card's pre-join state. While `guildId` is set the card shows that channel's pre-join. Once it clears
 * (we joined), `motion.preJoin` springs to 0 with the dock's mode physics: the frame shrinks to the docked card's
 * and the pre-join contents stay until it ends (PreJoinTransitioner's YEETED state, which the call's panel follows).
 */
export function usePreJoinMorph(
    motion: DockMotion,
    guildId: string | null,
): PreJoinMorph {
    const [shownGuildId, setShownGuildId] = useState(guildId)
    const [height, setHeight] = useState(0)
    if (guildId !== null && guildId !== shownGuildId) setShownGuildId(guildId)
    const preJoin = guildId !== null
    const { preJoin: progress, preJoinHeight } = motion
    useEffect(() => {
        progress.set(
            withSpring(preJoin ? 1 : 0, DOCK_MODE_SPRING, finished => {
                'worklet'
                if (finished && !preJoin) scheduleOnRN(setShownGuildId, null)
            }),
        )
    }, [progress, preJoin])
    return {
        guildId: shownGuildId,
        height,
        onHeight: next => {
            // The first size takes the frame at once. Later ones, such as a member joining, spring.
            preJoinHeight.set(
                height === 0 ? next : withSpring(next, DOCK_MODE_SPRING),
            )
            setHeight(next)
        },
    }
}
