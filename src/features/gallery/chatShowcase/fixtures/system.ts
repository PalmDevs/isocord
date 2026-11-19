import { MessageFlag, MessageType } from '../../../../core/discord/messages'
import { Day, sequence } from './build'
import { ALICE, BOB, BOT, CARA, ChannelId, DAN, ME } from './world'
import type { Sample } from './build'

/** Types shown with the ordinary messages of other domains. */
const SHOWN_ELSEWHERE: ReadonlySet<number> = new Set([
    MessageType.DEFAULT,
    MessageType.REPLY,
    MessageType.CHAT_INPUT_COMMAND,
    MessageType.THREAD_STARTER_MESSAGE,
])

/** A call that has ended, as the API sends it: the user was in it. Ends 12 minutes after the sample's time. */
const CALL_ENDED = {
    participants: [ALICE.id, ME.id],
    ended_timestamp: '2026-03-06T12:30:00.000Z',
}

/** A call the user was not in. */
const CALL_MISSED = {
    participants: [ALICE.id],
    ended_timestamp: '2026-03-06T12:20:00.000Z',
}

/** A call still going: no end time yet. */
const CALL_ONGOING = { participants: [ALICE.id, BOB.id, CARA.id] }

/** The message a poll result and an AutoMod action point at. */
const POLL_REFERENCE = {
    message_id: '940000000000000020',
    channel_id: ChannelId.GENERAL,
}

/** A poll result embed's fields (parsePollResultSystemMessageEmbed). */
const pollResult = (fields: Record<string, string>) => [
    {
        type: 'poll_result',
        fields: Object.entries(fields).map(([name, value]) => ({
            name,
            value,
        })),
    },
]

/**
 * Hand-written samples by type. A type without one still gets an empty message below, so a new `MessageType`
 * shows up here by itself. Add a sample when a ported type needs a specific shape.
 */
const SAMPLES: Partial<Record<number, Sample[]>> = {
    [MessageType.RECIPIENT_ADD]: [
        { channel_id: ChannelId.GROUP_DM, content: '', mentions: [CARA] },
        { channel_id: ChannelId.THREAD, content: '', mentions: [CARA] },
    ],
    [MessageType.RECIPIENT_REMOVE]: [
        { channel_id: ChannelId.GROUP_DM, content: '', mentions: [CARA] },
        { channel_id: ChannelId.GROUP_DM, content: '', mentions: [ALICE] },
        { channel_id: ChannelId.THREAD, content: '', mentions: [CARA] },
    ],
    [MessageType.CALL]: [
        { channel_id: ChannelId.GROUP_DM, content: '', call: CALL_ENDED },
        { channel_id: ChannelId.GROUP_DM, content: '', call: CALL_MISSED },
        { channel_id: ChannelId.GROUP_DM, content: '', call: CALL_ONGOING },
    ],
    [MessageType.VOICE_SESSION]: [
        { content: '', call: { participants: [ALICE.id] } },
        {
            content: '',
            call: {
                ...CALL_ENDED,
                participants: [ALICE.id, BOB.id, CARA.id, DAN.id],
            },
        },
    ],
    [MessageType.CHANNEL_FOLLOW_ADD]: [
        { content: 'Isocord News #announcements' },
    ],
    [MessageType.GUILD_STREAM]: [
        { content: '', message_reference: { channel_id: ChannelId.VOICE } },
        { content: '', call: CALL_ENDED },
    ],
    [MessageType.STAGE_START]: [{ content: 'Town hall Q&A' }],
    [MessageType.STAGE_END]: [{ content: 'Town hall Q&A' }],
    [MessageType.STAGE_TOPIC]: [{ content: 'Roadmap questions' }],
    [MessageType.STAGE_SPEAKER]: [{ author: BOB, content: '' }],
    [MessageType.STAGE_RAISE_HAND]: [{ author: CARA, content: '' }],
    [MessageType.PURCHASE_NOTIFICATION]: [
        {
            author: BOB,
            content: '',
            purchase_notification: {
                type: 0,
                guild_product_purchase: {
                    listing_id: '950000000000000002',
                    product_name: 'Wallpaper pack',
                },
            },
        },
    ],
    [MessageType.CHANNEL_NAME_CHANGE]: [
        { content: 'new-channel-name' },
        { channel_id: ChannelId.GROUP_DM, content: 'Brunch crew' },
        { channel_id: ChannelId.GROUP_DM, content: '' },
        { channel_id: ChannelId.FORUM_POST, content: 'Dark mode idea (v2)' },
    ],
    [MessageType.CHANNEL_ICON_CHANGE]: [
        { content: '' },
        { channel_id: ChannelId.GROUP_DM, content: '' },
    ],
    [MessageType.CHANNEL_PINNED_MESSAGE]: [
        {
            content: '',
            message_reference: {
                message_id: '940000000000000010',
                channel_id: ChannelId.GENERAL,
            },
        },
        { content: '' },
    ],
    [MessageType.USER_JOIN]: [
        { author: BOB, content: '' },
        { author: CARA, content: '' },
        { author: DAN, content: '' },
        { author: BOT, content: '' },
    ],
    [MessageType.GUILD_BOOST]: [
        { author: BOB, content: '' },
        { author: BOB, content: '3' },
    ],
    [MessageType.GUILD_BOOST_TIER_1]: [
        { author: BOB, content: '' },
        { author: BOB, content: '2' },
    ],
    [MessageType.GUILD_BOOST_TIER_2]: [{ author: CARA, content: '' }],
    [MessageType.GUILD_BOOST_TIER_3]: [{ author: DAN, content: '' }],
    [MessageType.THREAD_CREATED]: [
        {
            content: 'Weekend plans',
            message_reference: { channel_id: ChannelId.THREAD },
        },
    ],
    [MessageType.AUTO_MODERATION_ACTION]: [
        {
            author: BOT,
            content: '',
            embeds: [
                {
                    type: 'auto_moderation_message',
                    description: 'A blocked message',
                    fields: [
                        { name: 'rule_name', value: 'No links' },
                        { name: 'channel_id', value: ChannelId.GENERAL },
                        { name: 'decision_outcome', value: 'blocked' },
                    ],
                },
            ],
        },
        {
            author: DAN,
            content: '',
            embeds: [
                {
                    type: 'auto_moderation_message',
                    description: 'buy cheap **stuff** here',
                    fields: [
                        { name: 'rule_name', value: 'Spam words' },
                        { name: 'keyword', value: 'cheap' },
                        { name: 'channel_id', value: ChannelId.GENERAL },
                        {
                            name: 'flagged_message_id',
                            value: POLL_REFERENCE.message_id,
                        },
                        { name: 'decision_outcome', value: 'flagged' },
                    ],
                },
            ],
        },
    ],
    [MessageType.POLL_RESULT]: [
        {
            content: '',
            message_reference: POLL_REFERENCE,
            embeds: pollResult({
                poll_question_text: 'Tea or coffee?',
                victor_answer_id: '1',
                victor_answer_text: 'Tea',
                victor_answer_emoji_name: '🍵',
                victor_answer_votes: '7',
                total_votes: '12',
            }),
        },
        {
            content: '',
            message_reference: POLL_REFERENCE,
            embeds: pollResult({
                poll_question_text: 'Cats or dogs?',
                victor_answer_votes: '3',
                total_votes: '6',
            }),
        },
        {
            content: '',
            message_reference: POLL_REFERENCE,
            embeds: pollResult({
                poll_question_text: 'Anyone up?',
                victor_answer_votes: '0',
                total_votes: '0',
            }),
        },
    ],
    [MessageType.ROLE_SUBSCRIPTION_PURCHASE]: [
        {
            author: BOB,
            content: '',
            role_subscription_data: {
                role_subscription_listing_id: '950000000000000001',
                tier_name: 'Supporters',
                total_months_subscribed: 3,
                is_renewal: false,
            },
        },
        {
            author: CARA,
            content: '',
            role_subscription_data: {
                role_subscription_listing_id: '950000000000000001',
                tier_name: 'Supporters',
                total_months_subscribed: 0,
                is_renewal: true,
            },
        },
    ],
    [MessageType.GUILD_APPLICATION_PREMIUM_SUBSCRIPTION]: [
        {
            author: BOB,
            content: '',
            application: { id: '960000000000000001', name: 'Helper Bot' },
        },
    ],
    [MessageType.PRIVATE_CHANNEL_INTEGRATION_ADDED]: [
        {
            channel_id: ChannelId.GROUP_DM,
            content: '',
            application: {
                id: '960000000000000001',
                name: 'Helper Bot',
                bot: BOT,
            },
        },
        { channel_id: ChannelId.GROUP_DM, content: '' },
    ],
    [MessageType.PRIVATE_CHANNEL_INTEGRATION_REMOVED]: [
        {
            channel_id: ChannelId.GROUP_DM,
            content: '',
            application: { id: '960000000000000001', name: 'Helper Bot' },
        },
    ],
    [MessageType.GUILD_INCIDENT_ALERT_MODE_ENABLED]: [
        { author: ME, content: '2026-03-06T13:00:00.000Z' },
    ],
    [MessageType.GUILD_INCIDENT_ALERT_MODE_DISABLED]: [
        { author: ME, content: '' },
    ],
    [MessageType.GUILD_INCIDENT_REPORT_FALSE_ALARM]: [
        { author: ME, content: '' },
    ],
    [MessageType.GUILD_INCIDENT_REPORT_RAID]: [
        { author: ME, content: '', flags: MessageFlag.SUPPRESS_NOTIFICATIONS },
    ],
}

/** Every type with a name, in numeric order, except those the other domains show. */
const typeNames: Array<[string, number]> = Object.entries(MessageType)
    .filter(([, type]) => !SHOWN_ELSEWHERE.has(type))
    .sort(([, left], [, right]) => left - right)

/** The gap that breaks the header group, so each type starts with its author line. */
const GROUP_BREAK_MINUTES = 8

/** A subtext line that names the type the messages after it show, whatever they draw. */
const caption = (name: string, type: number): Sample => ({
    author: BOT,
    content: `-# ${name} (${type})`,
    gapMinutes: GROUP_BREAK_MINUTES,
})

const samples: Sample[] = typeNames.flatMap(([name, type]) => [
    caption(name, type),
    ...(SAMPLES[type] ?? [{ content: '' }]).map(
        (sample): Sample => ({
            gapMinutes: GROUP_BREAK_MINUTES,
            ...sample,
            type,
        }),
    ),
])

export const systemMessages = sequence(Day.SYSTEM, samples)
