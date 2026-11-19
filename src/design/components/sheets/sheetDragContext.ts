import { createContext } from 'react'
import type { SharedValue } from 'react-native-reanimated'

/**
 * What a sheet gives the content inside it so a drag that starts there can move the sheet. Provided by the
 * design `BottomSheet` and by the composer's panel sheet; everything runs on the UI thread.
 */
export interface SheetDragApi {
    /** Height of the sheet on screen: 0 is closed, `max` is fully open. */
    height: SharedValue<number>
    max: number
    /** Settles the sheet after a drag let go at this speed (px/s, positive is down): snaps or closes it. */
    release: (velocityY: number) => void
}

export const SheetDragContext = createContext<SheetDragApi | null>(null)
