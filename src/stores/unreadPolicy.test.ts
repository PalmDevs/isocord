/// <reference types="bun" />
import { expect, test } from 'bun:test'
import levelVectors from '../../test-vectors/notification-policy/level.json'
import mentionedVectors from '../../test-vectors/notification-policy/mentioned.json'
import muteVectors from '../../test-vectors/notification-policy/mute.json'
import optInVectors from '../../test-vectors/notification-policy/optin.json'
import { UnreadSetting } from '../core/discord/notificationSettings'
import {
    isChannelMuted,
    isChannelOrParentOptedIn,
    isGuildMuted,
    isMentioned,
    isMuted,
    isOptInEnabled,
    resolvedMessageNotifications,
    resolveUnreadSetting,
} from './unreadPolicy'
import type { GuildSettings, Mute } from './settings/userGuildSettings'

// Runs the vectors shared with the Notify policy (NotificationPolicyVectorsTest.kt) against the Unread policy.

/** A vector's settings, which follow GuildSettings in NotificationState.kt. */
interface VectorSettings {
    mute: { end: number | null } | null
    channelMutes: Record<string, { end: number | null }>
    level: number | null
    channelLevels: Record<string, number>
    flags: number
    channelFlags: Record<string, number>
    suppressEveryone: boolean
    suppressRoles: boolean
}

interface VectorChannel {
    id: string
    guildId: string | null
    parentId: string | null
}

interface MuteCase {
    name: string
    now: number
    channel: VectorChannel
    settings: VectorSettings | null
    expect: { muted: boolean; guildMuted?: boolean; channelMuted?: boolean }
}
interface LevelCase {
    name: string
    guildDefault: number | null
    channel: VectorChannel
    settings: VectorSettings | null
    expect: { level: number }
}
interface OptInCase {
    name: string
    channel: VectorChannel
    settings: VectorSettings | null
    expect: { optInEnabled: boolean; channelOrParentOptedIn: boolean }
}
interface MentionedCase {
    name: string
    message: {
        mentions: string[]
        mentionEveryone: boolean
        mentionRoles: string[]
    }
    me: { id: string; roles: string[] }
    settings: VectorSettings | null
    expect: { mentioned: boolean }
}

/** A mute with no end is for good. */
const muteOf = (mute: { end: number | null }): Mute => mute.end ?? true

/** Returns the settings the way the settings store holds them, by guild id. */
function stateOf(channel: VectorChannel, settings: VectorSettings | null) {
    if (!settings) return { guildSettings: {} }
    const stored: GuildSettings = {
        muted: settings.mute ? muteOf(settings.mute) : false,
        suppressEveryone: settings.suppressEveryone,
        suppressRoles: settings.suppressRoles,
        mutedChannels: Object.fromEntries(
            Object.entries(settings.channelMutes).map(([id, mute]) => [
                id,
                muteOf(mute),
            ]),
        ),
        collapsedCategories: {},
        messageNotifications: settings.level ?? undefined,
        channelMessageNotifications: settings.channelLevels,
        flags: settings.flags,
        channelFlags: settings.channelFlags,
    }
    return { guildSettings: { [channel.guildId ?? '@me']: stored } }
}

/** Returns the channel the way the policy reads it. */
const refOf = (channel: VectorChannel) => ({
    id: channel.id,
    guild_id: channel.guildId,
    parent_id: channel.parentId,
})

for (const vector of muteVectors.cases as MuteCase[])
    test(`mute: ${vector.name}`, () => {
        const state = stateOf(vector.channel, vector.settings)
        const channel = refOf(vector.channel)
        const expected = vector.expect
        expect(isMuted(state, channel, vector.now)).toBe(expected.muted)
        if (expected.guildMuted !== undefined)
            expect(isGuildMuted(state, 'g', vector.now)).toBe(
                expected.guildMuted,
            )
        if (expected.channelMuted !== undefined)
            expect(isChannelMuted(state, channel, vector.now)).toBe(
                expected.channelMuted,
            )
    })

for (const vector of levelVectors.cases as LevelCase[])
    test(`level: ${vector.name}`, () => {
        expect(
            resolvedMessageNotifications(
                stateOf(vector.channel, vector.settings),
                refOf(vector.channel),
                vector.guildDefault ?? undefined,
            ),
        ).toBe(vector.expect.level)
    })

for (const vector of optInVectors.cases as OptInCase[])
    test(`opt-in: ${vector.name}`, () => {
        const state = stateOf(vector.channel, vector.settings)
        expect(isOptInEnabled(state, 'g')).toBe(vector.expect.optInEnabled)
        expect(isChannelOrParentOptedIn(state, refOf(vector.channel))).toBe(
            vector.expect.channelOrParentOptedIn,
        )
    })

for (const vector of mentionedVectors.cases as MentionedCase[])
    test(`mentioned: ${vector.name}`, () => {
        const state = stateOf(
            { id: 'c', guildId: 'g', parentId: null },
            vector.settings,
        )
        const message = {
            mentions: vector.message.mentions.map(id => ({ id })),
            mention_everyone: vector.message.mentionEveryone,
            mention_roles: vector.message.mentionRoles,
        }
        expect(isMentioned(state, 'g', message, vector.me)).toBe(
            vector.expect.mentioned,
        )
    })

// resolveUnreadSetting: the reference resolves the level with the guild's default.
test('unread setting follows the guild default level', () => {
    const state = {
        guildSettings: {},
        newNotifications: true,
    }
    const channel = { id: 'c', guild_id: 'g', parent_id: null }
    expect(resolveUnreadSetting(state, channel, undefined)).toBe(
        UnreadSetting.ALL_MESSAGES,
    )
    expect(resolveUnreadSetting(state, channel, 1)).toBe(
        UnreadSetting.ONLY_MENTIONS,
    )
    expect(resolveUnreadSetting(state, channel, 0)).toBe(
        UnreadSetting.ALL_MESSAGES,
    )
})
