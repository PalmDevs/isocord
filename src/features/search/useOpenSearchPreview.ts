import { createContext, use } from 'react'

/** Opens a search result in the preview of the search it is in (useOnPressMessageItem → SEARCH_CHAT_PREVIEW). */
export const SearchPreviewContext = createContext<
    (channelId: string, messageId: string) => void
>(() => {})

export const useOpenSearchPreview = () => use(SearchPreviewContext)
