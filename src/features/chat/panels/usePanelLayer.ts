import { useRef, useState } from 'react'
import { useSharedValue } from 'react-native-reanimated'

/**
 * Position and open state of one sliding panel. `x` is 0 when fully open and `width` when closed.
 * The ref holds the state for callbacks that run before the next render.
 */
export function usePanelLayer(width: number) {
    const x = useSharedValue(width)
    const [open, setOpen] = useState(false)
    const openRef = useRef(false)
    const setShown = (show: boolean) => {
        openRef.current = show
        setOpen(show)
    }
    return { x, open, openRef, setShown }
}

export type PanelLayer = ReturnType<typeof usePanelLayer>
