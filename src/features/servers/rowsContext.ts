import { createContext } from 'react'

/** What the rows need from the bar: the folders just opened, and a folder's servers being done closing. */
export const RowsContext = createContext<{
    opening: string[]
    onClosed: (folderId: string) => void
}>({ opening: [], onClosed: () => {} })
