import { createStore } from 'zustand/vanilla'
import { defineStore } from '../core/session'
import type { ForumQuery } from './forumPosts'

interface ForumQueriesState {
    /** What each forum's list differs in from the channel's defaults, by channel id. */
    changes: Record<string, Partial<ForumQuery>>
}

/**
 * ForumSearchStore / ForumChannelStore: the sort, tags and search of each forum's list. A store, so the filter
 * sheet (drawn outside the forum) and the forum read the same query.
 */
export const forumQueriesStore = defineStore('forumQueries', () =>
    createStore<ForumQueriesState>(() => ({ changes: {} })),
)
