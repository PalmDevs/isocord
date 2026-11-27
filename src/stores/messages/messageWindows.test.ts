/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { stubNativeModules } from '../../features/chat/rows/nativeStubs'
import type { Session } from '../../core/session'
import type { Message } from '../readStates'
import type { MessagesState } from './messageTypes'

await stubNativeModules()
const { addPendingMessage, messagesStore, setAtBottom } = await import(
    './messages'
)
const { jumpToMessage, loadMessages } = await import('./messageWindows')

const CHANNEL = 'channel'
const author = { id: 'author', username: 'author' } as Message['author']
const message = (id: number): Message => ({
    id: String(id),
    channel_id: CHANNEL,
    author,
})
/** Messages `from` to `to`, newest first. */
const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => message(to - index))

type Query = { limit: number; before?: string; around?: string }

/** A messages store wired to a gateway and REST API that answer with `answer`. */
function chat(
    answer: (query: Query) => Message[] | Promise<Message[]> = () => [],
) {
    const handlers = new Map<string, (event: unknown) => void>()
    const requests: Query[] = []
    const users = { getState: () => ({ upsert: () => {} }) }
    let store: ReturnType<typeof messagesStore.create> | undefined
    const session = {
        userId: 'me',
        gateway: {
            dispatch: {
                on: (type: string, handler: (event: unknown) => void) =>
                    handlers.set(type, handler),
            },
        },
        rest: {
            get: async (_path: string, { query }: { query: Query }) => {
                requests.push(query)
                return answer(query)
            },
        },
        get: (definition: unknown) =>
            definition === messagesStore ? store : users,
    } as unknown as Session
    store = messagesStore.create(session)
    const channel = () => store?.getState().channels[CHANNEL]
    const loaded = (
        messages: Message[],
        hasMore = false,
        hasMoreAfter = false,
    ) =>
        store?.setState({
            channels: {
                [CHANNEL]: {
                    messages,
                    hasMore,
                    hasMoreAfter,
                    loading: false,
                    error: false,
                },
            },
        } satisfies Partial<MessagesState>)
    const receive = (id: number) =>
        handlers.get('MESSAGE_CREATE')?.(message(id))
    return { session, requests, channel, loaded, receive }
}

test('a new message at the bottom drops the oldest past 100, which load again', () => {
    const { channel, loaded, receive } = chat()
    loaded(range(1, 100))
    receive(101)
    expect(channel()?.messages.length).toBe(100)
    expect(channel()?.messages[0]?.id).toBe('101')
    expect(channel()?.messages.at(-1)?.id).toBe('2')
    expect(channel()?.hasMore).toBe(true)
})

test('away from the bottom, a new message keeps every loaded one', () => {
    const { session, channel, loaded, receive } = chat()
    loaded(range(1, 100))
    setAtBottom(session, CHANNEL, false)
    receive(101)
    expect(channel()?.messages.length).toBe(101)
    expect(channel()?.hasMore).toBe(false)
    // Back at the bottom: the next one trims again.
    setAtBottom(session, CHANNEL, true)
    receive(102)
    expect(channel()?.messages.length).toBe(100)
    expect(channel()?.messages.at(-1)?.id).toBe('3')
})

test('a message being sent at the bottom trims the oldest too', () => {
    const { session, channel, loaded } = chat()
    loaded(range(1, 100))
    addPendingMessage(session, { ...message(101), nonce: '101' })
    expect(channel()?.messages.length).toBe(100)
    expect(channel()?.messages[0]?.state).toBe('sending')
    expect(channel()?.hasMore).toBe(true)
})

test('opening a chat asks for one page of 25, without prefetching the next', async () => {
    const { session, requests, channel } = chat(() => range(1, 25))
    await loadMessages(session, CHANNEL)
    await Promise.resolve()
    expect(requests).toEqual([{ limit: 25, before: undefined }])
    expect(channel()?.hasMore).toBe(true)
})

test('a jump knows which sides have more, as the reference counts them', async () => {
    // 25 back, the target with 13 older and 11 newer: the reference still expects newer ones.
    const { session, channel } = chat(() => range(1, 25))
    expect(await jumpToMessage(session, CHANNEL, '14')).toBe('loaded')
    expect(channel()?.hasMore).toBe(true)
    expect(channel()?.hasMoreAfter).toBe(true)
    // 11 older: none before it are expected.
    const short = chat(() => range(1, 25))
    await jumpToMessage(short.session, CHANNEL, '12')
    expect(short.channel()?.hasMore).toBe(false)
    expect(short.channel()?.hasMoreAfter).toBe(true)
    // 10 newer: the page did not fill that side.
    const recent = chat(() => range(1, 25))
    await jumpToMessage(recent.session, CHANNEL, '15')
    expect(recent.channel()?.hasMoreAfter).toBe(false)
})

test('an older page that a trim overtook is not merged across the gap', async () => {
    let respond = (_page: Message[]) => {}
    const { session, channel, loaded, receive } = chat(
        () =>
            new Promise(resolve => {
                respond = resolve
            }),
    )
    loaded(range(26, 125), true)
    const loading = loadMessages(session, CHANNEL, true)
    // The user went back to the bottom while the page was on its way.
    receive(126)
    respond(range(1, 25))
    await loading
    expect(channel()?.messages.length).toBe(100)
    expect(channel()?.messages.at(-1)?.id).toBe('27')
    expect(channel()?.loading).toBe(false)
    expect(channel()?.hasMore).toBe(true)
})

test('a window jumped to ignores new messages', () => {
    const { channel, loaded, receive } = chat()
    loaded(range(1, 10), true, true)
    const detached = channel()
    receive(11)
    expect(channel()).toBe(detached)
})

test('a refresh drops the newest message when the server no longer has it', async () => {
    let respond = (_page: Message[]) => {}
    const { session, channel, loaded, receive } = chat(
        () =>
            new Promise(resolve => {
                respond = resolve
            }),
    )
    // Message 11 was deleted while its MESSAGE_DELETE could not arrive.
    loaded(range(1, 11))
    session.get(messagesStore).setState(state => ({
        channels: {
            [CHANNEL]: { ...state.channels[CHANNEL]!, stale: true },
        },
    }))
    const loading = loadMessages(session, CHANNEL)
    // Arrived over the gateway while the page was on its way.
    receive(12)
    respond(range(1, 10))
    await loading
    expect(
        channel()
            ?.messages.map(message => message.id)
            .slice(0, 2),
    ).toEqual(['12', '10'])
})
