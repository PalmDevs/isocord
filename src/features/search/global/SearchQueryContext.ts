import { createContext, use } from 'react'

/** SearchQueryStore: lets a page of the global search put text in the search bar (a tapped recent search). */
export const SearchQueryContext = createContext<(text: string) => void>(
    () => {},
)

export const useSetSearchQuery = () => use(SearchQueryContext)
