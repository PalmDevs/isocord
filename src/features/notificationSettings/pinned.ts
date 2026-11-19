import { useSessionStore } from '../../core/react'
import { settingsStore } from '../../stores/settings/settingsStore'
import {
    isFavorite,
    PRIVATE_SETTINGS_KEY,
} from '../../stores/settings/userGuildSettings'
import type { Session } from '../../core/session'

/** A channel as the pin helpers need it; a private channel has no `guild_id`. */
interface ChannelRef {
    id: string
    guild_id?: string | null
}

/** UserGuildSettingsStore.isFavorite (isMessagesFavorite for a private channel): the channel is pinned. */
export function isPinned(session: Session, channel: ChannelRef): boolean {
    return isFavorite(
        session.get(settingsStore).getState().guildSettings[
            channel.guild_id ?? PRIVATE_SETTINGS_KEY
        ],
        channel.id,
    )
}

/** Hook form of `isPinned`. */
export function useIsPinned(channel: ChannelRef): boolean {
    return useSessionStore(settingsStore, state =>
        isFavorite(
            state.guildSettings[channel.guild_id ?? PRIVATE_SETTINGS_KEY],
            channel.id,
        ),
    )
}
