/// <reference types="bun" />
import { expect, setSystemTime, test } from 'bun:test'
import { stubNativeModules } from './nativeStubs'
import type { Role } from '../../../stores/guilds'
import type { ChannelMessages } from '../../../stores/messages/messageTypes'
import type { RowContext } from './buildRows'

// The clock tests move within one day, which a local midnight would split.
process.env.TZ = 'UTC'
await stubNativeModules()
const { buildRows } = await import('./buildRows')
const { encodeRows } = await import('./rowEncoder')
const fixtures = await import('../../gallery/chatShowcase/fixtures')
const { showcaseInteractions } = await import(
    '../../gallery/chatShowcase/fixtures/components'
)
const { showcaseChannels, showcaseGuilds, showcaseSession } = await import(
    '../../gallery/chatShowcase/session'
)

const NOW = new Date('2026-11-23T10:00:00Z')
const users = Object.fromEntries(fixtures.USERS.map(user => [user.id, user]))

/** The showcase's chat, as `useChatRows` builds it. */
const context = (changes: Partial<RowContext> = {}): RowContext => ({
    session: showcaseSession,
    guild: fixtures.GUILD,
    guilds: showcaseGuilds,
    members: fixtures.MEMBERS,
    users,
    channels: showcaseChannels,
    channel: showcaseChannels[fixtures.ChannelId.GENERAL],
    ackedId: fixtures.showcaseAckedId,
    canReact: () => true,
    swipeActions: () => 'reply',
    polls: {},
    interactions: showcaseInteractions,
    hiddenReason: () => undefined,
    ...changes,
})

/** The showcase history, newest first, as new message objects that no build has seen. */
const history = (): ChannelMessages => ({
    messages: [...fixtures.showcaseMessages].reverse().map(m => ({ ...m })),
    hasMore: false,
    loading: false,
    error: false,
})

/** The rows of a first build: nothing reused. */
const fresh = (state: ChannelMessages, changes?: Partial<RowContext>) =>
    encodeRows(
        buildRows(
            { ...state, messages: state.messages.map(m => ({ ...m })) },
            context(changes),
        ),
    )

test('reuses message rows when only unrelated users change', () => {
    setSystemTime(NOW)
    const state = history()
    const first = buildRows(state, context())
    const unrelated = { ...users, elsewhere: { ...fixtures.ALICE, id: '1' } }
    const second = buildRows(state, context({ users: unrelated }))
    const reused = second.filter(
        (row, index) => row.type === 'message' && row === first[index],
    )
    expect(reused.length).toBeGreaterThan(100)
    expect(encodeRows(second)).toBe(fresh(state, { users: unrelated }))
})

const { BOB, CARA, MEMBERS, GUILD, ChannelId, RoleId } = fixtures
const moderator = GUILD.roles[RoleId.MODERATOR] as Role
const renamedChannels = Object.fromEntries(
    Object.entries(showcaseChannels).map(([id, channel]) => [
        id,
        { ...channel, name: `${channel.name}-renamed` },
    ]),
)

/** Changes a row reads, each a step after a first build. */
const changes: Array<[string, Partial<RowContext>]> = [
    // Cara has no nick, so her name comes from the users store.
    [
        'an author renamed',
        { users: { ...users, [CARA.id]: { ...CARA, global_name: 'Carla' } } },
    ],
    [
        'a nick changed',
        { members: { ...MEMBERS, [BOB.id]: { roles: [], nick: 'Bobby' } } },
    ],
    [
        'a role recoloured',
        {
            guild: {
                ...GUILD,
                roles: {
                    ...GUILD.roles,
                    [RoleId.MODERATOR]: { ...moderator, color: 0x123456 },
                },
            },
        },
    ],
    ['channels renamed', { channels: renamedChannels }],
    ['thread maps given', { threads: {}, threadMessages: {} }],
    [
        'an author blocked',
        { hiddenReason: id => (id === BOB.id ? 'blocked' : undefined) },
    ],
    ['reactions not allowed', { canReact: () => false }],
    ['no swipe', { swipeActions: undefined }],
    [
        'another chat channel',
        { channel: showcaseChannels[ChannelId.FORUM_POST] },
    ],
]

for (const [name, change] of changes)
    test(`matches a first build after ${name}`, () => {
        setSystemTime(NOW)
        const state = history()
        buildRows(state, context())
        expect(encodeRows(buildRows(state, context(change)))).toBe(
            fresh(state, change),
        )
    })

const HOUR = 60 * 60 * 1000
/** When the last fixture message was sent. */
const lastSent = Date.parse(fixtures.showcaseMessages.at(-1)?.timestamp ?? '')

/** Builds at `start`, then at `later`, and checks the second build follows the clock. */
function expectClockFollowed(start: number, later: number) {
    setSystemTime(new Date(start))
    const state = history()
    const [newest] = state.messages
    // "a few seconds ago", then "2 hours ago".
    if (newest)
        state.messages.unshift({
            id: `${BigInt(newest.id) + 1n}`,
            channel_id: newest.channel_id,
            author: newest.author,
            timestamp: newest.timestamp,
            content: `<t:${Math.floor(lastSent / 1000)}:R>`,
        })
    const before = encodeRows(buildRows(state, context()))
    setSystemTime(new Date(later))
    const after = encodeRows(buildRows(state, context()))
    expect(after).not.toBe(before)
    expect(after).toBe(fresh(state))
}

test('follows the day: "Today" becomes "Yesterday"', () =>
    expectClockFollowed(lastSent, lastSent + 25 * HOUR))

test('follows the clock within a day: relative times and poll labels', () =>
    expectClockFollowed(lastSent, lastSent + 2 * HOUR))

test('reports unknown channels again when a row is reused', () => {
    setSystemTime(NOW)
    const state = history()
    const { [ChannelId.VOICE]: _, ...channels } = showcaseChannels
    const reported = () => {
        const unknown = new Set<string>()
        buildRows(
            state,
            context({ channels, onUnknownChannel: id => unknown.add(id) }),
        )
        return unknown
    }
    const first = reported()
    expect(first.has(ChannelId.VOICE)).toBe(true)
    expect(reported()).toEqual(first)
})
