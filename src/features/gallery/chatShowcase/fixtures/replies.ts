import {
    MESSAGE_REFERENCE_FORWARD,
    MessageType,
} from '../../../../core/discord/messages'
import { Day, message, replyTo, sequence } from './build'
import { waveSticker } from './expression'
import { landscapeImage } from './media'
import {
    ALICE,
    BOB,
    CARA,
    ChannelId,
    GUILD_ID,
    ME,
    OTHER_GUILD_ID,
} from './world'
import type { FixtureMessage } from './build'

/** Replies in the chat start this many minutes into the day, after the messages they answer. */
const REPLIES_START = 60

const question = message(Day.REPLIES, 1, {
    author: BOB,
    content: 'Which color should the new button be?',
})
const longText = message(Day.REPLIES, 9, {
    author: CARA,
    content:
        'A very long message that the reply preview has to cut: lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
})
const withImage = message(Day.REPLIES, 17, {
    author: BOB,
    attachments: [landscapeImage],
})
const withSticker = message(Day.REPLIES, 25, {
    author: CARA,
    sticker_items: [waveSticker],
})
const withMarkdown = message(Day.REPLIES, 33, {
    content: '**Markdown** and `code` in a preview.',
})

/** The channel the forwards come from. */
const FORWARD_SOURCE = ChannelId.ANNOUNCEMENTS

const forwardedAt = '2026-02-20T09:00:00.000Z'

const forward = (
    reference: { channel_id: string; guild_id: string },
    snapshot: NonNullable<
        FixtureMessage['message_snapshots']
    >[number]['message'],
) => ({
    content: '',
    message_reference: {
        type: MESSAGE_REFERENCE_FORWARD,
        message_id: '940000000000000001',
        ...reference,
    },
    message_snapshots: [{ message: { timestamp: forwardedAt, ...snapshot } }],
})

const replies = sequence(
    Day.REPLIES,
    [
        {
            author: ALICE,
            content: 'Blue, to match the rest.',
            ...replyTo(question),
        },
        {
            author: ME,
            content: 'A reply to a long message.',
            ...replyTo(longText),
        },
        { content: 'A reply to an image.', ...replyTo(withImage) },
        { content: 'A reply to a sticker.', ...replyTo(withSticker) },
        {
            author: BOB,
            content: 'A reply that pings the author.',
            mentions: [ALICE],
            ...replyTo(withMarkdown),
        },
        {
            author: CARA,
            content: 'A reply to a message that was deleted.',
            type: MessageType.REPLY,
            referenced_message: null,
            message_reference: {
                message_id: '940000000000000002',
                channel_id: ChannelId.GENERAL,
            },
        },
        {
            author: CARA,
            content: 'A reply to a message that did not load.',
            type: MessageType.REPLY,
            message_reference: {
                message_id: '940000000000000003',
                channel_id: ChannelId.GENERAL,
            },
        },
        {
            gapMinutes: 8,
            author: BOB,
            content: 'A reply with edit.',
            edited_timestamp: '2026-03-05T12:50:00.000Z',
            ...replyTo(question),
        },
        {
            gapMinutes: 8,
            ...forward(
                { channel_id: FORWARD_SOURCE, guild_id: GUILD_ID },
                {
                    content:
                        'A forwarded message from another channel of this server.',
                },
            ),
        },
        {
            ...forward(
                {
                    channel_id: ChannelId.OTHER_GUILD_CHANNEL,
                    guild_id: OTHER_GUILD_ID,
                },
                { content: 'A forward from another server names the server.' },
            ),
        },
        {
            ...forward(
                { channel_id: FORWARD_SOURCE, guild_id: GUILD_ID },
                {
                    content: 'A forward with media.',
                    attachments: [landscapeImage],
                },
            ),
        },
    ],
    REPLIES_START,
)

export const replyMessages = [
    question,
    longText,
    withImage,
    withSticker,
    withMarkdown,
    ...replies,
]
