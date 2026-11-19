import { UserNotificationSettings } from '../../core/discord/notificationSettings'
import { ThreadMemberFlags } from '../../core/discord/threadMember'
import { useSessionStore } from '../../core/react'
import { t } from '../../i18n'
import { computeChannelName } from '../../stores/channels/channelName'
import {
    channelsStore,
    isForumPost,
    isThread,
} from '../../stores/channels/channels'
import { isThreadJoined } from '../../stores/channels/threadMemberActions'
import { guildsStore } from '../../stores/guilds'
import { settingsStore } from '../../stores/settings/settingsStore'
import { PRIVATE_SETTINGS_KEY } from '../../stores/settings/userGuildSettings'
import {
    isChannelMuted,
    isGuildMuted,
    isThreadMuted,
    threadNotificationSetting,
} from '../../stores/unreadPolicy'
import { usersStore } from '../../stores/users'

/** MuteSettingsUtils.getMessageNotificationsText: the name of a notification level, or undefined for NULL. */
export function levelText(level: number): string | undefined {
    switch (level) {
        case UserNotificationSettings.ALL_MESSAGES:
            return t('muteSettings.all')
        case UserNotificationSettings.ONLY_MENTIONS:
            return t('muteSettings.mentions')
        case UserNotificationSettings.NO_MESSAGES:
            return t('muteSettings.nothing')
        default:
            return undefined
    }
}

/** The notification level a thread's ThreadMemberFlags setting stands for, to show it as a level's name. */
const THREAD_LEVELS: Record<number, number> = {
    [ThreadMemberFlags.ALL_MESSAGES]: UserNotificationSettings.ALL_MESSAGES,
    [ThreadMemberFlags.ONLY_MENTIONS]: UserNotificationSettings.ONLY_MENTIONS,
    [ThreadMemberFlags.NO_MESSAGES]: UserNotificationSettings.NO_MESSAGES,
}

/** JoinedThreadsStore.hasJoined, for a component. */
export function useIsThreadJoined(channelId: string): boolean {
    return useSessionStore(channelsStore, state => {
        const channel = state.channels[channelId]
        return channel !== undefined && isThreadJoined(channel)
    })
}

/**
 * What the mute and notification sheets read of a channel: its own mute and level, the server's, and the level it
 * inherits (MuteSettingsUtils.getMuteSettings, ChannelSettingsNotificationsGuard).
 */
export function useNotificationState(channelId: string) {
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const name = useSessionStore(usersStore, state =>
        channel ? computeChannelName(channel, state.users, true) : '',
    )
    const guildId = channel?.guild_id
    const guildDefault = useSessionStore(guildsStore, state =>
        guildId
            ? state.guilds[guildId]?.defaultMessageNotifications
            : undefined,
    )
    const memberCount = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId]?.memberCount : undefined,
    )
    const parent = useSessionStore(channelsStore, state =>
        channel?.parent_id ? state.channels[channel.parent_id] : undefined,
    )
    const thread = channel !== undefined && isThread(channel)
    // A thread is muted by its own membership (JoinedThreadsStore.isMuted), never by a channel override.
    const muted = useSessionStore(settingsStore, state =>
        thread
            ? isThreadMuted(channel.member)
            : channel !== undefined && isChannelMuted(state, channel),
    )
    // useThreadNotificationSetting: the ThreadMemberFlags level of a thread.
    const threadSetting = useSessionStore(settingsStore, state =>
        thread
            ? threadNotificationSetting(state, channel, parent, guildDefault)
            : ThreadMemberFlags.NO_MESSAGES,
    )
    const guildMuted = useSessionStore(
        settingsStore,
        state => guildId != null && isGuildMuted(state, guildId),
    )
    const settings = useSessionStore(
        settingsStore,
        state => state.guildSettings[guildId ?? PRIVATE_SETTINGS_KEY],
    )
    // UserGuildSettingsStore.getMessageNotifications: the server's level, else its default.
    const own = settings?.messageNotifications
    const guildLevel =
        own === undefined || own === UserNotificationSettings.NULL
            ? (guildDefault ?? UserNotificationSettings.ALL_MESSAGES)
            : own
    const level = thread
        ? (THREAD_LEVELS[threadSetting] ?? UserNotificationSettings.NULL)
        : (settings?.channelMessageNotifications?.[channelId] ??
          UserNotificationSettings.NULL)
    // The category's own level, else the server's: what the channel follows while its own is NULL.
    const parentLevel = channel?.parent_id
        ? settings?.channelMessageNotifications?.[channel.parent_id]
        : undefined
    return {
        channel,
        thread,
        forumPost: channel !== undefined && isForumPost(channel, parent),
        threadSetting,
        name,
        muted,
        guildMuted,
        memberCount,
        guildLevel,
        level,
        defaultLevel: parentLevel ?? guildLevel,
    }
}
