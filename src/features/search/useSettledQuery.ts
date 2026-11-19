import { useEffect, useState } from 'react'
import { SEARCH_TEXT_INPUT_DEBOUNCE_TIME } from './messages/constants'

/**
 * The query as SearchQueryStore holds it: an empty one at once, otherwise once the typing has paused for
 * SEARCH_TEXT_INPUT_DEBOUNCE_TIME.
 */
export function useSettledQuery(query: string): string {
    const [settled, setSettled] = useState(query)
    useEffect(() => {
        if (query === '') {
            setSettled('')
            return
        }
        const timer = setTimeout(
            () => setSettled(query),
            SEARCH_TEXT_INPUT_DEBOUNCE_TIME,
        )
        return () => clearTimeout(timer)
    }, [query])
    return settled
}
