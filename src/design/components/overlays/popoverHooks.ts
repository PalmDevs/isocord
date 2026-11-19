import { createContext, useContext, useRef, useState } from 'react'
import type { HostInstance } from 'react-native'

/** Where the element a popover points at is on screen, in window coordinates. */
export interface AnchorRect {
    x: number
    y: number
    width: number
    height: number
}

/**
 * Tracks an element to anchor a popover to. Put `ref` on the element (with `collapsable={false}`),
 * call `open()` to measure it and show the popover while `anchor` is set, `clear()` to hide it.
 */
export function useAnchor() {
    const ref = useRef<HostInstance>(null)
    const [anchor, setAnchor] = useState<AnchorRect | null>(null)
    const open = (onMeasured?: () => void) => {
        ref.current?.measureInWindow((x, y, width, height) => {
            setAnchor({ x, y, width, height })
            onMeasured?.()
        })
    }
    const clear = () => setAnchor(null)
    return { ref, anchor, open, clear }
}

export interface PopoverContextValue {
    /** Animates the popover out, unmounts it, then runs `then`. */
    close: (then?: () => void) => void
}

export const PopoverContext = createContext<PopoverContextValue>({
    close: then => then?.(),
})

/** Closes the popover this component is rendered in, optionally running `then` once it has gone. */
export function usePopoverClose() {
    return useContext(PopoverContext).close
}
