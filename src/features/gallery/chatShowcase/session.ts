import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { CHANNELS, GUILD, ME_ID, OTHER_GUILD } from './fixtures'
import type { Session, StoreDefinition } from '../../../core/session'

export const showcaseChannels = Object.fromEntries(
    CHANNELS.map(channel => [channel.id, channel]),
)
export const showcaseGuilds = {
    [GUILD.id]: GUILD,
    [OTHER_GUILD.id]: OTHER_GUILD,
}

/** What `buildRows` reads from a session: the user's id, and the stores that permission checks use. */
const STORES = new Map<StoreDefinition<unknown>, unknown>([
    [channelsStore, { getState: () => ({ channels: showcaseChannels }) }],
    [guildsStore, { getState: () => ({ guilds: showcaseGuilds }) }],
])

/**
 * A stand-in session for the showcase, so no real account's state is read or written. Asking it for any other
 * store throws, which shows a row builder that started to need more.
 */
export const showcaseSession = {
    userId: ME_ID,
    get: (definition: StoreDefinition<unknown>) => {
        const store = STORES.get(definition)
        if (!store)
            throw new Error(`The showcase has no ${definition.name} store`)
        return store
    },
} as unknown as Session
