import { GuildMemberFlags } from '../../core/discord/guild'
import { channelsStore } from '../../stores/channels/channels'
import {
    optIntoChannels,
    setCategoryCollapsed,
    setChannelOptIn,
} from '../../stores/settings/settingsActions'
import { settingsStore } from '../../stores/settings/settingsStore'
import {
    isChannelOptedIn,
    isOptInEnabledForGuild,
} from '../../stores/unreadPolicy'
import { browsableChannels } from './rows'
import type { Session } from '../../core/session'
import type { Guild } from '../../stores/guilds'
import type { SettingsState } from '../../stores/settings/settingsStore'

/** hasNotSetUpChannelOptIn: opt-in is off and the user skipped onboarding, so every channel shows. */
export function hasNotSetUpChannelOptIn(
    state: SettingsState,
    guild: Guild,
): boolean {
    return (
        !isOptInEnabledForGuild(state, guild) &&
        ((guild.myMemberFlags ?? 0) & GuildMemberFlags.COMPLETED_ONBOARDING) ===
            0
    )
}

/**
 * useBatchUpdateChannelSettings.onChannelClick: a tap on a channel row, or on a category header when
 * `channelId === parentId`. Adding a channel expands its collapsed category.
 */
export function toggleChannel(
    session: Session,
    guild: Guild,
    channelId: string,
    parentId: string | undefined,
): void {
    const state = session.get(settingsStore).getState()
    const optedIn = isChannelOptedIn(state, guild.id, channelId)
    if (
        !optedIn &&
        parentId &&
        state.guildSettings[guild.id]?.collapsedCategories[parentId]
    )
        setCategoryCollapsed(session, guild.id, parentId, false)
    if (!hasNotSetUpChannelOptIn(state, guild)) {
        setChannelOptIn(session, guild.id, channelId, !optedIn, true)
        return
    }
    // optIntoAllChannelsForExistingMember: everything showed, so the rest stays picked. A category is added to them,
    // a channel is left out.
    const { byGuild, channels } = session.get(channelsStore).getState()
    const all = browsableChannels(
        byGuild[guild.id] ?? [],
        channels,
        session,
    ).map(channel => channel.id)
    optIntoChannels(
        session,
        guild.id,
        channelId === parentId
            ? [...all, channelId]
            : all.filter(id => id !== channelId),
    )
}
