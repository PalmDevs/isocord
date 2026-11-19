import { createContext } from 'react'
import type { Message } from '../../stores/readStates'

/** What the share screen hands its composer's preview panel. */
export interface SharePreviewValue {
    /** The message being forwarded. A share has no preview of its own: its files are the composer's. */
    message?: Message
    /** Picked places where slowmode holds the user, which the added text skips. */
    slowmodeNames: string[]
}

export const SharePreviewContext = createContext<SharePreviewValue | null>(null)
