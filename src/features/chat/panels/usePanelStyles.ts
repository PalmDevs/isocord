import { useState } from 'react'
import {
    Extrapolation,
    interpolate,
    useAnimatedReaction,
    useAnimatedStyle,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { panelBackStyle } from '../../../design/components/overlays/usePanelBackPreview'
import type { SharedValue } from 'react-native-reanimated'
import type { PanelBackPreview } from '../../../design/components/overlays/usePanelBackPreview'

const SCRIM_OPACITY = 0.5

export function scrimOpacity(x: SharedValue<number>, width: number) {
    'worklet'
    return interpolate(
        x.get(),
        [width, 0],
        [0, SCRIM_OPACITY],
        Extrapolation.CLAMP,
    )
}

interface PanelXs {
    chat: SharedValue<number>
    details: SharedValue<number>
    stack: SharedValue<number>[]
    create: SharedValue<number>
}

/**
 * Animated styles of the layers. Layers that are fully covered draw nothing (opacity 0, which HWUI skips)
 * only while nothing moves: a drag shows them again from its first frame, before anything has moved, and a
 * slide away (back, a tap) moves the cover in the same frame that shows them.
 */
export function usePanelStyles(
    width: number,
    dragging: SharedValue<boolean>,
    { layer, offset }: PanelBackPreview,
    xs: PanelXs,
) {
    const { chat, details, stack, create } = xs
    // The tab under the chat, or under the details opened over it (the server header's search).
    const children = useAnimatedStyle(() => ({
        opacity:
            !dragging.get() &&
            offset.get() === 0 &&
            (chat.get() === 0 || details.get() === 0)
                ? 0
                : 1,
    }))
    // Copied to React state for the tab's own animations (the animated server banner).
    const [listCovered, setListCovered] = useState(false)
    useAnimatedReaction(
        () =>
            !dragging.get() &&
            offset.get() === 0 &&
            (chat.get() === 0 || details.get() === 0),
        (covered, previous) => {
            if (covered !== previous) scheduleOnRN(setListCovered, covered)
        },
    )
    // The chat under the details, the stacked chats or the thread creation.
    const chatStyle = useAnimatedStyle(() => {
        let stackCovered = false
        for (let i = 0; i < stack.length; i++) {
            if (stack[i]!.get() === 0) {
                stackCovered = true
                break
            }
        }
        return {
            ...panelBackStyle(
                chat.get(),
                layer.get() === 'chat' ? offset.get() : 0,
            ),
            opacity:
                !dragging.get() &&
                offset.get() === 0 &&
                (details.get() === 0 || stackCovered || create.get() === 0)
                    ? 0
                    : 1,
        }
    })
    const detailsStyle = useAnimatedStyle(() =>
        panelBackStyle(
            details.get(),
            layer.get() === 'details' ? offset.get() : 0,
        ),
    )
    // The thread creation under the details. The stacked chat under it keeps drawing: a created thread's chat draws
    // there before the creation panel goes.
    const createStyle = useAnimatedStyle(() => ({
        ...panelBackStyle(
            create.get(),
            layer.get() === 'create' ? offset.get() : 0,
        ),
        opacity:
            !dragging.get() && offset.get() === 0 && details.get() === 0
                ? 0
                : 1,
    }))
    const chatScrim = useAnimatedStyle(() => ({
        opacity: scrimOpacity(chat, width),
    }))
    const detailsScrim = useAnimatedStyle(() => ({
        opacity: scrimOpacity(details, width),
    }))
    const createScrim = useAnimatedStyle(() => ({
        opacity: scrimOpacity(create, width),
    }))
    return {
        listCovered,
        children,
        chat: chatStyle,
        details: detailsStyle,
        create: createStyle,
        scrims: {
            chat: chatScrim,
            details: detailsScrim,
            create: createScrim,
        },
    }
}

export type PanelStyles = ReturnType<typeof usePanelStyles>
