import { channelsStore } from './channels/channels'
import { dmPreviewsStore } from './channels/dmPreviews'
import { threadsStore } from './channels/threads'
import { expressionsStore } from './expressions'
import { forumPostsStore } from './forumPosts'
import { guildsStore } from './guilds'
import { memberListStore } from './memberList'
import { membersStore } from './members'
import { messagesStore } from './messages/messages'
import { messageHistoryStore } from './messages/messageWindows'
import { presencesStore } from './presences'
import { readStatesStore } from './readStates'
import { relationshipsStore } from './relationships'
import { settingsStore } from './settings/settingsStore'
import { typingStore } from './typing'
import { userProfilesStore } from './userProfiles'
import { usersStore } from './users'
import type { Feature } from '../core/feature'

/** The account's core data. Order matters: a store's handlers run after those of the stores listed before it. */
export const storesFeature: Feature = {
    name: 'stores',
    stores: [
        usersStore,
        guildsStore,
        expressionsStore,
        channelsStore,
        threadsStore,
        forumPostsStore,
        settingsStore,
        presencesStore,
        readStatesStore,
        membersStore,
        memberListStore,
        messagesStore,
        messageHistoryStore,
        dmPreviewsStore,
        typingStore,
        relationshipsStore,
        userProfilesStore,
    ],
}
