import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../core/session'
import { readJson, writeJson } from '../../core/storage'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { defaultChannelId } from './channelList'
import type { Session } from '../../core/session'

interface ServersUiState {
    selectedGuildId: string | null
    /** Last channel opened in each guild. */
    selectedChannelIds: Record<string, string>
    expandedFolderIds: string[]
}

const KEY = 'servers.ui'

/** What the Servers tab is showing. Remembered per account. */
export const serversUiStore = defineStore('serversUi', session => {
    const store = createStore<ServersUiState>(() => ({
        selectedGuildId: null,
        selectedChannelIds: {},
        expandedFolderIds: [],
        ...readJson<Partial<ServersUiState>>(session.storage, KEY),
    }))
    store.subscribe(state => writeJson(session.storage, KEY, state))
    return store
})

/** SelectedChannelStore.getChannelId: resolves the default in the guild selection commit. */
export function selectGuild(session: Session, guildId: string) {
    const store = session.get(serversUiStore)
    const { selectedGuildId, selectedChannelIds } = store.getState()
    if (selectedGuildId === guildId) return

    const guild = session.get(guildsStore).getState().guilds[guildId]
    const { byGuild, channels } = session.get(channelsStore).getState()
    const fallback =
        guild && !selectedChannelIds[guildId]
            ? defaultChannelId(guild, byGuild[guildId] ?? [], channels, session)
            : undefined
    store.setState({
        selectedGuildId: guildId,
        selectedChannelIds: fallback
            ? { ...selectedChannelIds, [guildId]: fallback }
            : selectedChannelIds,
    })
}
