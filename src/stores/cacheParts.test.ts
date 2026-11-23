/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { stubNativeModules } from '../features/chat/rows/nativeStubs'
import type { CacheParts } from '../core/session'

// Stubs only the native packages, so every test file gets the real core modules.
await stubNativeModules()
const { channelsStore } = await import('./channels/channels')
const { expressionsStore } = await import('./expressions')

/** Returns what a restore rebuilds from the parts of `state`, after a JSON round trip. */
function roundTrip<State>(parts: CacheParts<State>, state: Partial<State>) {
    return parts.join(JSON.parse(JSON.stringify(parts.split(state))))
}

describe('cache parts', () => {
    test('channels split per guild and join back', () => {
        const state = {
            channels: {
                1: { id: '1', type: 0, guild_id: 'g' },
                2: { id: '2', type: 1 },
                3: { id: '3', type: 0, guild_id: 'h' },
            },
            byGuild: { g: ['1'], h: ['3'] },
            privateIds: ['2'],
            versions: { g: 5 },
        }
        const parts = channelsStore.cacheParts as CacheParts<typeof state>
        expect(Object.keys(parts.split(state)).sort()).toEqual([
            '@me',
            'g',
            'h',
        ])
        expect(roundTrip(parts, state)).toEqual(state)
    })

    test('expressions split per guild and join back', () => {
        const state = {
            guilds: {
                g: {
                    emojis: [],
                    stickers: [],
                    emojiVersion: 3,
                    stickerVersion: null,
                },
            },
            premiumType: 2,
        }
        const parts = expressionsStore.cacheParts as CacheParts<typeof state>
        expect(roundTrip(parts, state)).toEqual(state)
    })
})
