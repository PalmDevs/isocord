import { StickerFormat } from '../../../../core/discord/expressionTypes'
import { Day, sequence } from './build'
import { BOB, CARA, ME } from './world'
import type { Reaction } from '../../../../stores/messages/messageTypes'

/** A sticker of Discord's own Wumpus pack. */
const WAVE_STICKER_ID = '749054660769218631'
export const waveSticker = {
    id: WAVE_STICKER_ID,
    name: 'Wave',
    format_type: StickerFormat.PNG,
}

const unicode = (name: string, count: number, me = false): Reaction => ({
    emoji: { id: null, name },
    count,
    me,
})
const custom = (
    name: string,
    id: string,
    count: number,
    me = false,
    animated = false,
): Reaction => ({
    emoji: { id, name, animated },
    count,
    me,
})

/** A reaction with super reactions: `burst` of `count` are super, in the colours the API sends. */
const withBurst = (
    name: string,
    normal: number,
    burst: number,
    colors: string[],
    me = false,
    meBurst = false,
): Reaction => ({
    emoji: { id: null, name },
    count: normal + burst,
    me,
    count_details: { normal, burst },
    me_burst: meBurst,
    burst_colors: colors,
})

/** Stickers and reactions. The custom emoji ids are fixed but unlikely to resolve. */
export const expressionMessages = sequence(Day.EXPRESSION, [
    {
        content: '',
        sticker_items: [waveSticker],
    },
    {
        content: 'A sticker with text.',
        sticker_items: [waveSticker],
    },
    {
        gapMinutes: 8,
        content: 'Reactions you did not make.',
        reactions: [
            unicode('\u{1F44D}', 3),
            unicode('\u{2764}\u{FE0F}', 12),
            unicode('\u{1F602}', 1),
        ],
    },
    {
        author: BOB,
        content: 'Reactions you made are highlighted.',
        reactions: [
            unicode('\u{1F44D}', 4, true),
            unicode('\u{1F680}', 2),
            custom('custom', '100000000000000001', 5, true),
            custom('dance', '100000000000000002', 1, false, true),
        ],
    },
    {
        author: CARA,
        content: 'Large counts.',
        reactions: [
            unicode('\u{1F525}', 1234),
            unicode('\u{1F389}', 99999, true),
        ],
    },
    {
        author: BOB,
        content: 'Super reactions get their own chip, in the emoji colours.',
        reactions: [
            withBurst(
                '\u{1F525}',
                2,
                3,
                ['#ff7a00', '#ffcc4d', '#f4900c'],
                false,
                true,
            ),
            withBurst('\u{1F49C}', 0, 1, ['#aa8ed6', '#744eaa']),
            withBurst('\u{1F440}', 4, 0, []),
        ],
    },
    {
        author: ME,
        content: 'A message with a sticker and reactions.',
        sticker_items: [waveSticker],
        reactions: [unicode('\u{1F44B}', 2)],
    },
])
