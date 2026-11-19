import { MessageType } from '../../../../core/discord/messages'
import { snowflakeFromTimestamp } from '../../../../core/discord/snowflake'
import { MINUTE } from '../../../../core/time'
import { ALICE, ChannelId, GUILD_ID } from './world'
import type { Message } from '../../../../stores/readStates'
import type { User } from '../../../../stores/users'
import type { RichMessage } from '../../../chat/rows/rich'

/** A sample message: the store's `Message` with the fields the API sends that it leaves out. */
export type FixtureMessage = RichMessage

/** What a sample says. The id, time, channel and author (Alice) are filled in by `sequence`. */
export interface Sample
    extends Partial<Omit<FixtureMessage, 'id' | 'channel_id' | 'author'>> {
    author?: User
    channel_id?: string
    /** Minutes after the previous sample. Over 7 starts a new group (a new header). Default 1. */
    gapMinutes?: number
}

/** The day of the history each domain owns. A new domain takes the next number. */
export const Day = {
    TEXT: 0,
    MEDIA: 1,
    EMBEDS: 2,
    EXPRESSION: 3,
    REPLIES: 4,
    SYSTEM: 5,
    COMPONENTS: 6,
    POLLS: 7,
    THREADS: 8,
} as const

/** The fixed start of the showcase's history: noon UTC, 1 March 2026. */
const HISTORY_START = Date.UTC(2026, 2, 1, 12)
const DAY_MINUTES = 24 * 60

/** The ISO time of a minute offset from the start of a day of the showcase's history. */
const isoAt = (day: number, minute: number) =>
    new Date(
        HISTORY_START + (day * DAY_MINUTES + minute) * MINUTE,
    ).toISOString()

/**
 * Turns samples into messages, oldest first. Each domain owns one `day`, so the date divider names the section and
 * ids never collide. Ids and times come from the position only, so a join message's welcome line stays the same.
 * `startMinute` lets a second call in a day (replies to the first) come after it.
 */
export function sequence(
    day: number,
    samples: Sample[],
    startMinute = 0,
): FixtureMessage[] {
    let minute = startMinute
    return samples.map(({ gapMinutes = 1, ...sample }) => {
        minute += gapMinutes
        return message(day, minute, sample)
    })
}

/** Builds one message at a minute of a day, for one that another sample refers to. */
export function message(
    day: number,
    minute: number,
    sample: Sample = {},
): FixtureMessage {
    const { gapMinutes: _ignored, ...fields } = sample
    const timestamp = isoAt(day, minute)
    return {
        guild_id: GUILD_ID,
        channel_id: ChannelId.GENERAL,
        author: ALICE,
        timestamp,
        ...fields,
        id: snowflakeFromTimestamp(Date.parse(timestamp)),
    }
}

/** Makes a message a reply to `target`, with the preview the API attaches. */
export const replyTo = (target: Message) => ({
    type: MessageType.REPLY,
    referenced_message: target,
    message_reference: {
        message_id: target.id,
        channel_id: target.channel_id,
        guild_id: GUILD_ID,
    },
})
