import { describe, expect, it } from 'bun:test'
import { parseDiscordChannelUrl } from './channelUrl'

describe('parseDiscordChannelUrl', () => {
    it('parses main, ptb, canary, and legacy discordapp.com channel and message URLs', () => {
        expect(
            parseDiscordChannelUrl('https://discord.com/channels/123/456/789'),
        ).toEqual({
            guildId: '123',
            channelId: '456',
            messageId: '789',
        })
        expect(
            parseDiscordChannelUrl('https://ptb.discord.com/channels/123/456'),
        ).toEqual({
            guildId: '123',
            channelId: '456',
            messageId: undefined,
        })
        expect(
            parseDiscordChannelUrl(
                'https://canary.discord.com/channels/@me/456/789?foo=bar#baz',
            ),
        ).toEqual({
            guildId: '@me',
            channelId: '456',
            messageId: '789',
        })
        expect(
            parseDiscordChannelUrl(
                'http://canary.discordapp.com/channels/1/2/',
            ),
        ).toEqual({
            guildId: '1',
            channelId: '2',
            messageId: undefined,
        })
        expect(
            parseDiscordChannelUrl('https://ptb.discordapp.com/channels/1/2'),
        ).toEqual({
            guildId: '1',
            channelId: '2',
            messageId: undefined,
        })
    })

    it('parses guild-only and @me URLs without a channel id', () => {
        expect(
            parseDiscordChannelUrl('https://discord.com/channels/@me'),
        ).toEqual({
            guildId: '@me',
            channelId: undefined,
            messageId: undefined,
        })
        expect(
            parseDiscordChannelUrl('https://ptb.discord.com/channels/12345/'),
        ).toEqual({
            guildId: '12345',
            channelId: undefined,
            messageId: undefined,
        })
    })

    it('rejects non-Discord hosts and malformed paths', () => {
        expect(
            parseDiscordChannelUrl('https://evil.discord.com/channels/123/456'),
        ).toBeUndefined()
        expect(
            parseDiscordChannelUrl(
                'https://discord.com/channels/123/456/789/0',
            ),
        ).toBeUndefined()
        expect(
            parseDiscordChannelUrl('https://discord.com/invite/abc'),
        ).toBeUndefined()
    })
})
