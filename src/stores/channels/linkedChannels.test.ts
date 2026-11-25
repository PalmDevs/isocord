/// <reference types="bun" />
import { describe, expect, mock, test } from 'bun:test'
import { ApiError } from '../../core/api/rest'
import { ChannelType } from '../../core/discord/channelType'
import { Permission } from '../../core/discord/permissions'
import { stubNativeModules } from '../../features/chat/rows/nativeStubs'
import type { Session } from '../../core/session'
import type { Guild } from '../guilds'
import type { Channel } from './channels'

await stubNativeModules()
mock.module('expo-clipboard', () => ({ setStringAsync: async () => {} }))
mock.module('expo-web-browser', () => ({
    warmUpAsync: async () => {},
    openBrowserAsync: async () => {},
}))
const { channelsStore } = await import('./channels')
const { threadsStore } = await import('./threads')
const { guildsStore } = await import('../guilds')
const { holdLinkedChannel } = await import('./linkedChannels')
const { chatLink } = await import('../../features/chat/links/chatLink')
const { handleChatLink } = await import('../../features/chat/links/links')
const { useToastStore } = await import(
    '../../design/components/overlays/toastStore'
)

const ME = 'me'
const GUILD_ID = 'g1'

function makeGuild(
    everyone: bigint,
    roles: Record<string, bigint> = {},
): Guild {
    return {
        id: GUILD_ID,
        name: 'Guild',
        icon: null,
        banner: null,
        ownerId: 'owner',
        memberCount: 1,
        joinedAt: '',
        myRoles: Object.keys(roles),
        roles: {
            [GUILD_ID]: { id: GUILD_ID, permissions: String(everyone) },
            ...Object.fromEntries(
                Object.entries(roles).map(([id, perms]) => [
                    id,
                    { id, permissions: String(perms) },
                ]),
            ),
        },
        version: 1,
        pendingDeleteSync: false,
    }
}

function makeSession({
    channels = {},
    activeThreads = {},
    guilds = { [GUILD_ID]: makeGuild(Permission.VIEW_CHANNEL) },
    restGet,
}: {
    channels?: Record<string, Channel>
    activeThreads?: Record<string, Channel>
    guilds?: Record<string, Guild>
    restGet?: (path: string) => Promise<unknown>
}) {
    const held: Channel[] = []
    const chState = { channels }
    const channelsMock = {
        getState: () => chState,
        setState: (
            updater:
                | Partial<typeof chState>
                | ((s: typeof chState) => Partial<typeof chState>),
        ) => {
            const patch =
                typeof updater === 'function' ? updater(chState) : updater
            Object.assign(chState, patch)
            if (patch.channels) {
                for (const ch of Object.values(patch.channels)) {
                    if (!channels[ch.id]) held.push(ch)
                }
            }
        },
    }
    const threadsMock = { getState: () => ({ active: activeThreads }) }
    const guildsMock = { getState: () => ({ guilds }) }
    const session = {
        userId: ME,
        rest: {
            get: async (path: string) => {
                if (!restGet) throw new ApiError(403, 'Missing Access', 50001)
                return restGet(path)
            },
        },
        get: (def: unknown) => {
            if (def === channelsStore) return channelsMock
            if (def === threadsStore) return threadsMock
            if (def === guildsStore) return guildsMock
            throw new Error(`Unexpected store: ${String(def)}`)
        },
    } as unknown as Session
    return { session, held }
}

describe('holdLinkedChannel', () => {
    test('allows viewable guild channel and DMs', async () => {
        const publicCh: Channel = {
            id: 'c1',
            type: ChannelType.GUILD_TEXT,
            guild_id: GUILD_ID,
        }
        const dm: Channel = { id: 'dm1', type: ChannelType.DM }
        const { session } = makeSession({ channels: { c1: publicCh, dm1: dm } })
        expect(await holdLinkedChannel(session, 'c1')).toBe(true)
        expect(await holdLinkedChannel(session, 'dm1')).toBe(true)
    })

    test('denies guild channel without VIEW_CHANNEL', async () => {
        const secret: Channel = {
            id: 'c-secret',
            type: ChannelType.GUILD_TEXT,
            guild_id: GUILD_ID,
            permission_overwrites: [
                {
                    id: GUILD_ID,
                    type: 0,
                    allow: '0',
                    deny: String(Permission.VIEW_CHANNEL),
                },
            ],
        }
        const { session } = makeSession({ channels: { 'c-secret': secret } })
        expect(await holdLinkedChannel(session, 'c-secret')).toBe(false)
    })

    test('denies guild channel from an unknown guild', async () => {
        const foreign: Channel = {
            id: 'c-foreign',
            type: ChannelType.GUILD_TEXT,
            guild_id: 'other-guild',
        }
        const { session } = makeSession({ channels: { 'c-foreign': foreign } })
        expect(await holdLinkedChannel(session, 'c-foreign')).toBe(false)
    })

    test('checks parent VIEW_CHANNEL for active threads before holding', async () => {
        const hiddenParent: Channel = {
            id: 'p-hidden',
            type: ChannelType.GUILD_TEXT,
            guild_id: GUILD_ID,
            permission_overwrites: [
                {
                    id: GUILD_ID,
                    type: 0,
                    allow: '0',
                    deny: String(Permission.VIEW_CHANNEL),
                },
            ],
        }
        const hiddenThread: Channel = {
            id: 't-hidden',
            type: ChannelType.PUBLIC_THREAD,
            guild_id: GUILD_ID,
            parent_id: 'p-hidden',
            thread_metadata: { archived: false },
        }
        const visibleParent: Channel = {
            id: 'p-visible',
            type: ChannelType.GUILD_TEXT,
            guild_id: GUILD_ID,
        }
        const visibleThread: Channel = {
            id: 't-visible',
            type: ChannelType.PUBLIC_THREAD,
            guild_id: GUILD_ID,
            parent_id: 'p-visible',
            thread_metadata: { archived: false },
        }
        const { session, held } = makeSession({
            channels: { 'p-hidden': hiddenParent, 'p-visible': visibleParent },
            activeThreads: {
                't-hidden': hiddenThread,
                't-visible': visibleThread,
            },
        })
        expect(await holdLinkedChannel(session, 't-hidden')).toBe(false)
        expect(held).toHaveLength(0)
        expect(await holdLinkedChannel(session, 't-visible')).toBe(true)
    })

    test('denies left private threads without MANAGE_THREADS', async () => {
        const parent: Channel = {
            id: 'p1',
            type: ChannelType.GUILD_TEXT,
            guild_id: GUILD_ID,
        }
        const leftPrivate: Channel = {
            id: 'pt1',
            type: ChannelType.PRIVATE_THREAD,
            guild_id: GUILD_ID,
            parent_id: 'p1',
            thread_metadata: { archived: false },
        }
        const denied = makeSession({
            channels: { p1: parent, pt1: leftPrivate },
        })
        expect(await holdLinkedChannel(denied.session, 'pt1')).toBe(false)

        const mod = makeSession({
            channels: { p1: parent, pt1: leftPrivate },
            guilds: {
                [GUILD_ID]: makeGuild(Permission.VIEW_CHANNEL, {
                    mod: Permission.MANAGE_THREADS,
                }),
            },
        })
        expect(await holdLinkedChannel(mod.session, 'pt1')).toBe(true)
    })

    test('denies fetched thread when parent lacks VIEW_CHANNEL', async () => {
        const hiddenParent: Channel = {
            id: 'p-hidden',
            type: ChannelType.GUILD_TEXT,
            guild_id: GUILD_ID,
            permission_overwrites: [
                {
                    id: GUILD_ID,
                    type: 0,
                    allow: '0',
                    deny: String(Permission.VIEW_CHANNEL),
                },
            ],
        }
        const fetchedThread: Channel = {
            id: 't-archived',
            type: ChannelType.PUBLIC_THREAD,
            guild_id: GUILD_ID,
            parent_id: 'p-hidden',
            thread_metadata: { archived: true },
        }
        const { session, held } = makeSession({
            channels: { 'p-hidden': hiddenParent },
            restGet: async () => fetchedThread,
        })
        expect(await holdLinkedChannel(session, 't-archived')).toBe(false)
        expect(held).toHaveLength(0)
    })

    test('forwarded message jumps check permissions like channel links', async () => {
        const allowed: Channel = {
            id: 'c-ok',
            type: ChannelType.GUILD_TEXT,
            guild_id: GUILD_ID,
        }
        const secret: Channel = {
            id: 'c-secret',
            type: ChannelType.GUILD_TEXT,
            guild_id: GUILD_ID,
            permission_overwrites: [
                {
                    id: GUILD_ID,
                    type: 0,
                    allow: '0',
                    deny: String(Permission.VIEW_CHANNEL),
                },
            ],
        }
        const { session } = makeSession({
            channels: { 'c-ok': allowed, 'c-secret': secret },
        })
        const opened: Array<[string, string | undefined]> = []
        const openChannel = (channelId: string, messageId?: string) =>
            opened.push([channelId, messageId])

        useToastStore.setState({ toasts: [] })
        handleChatLink(chatLink.forward(GUILD_ID, 'c-secret', 'm1'), {
            session,
            openChannel,
        })
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(opened).toEqual([])
        expect(useToastStore.getState().toasts.map(toast => toast.key)).toEqual(
            ['no-access'],
        )

        handleChatLink(chatLink.forward(GUILD_ID, 'c-ok', 'm2'), {
            session,
            openChannel,
        })
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(opened).toEqual([['c-ok', 'm2']])
    })
})
