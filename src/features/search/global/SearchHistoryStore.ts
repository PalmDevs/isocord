import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../../core/session'
import { readJson, writeJson } from '../../../core/storage'

/** SearchConstants.SearchHistoryItemTypes, the ones the global search records. */
export type SearchHistoryItem =
    | { type: 'text'; text: string }
    | { type: 'dm' | 'group_dm'; channelId: string }

/** SearchHistory.add and deserialize keep only the newest three. */
export const SEARCH_HISTORY_MAX = 3
/** SearchConstants.NATIVE_SEARCH_HISTORY_STORAGE_KEY, per account (MMKV of the session). */
const STORAGE_KEY = 'searchHistory.dms'

interface SearchHistoryState {
    items: SearchHistoryItem[]
    add: (item: SearchHistoryItem) => void
    remove: (item: SearchHistoryItem) => void
    clear: () => void
}

const sameItem = (a: SearchHistoryItem, b: SearchHistoryItem) =>
    a.type === 'text' || b.type === 'text'
        ? a.type === b.type &&
          a.type === 'text' &&
          a.text === (b as typeof a).text
        : a.channelId === b.channelId

/** Recent searches and recently opened DMs of the global search, newest first, persisted per account. */
export const searchHistoryStore = defineStore('searchHistory', session => {
    const stored = readJson<SearchHistoryItem[]>(session.storage, STORAGE_KEY)
    const store = createStore<SearchHistoryState>((set, get) => ({
        items: Array.isArray(stored) ? stored.slice(0, SEARCH_HISTORY_MAX) : [],
        add: item => {
            if (item.type === 'text' && item.text.trim() === '') return
            set({
                items: [
                    item,
                    ...get().items.filter(other => !sameItem(other, item)),
                ].slice(0, SEARCH_HISTORY_MAX),
            })
        },
        remove: item =>
            set({ items: get().items.filter(other => !sameItem(other, item)) }),
        clear: () => set({ items: [] }),
    }))
    store.subscribe((state, previous) => {
        if (state.items !== previous.items)
            writeJson(session.storage, STORAGE_KEY, state.items)
    })
    return store
})
