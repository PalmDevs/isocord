import { useWindowDimensions } from 'react-native'

/**
 * The widest a post card may be (our own, the reference's rows are full width): a phone in portrait gets one
 * column, a window from about 630 dp two, then one more for every 630 dp.
 */
const FORUM_MAX_CARD_WIDTH = 630

/** The columns of the post masonry, `max(1, ceil(width / FORUM_MAX_CARD_WIDTH))` as the search links page does, and a card's width. */
export function useForumColumns() {
    const { width } = useWindowDimensions()
    const columns = Math.max(1, Math.ceil(width / FORUM_MAX_CARD_WIDTH))
    return { columns, cardWidth: width / columns }
}
