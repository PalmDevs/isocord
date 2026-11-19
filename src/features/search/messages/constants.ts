// SearchConstants layout values.
export const SEARCH_LIST_SECTION_TOP_PADDING = 16
export const SEARCH_LIST_HORIZONTAL_PADDING = 16
export const FILES_OR_LINKS_GAP_WIDTH = 8
export const MEDIA_ITEM_GAP_WIDTH = 4
export const SEARCH_ROW_TAP_STATE_PADDING = 8
export const FILE_OR_LINK_IMAGE_RATIO = 0.72
export const FILE_OR_LINK_IMAGE_BUFFER = 50
/** The columns of the reference's grids: also the fewest the masonry layouts have. */
export const FILES_OR_LINKS_NUM_COLUMNS = 2
export const MEDIA_NUM_COLUMNS = 3
/**
 * Masonry columns (not in the reference, whose grids have a fixed 3 and 2 columns): the widest an item may be, so a
 * wider window adds columns, `max(minimum, ceil(width / max item width))`. 160 keeps media tiles at about 110 to 160
 * dp (3 columns up to 480 dp, 5 on an 800 dp tablet); 240 does the same for the cards (2 up to 480 dp, 4 at 800 dp).
 */
export const MEDIA_MAX_ITEM_WIDTH = 160
export const FILES_OR_LINKS_MAX_ITEM_WIDTH = 240
/** Height over width of a media tile: a picture's own, kept between a 2:1 panorama and a 4:7 portrait. */
export const MEDIA_MIN_RATIO = 0.5
export const MEDIA_MAX_RATIO = 1.75
/** The same for a card's thumbnail; FILE_OR_LINK_IMAGE_RATIO stands in for what has no picture. */
export const CARD_IMAGE_MIN_RATIO = 0.5
export const CARD_IMAGE_MAX_RATIO = 1.25
export const SEARCH_PINNED_MESSAGES_LINE_CLAMP = 10
export const SEARCH_MESSAGES_DEFAULT_LINE_CLAMP = 4
/** dp past which a result's body (text, media, embeds) is cut with a fade. Our own: the reference draws text only. */
export const RESULT_MAX_CONTENT_HEIGHT = 320
/** SEARCH_TEXT_INPUT_DEBOUNCE_TIME. */
export const SEARCH_TEXT_INPUT_DEBOUNCE_TIME = 500
