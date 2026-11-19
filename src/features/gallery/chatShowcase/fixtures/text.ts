import { Day, sequence } from './build'
import {
    ALICE,
    BOB,
    BOT,
    CARA,
    ChannelId,
    DAN,
    GUILD_ID,
    ME,
    RoleId,
} from './world'
import type { Sample } from './build'

/** Fixed unix time the timestamp markdown shows. */
const SAMPLE_UNIX_TIME = 1772366400

const grouping: Sample[] = [
    { content: 'Plain text from Alice. The next messages share her header.' },
    { content: 'A second message within seven minutes is grouped.' },
    { content: 'And a third.' },
    { author: BOB, content: 'A different author starts a new group.' },
    {
        author: ALICE,
        gapMinutes: 8,
        content: 'More than seven minutes later the header comes back.',
    },
    {
        author: CARA,
        content: 'Cara has a role with a gradient color.',
    },
    {
        author: DAN,
        content: 'Dan has no global name and wears a server tag.',
    },
    {
        author: BOT,
        content: 'Bots get a tag next to the name.',
    },
    {
        author: ALICE,
        content: 'This one was edited.',
        edited_timestamp: '2026-03-01T12:30:00.000Z',
    },
]

const markdown: Sample[] = [
    {
        content: [
            '**bold** *italic* ***both*** __underline__ ~~strike~~ `inline code`',
            '[A masked link](https://example.com) and a bare https://example.com link.',
        ].join('\n'),
    },
    {
        content: [
            '# Heading 1',
            '## Heading 2',
            '### Heading 3',
            '-# Subtext under the headings',
        ].join('\n'),
    },
    {
        content: [
            '- Unordered item',
            '- Another item',
            '  - Nested item',
            '1. First',
            '2. Second',
        ].join('\n'),
    },
    {
        content: [
            '```ts',
            'const answer: number = 42',
            'console.log("the answer is", answer)',
            '```',
            'Text between code blocks.',
            '```',
            'a block without a language',
            '```',
        ].join('\n'),
    },
    {
        content: [
            '> A block quote',
            '> over two lines',
            'Then normal text.',
            '>>> A quote that takes the rest',
            'of the message.',
        ].join('\n'),
    },
    {
        content:
            'A ||spoiler|| in a line, and a ||longer spoiler with **bold** inside||.',
    },
    {
        content: [
            `Short time <t:${SAMPLE_UNIX_TIME}:t>, long time <t:${SAMPLE_UNIX_TIME}:T>`,
            `short date <t:${SAMPLE_UNIX_TIME}:d>, long date <t:${SAMPLE_UNIX_TIME}:D>`,
            `date and time <t:${SAMPLE_UNIX_TIME}:f>, with weekday <t:${SAMPLE_UNIX_TIME}:F>`,
            `relative <t:${SAMPLE_UNIX_TIME}:R>`,
        ].join('\n'),
    },
]

const mentions: Sample[] = [
    {
        content: `User mentions: <@${BOB.id}> and <@${CARA.id}>, and a user the client does not know <@930000000000009999>.`,
        mentions: [BOB, CARA],
    },
    {
        content: `Role mentions: <@&${RoleId.MODERATOR}> <@&${RoleId.DESIGNER}> <@&${RoleId.GRADIENT}>`,
        mention_roles: [RoleId.MODERATOR, RoleId.DESIGNER, RoleId.GRADIENT],
    },
    {
        content: `Channel mentions: <#${ChannelId.GENERAL}> <#${ChannelId.ANNOUNCEMENTS}> <#${ChannelId.VOICE}> <#${ChannelId.STAGE}> <#${ChannelId.FORUM}> <#${ChannelId.THREAD}> <#${ChannelId.FORUM_POST}>`,
    },
    {
        content: `A channel in another server: <#${ChannelId.OTHER_GUILD_CHANNEL}>`,
    },
    {
        content: '@everyone and @here highlight the message.',
        mention_everyone: true,
    },
    {
        author: BOB,
        content: `A message that mentions you gets the mention highlight, <@${ME.id}>.`,
        mentions: [ME],
    },
    {
        content: [
            'Commands and navigation:',
            '</shrug:1000000000000000001>',
            `<id:customize> <id:browse> <id:guide>`,
            `https://discord.com/channels/${GUILD_ID}/${ChannelId.GENERAL}/${ChannelId.THREAD}`,
        ].join('\n'),
    },
]

/** Unicode emoji, custom emoji and jumbo emoji. The custom ids are fixed but unlikely to resolve. */
const emoji: Sample[] = [
    {
        content:
            'Unicode emoji \u{1F600} \u{1F680} \u{1F44D}\u{1F3FD} \u{1F3F3}\u{FE0F}\u{200D}\u{1F308} inline.',
    },
    {
        content:
            'Custom emoji <:custom:100000000000000001> and animated <a:dance:100000000000000002> inline.',
    },
    { content: '\u{1F600}' },
    { content: '\u{1F600}\u{1F680}\u{1F44D}' },
    { content: '<:custom:100000000000000001> <a:dance:100000000000000002>' },
    { content: 'Not jumbo: \u{1F600}\u{1F680} with text.' },
]

export const textMessages = [
    ...sequence(Day.TEXT, grouping),
    ...sequence(Day.TEXT, markdown, 60),
    ...sequence(Day.TEXT, mentions, 120),
    ...sequence(Day.TEXT, emoji, 180),
]
