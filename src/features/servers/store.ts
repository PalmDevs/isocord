import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../core/session'
import { readJson, writeJson } from '../../core/storage'

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
