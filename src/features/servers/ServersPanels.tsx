import { useEffect } from 'react'
import { useSession, useSessionStore } from '../../core/react'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { ChatPanels } from '../chat/ChatPanels'
import { defaultChannelId } from './channelList'
import { serversUiStore } from './store'
import { ServersPanelsContext } from './useServersPanels'
import type { ReactNode } from 'react'

/** Chat panel of the Servers tab: the channel selected in the selected server. */
export function ServersPanels({ children }: { children: ReactNode }) {
    const guildId = useSessionStore(
        serversUiStore,
        state => state.selectedGuildId,
    )
    const session = useSession()
    const selectedId = useSessionStore(serversUiStore, state =>
        guildId ? state.selectedChannelIds[guildId] : undefined,
    )
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    // No channel opened in this server yet: fall back to its default channel, as the
    // reference's SelectedChannelStore.getChannelId does with GuildChannelStore.getDefaultChannel.
    const fallbackId = useSessionStore(channelsStore, state =>
        selectedId || !guild
            ? undefined
            : defaultChannelId(
                  guild,
                  state.byGuild[guild.id] ?? [],
                  state.channels,
                  session,
              ),
    )
    // Remember it as the selection so the channel list highlights it too.
    useEffect(() => {
        if (!guildId || !fallbackId) return
        session.get(serversUiStore).setState(state =>
            state.selectedChannelIds[guildId]
                ? state
                : {
                      selectedChannelIds: {
                          ...state.selectedChannelIds,
                          [guildId]: fallbackId,
                      },
                  },
        )
    }, [session, guildId, fallbackId])
    const channelId = selectedId ?? fallbackId
    return (
        <ChatPanels context={ServersPanelsContext} channelId={channelId}>
            {children}
        </ChatPanels>
    )
}
