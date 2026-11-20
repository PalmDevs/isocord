import { createContext, useContext } from 'react'

/** What the sheet host tells a sheet about its place in the stack. */
export interface SheetContextValue {
    /** True while the sheet should animate out. */
    closing: boolean
    /** Asks the host to close this sheet (`hideActionSheet(key)`). */
    close: () => void
    /** Tells the host the exit animation has finished, so it can drop the sheet. */
    onClosed: () => void
}

export const NOOP = () => {}

/** Provided by SheetLayer around every open sheet. Outside one a sheet cannot be closed. */
export const SheetContext = createContext<SheetContextValue>({
    closing: false,
    close: NOOP,
    onClosed: NOOP,
})

/** Closes the sheet this component is rendered in. */
export function useCloseSheet(): () => void {
    return useContext(SheetContext).close
}
