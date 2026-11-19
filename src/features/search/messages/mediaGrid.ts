import {
    MEDIA_ITEM_GAP_WIDTH,
    MEDIA_NUM_COLUMNS,
    SEARCH_LIST_HORIZONTAL_PADDING,
} from './constants'

/**
 * The cell of a masonry item: the list gives it the width of its column and measures its height. The padding is
 * half the gap between neighbours on every side, so columns need not know their place.
 */
export const gapCell = (gap: number) => ({ padding: gap / 2 })

/** useSearchMediaSize: the side of a tile of the grid, three to the width of the list less its padding and gaps. */
export const gridMediaSize = (width: number) =>
    Math.floor(
        (width -
            2 * SEARCH_LIST_HORIZONTAL_PADDING -
            MEDIA_ITEM_GAP_WIDTH * (MEDIA_NUM_COLUMNS - 1)) /
            MEDIA_NUM_COLUMNS,
    )
