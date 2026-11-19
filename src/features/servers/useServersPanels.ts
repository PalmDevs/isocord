import { createContext, use } from 'react'
import type { ChatPanelsApi } from '../chat/ChatPanels'

export const ServersPanelsContext = createContext<ChatPanelsApi | null>(null)

export function useServersPanels(): ChatPanelsApi {
    const api = use(ServersPanelsContext)
    if (!api)
        throw new Error('useServersPanels must be used inside ServersPanels')
    return api
}
