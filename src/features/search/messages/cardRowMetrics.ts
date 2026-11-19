import {
    CARD_IMAGE_MAX_RATIO,
    CARD_IMAGE_MIN_RATIO,
    FILE_OR_LINK_IMAGE_RATIO,
} from './constants'
import { clampRatio } from './extract'

/** Height of a card below its thumbnail, as a placeholder (and to fill the screen with them). */
export const CARD_PLACEHOLDER_BODY_HEIGHT = 80

/** The proportions of a card's thumbnail, from the picture it has. */
export const cardRatio = (
    size: { width?: number | null; height?: number | null } | undefined,
) =>
    clampRatio(
        size,
        CARD_IMAGE_MIN_RATIO,
        CARD_IMAGE_MAX_RATIO,
        FILE_OR_LINK_IMAGE_RATIO,
    )
