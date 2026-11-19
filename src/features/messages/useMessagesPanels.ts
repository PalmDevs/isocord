import { createContext, use } from 'react'
import type { ChatPanelsApi } from '../chat/ChatPanels'

export const MessagesPanelsContext = createContext<ChatPanelsApi | null>(null)

export function useMessagesPanels(): ChatPanelsApi {
    const api = use(MessagesPanelsContext)
    if (!api)
        throw new Error('useMessagesPanels must be used inside MessagesPanels')
    return api
}
