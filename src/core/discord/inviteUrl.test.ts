import { describe, expect, it } from 'bun:test'
import { inviteUrl, parseDiscordInviteUrl } from './inviteUrl'

describe('parseDiscordInviteUrl', () => {
    it('parses discord.gg and /invite/ URLs across main, ptb, canary, and legacy hosts', () => {
        expect(
            parseDiscordInviteUrl('https://discord.gg/discord-testers'),
        ).toEqual({
            code: 'discord-testers',
            url: 'https://discord.gg/discord-testers',
        })
        expect(
            parseDiscordInviteUrl('http://discord.gg/AbCd123/?event=1'),
        ).toEqual({
            code: 'AbCd123',
            url: 'http://discord.gg/AbCd123/?event=1',
        })
        expect(
            parseDiscordInviteUrl('https://discord.com/invite/abc123'),
        ).toEqual({
            code: 'abc123',
            url: 'https://discord.com/invite/abc123',
        })
        expect(
            parseDiscordInviteUrl('https://ptb.discord.com/invite/abc123#frag'),
        ).toEqual({
            code: 'abc123',
            url: 'https://ptb.discord.com/invite/abc123#frag',
        })
        expect(
            parseDiscordInviteUrl('https://canary.discord.com/invite/abc123'),
        ).toEqual({
            code: 'abc123',
            url: 'https://canary.discord.com/invite/abc123',
        })
        expect(
            parseDiscordInviteUrl('https://ptb.discordapp.com/invite/abc123'),
        ).toEqual({
            code: 'abc123',
            url: 'https://ptb.discordapp.com/invite/abc123',
        })
    })

    it('rejects empty codes, extra path segments, and non-Discord hosts', () => {
        expect(parseDiscordInviteUrl('https://discord.gg/')).toBeUndefined()
        expect(parseDiscordInviteUrl('https://discord.gg/a/b')).toBeUndefined()
        expect(
            parseDiscordInviteUrl('https://evil.discord.gg/abc'),
        ).toBeUndefined()
        expect(
            parseDiscordInviteUrl('https://discord.com/channels/123/456'),
        ).toBeUndefined()
    })
})

describe('inviteUrl', () => {
    it('builds the discord.gg share link', () => {
        expect(inviteUrl('abc123')).toBe('https://discord.gg/abc123')
    })
})
