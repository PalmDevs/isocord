import { ChatPanels } from '../chat/ChatPanels'
import { MessagesPanelsContext } from './useMessagesPanels'
import type { ReactNode } from 'react'

/** Chat panel of the Messages tab: the conversation last opened from the list. */
export function MessagesPanels({ children }: { children: ReactNode }) {
    return <ChatPanels context={MessagesPanelsContext}>{children}</ChatPanels>
}
