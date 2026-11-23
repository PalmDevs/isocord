import { createStore } from 'zustand/vanilla'
import { ActivityType } from '../core/discord/activity'
import { defineStore } from '../core/session'
import type { StoreApi } from 'zustand/vanilla'
import type { Status } from '../core/discord/status'
import type { Session as AppSession } from '../core/session'

interface Activity {
    type: number
    state?: string | null
    /** The custom status's emoji. */
    emoji?: { id?: string | null; name: string; animated?: boolean } | null
    name?: string
    details?: string | null
    application_id?: string
    assets?: { large_image?: string; small_image?: string }
    timestamps?: { start?: number }
}

interface ClientStatus {
    desktop?: Status
    mobile?: Status
    web?: Status
    embedded?: Status
    vr?: Status
}

export interface PresenceUpdate {
    user?: { id: string }
    user_id?: string
    status: Status
    activities?: Activity[]
    client_status?: ClientStatus
}

interface Session {
    status: Status
    activities?: Activity[]
    client_info?: { client?: string }
}

export interface Presence {
    status: Status
    /** Text of the custom status activity, if any. */
    customStatus?: string
    /** Emoji of the custom status activity, if any. */
    customEmoji?: { id?: string | null; name: string; animated?: boolean }
    /** PresenceStore.isMobileOnline: online on mobile and not on desktop or VR. Shows the phone shape. */
    mobile?: true
    /** Has a streaming activity (ActivityTypes.STREAMING). Shows the streaming icon. */
    streaming?: true
    /** The first activity that is not the custom status, shown under a member's name in the member list. */
    activity?: {
        type: number
        name: string
        details?: string
        state?: string
        applicationId?: string
        /** Asset key of the large image: a `mp:` external path or an app asset id. */
        largeImage?: string
        /** Asset key of the small image, shown over the large one. */
        smallImage?: string
        /** Start time in epoch milliseconds. */
        start?: number
    }
}

declare module '../core/gateway/events' {
    interface ReadyPayload {
        sessions?: Session[]
    }
    interface GatewayEvents {
        READY_SUPPLEMENTAL: {
            merged_presences?: { friends?: PresenceUpdate[] }
        }
        PRESENCE_UPDATE: PresenceUpdate
        SESSIONS_REPLACE: Session[]
    }
}

function toPresence(
    update: {
        status: Status
        activities?: Activity[]
    },
    mobile = false,
): Presence {
    const custom = update.activities?.find(
        activity => activity.type === ActivityType.CUSTOM_STATUS,
    )
    const presence: Presence = { status: update.status }
    if (custom?.state) presence.customStatus = custom.state
    if (custom?.emoji) presence.customEmoji = custom.emoji
    if (mobile) presence.mobile = true
    if (
        update.activities?.some(
            activity => activity.type === ActivityType.STREAMING,
        )
    )
        presence.streaming = true
    const activity = update.activities?.find(
        activity =>
            activity.type !== ActivityType.CUSTOM_STATUS && activity.name,
    )
    if (activity?.name)
        presence.activity = {
            type: activity.type,
            name: activity.name,
            details: activity.details ?? undefined,
            state: activity.state ?? undefined,
            applicationId: activity.application_id,
            largeImage: activity.assets?.large_image,
            smallImage: activity.assets?.small_image,
            start: activity.timestamps?.start,
        }
    return presence
}

/** Presences learned outside PRESENCE_UPDATE: the member list, member chunks. The current user's own is left alone. */
export function applyPresences(
    session: AppSession,
    updates: readonly PresenceUpdate[],
): void {
    const incoming: Record<string, Presence> = {}
    for (const update of updates) {
        const id = update.user?.id ?? update.user_id
        if (id && id !== session.userId)
            incoming[id] = toPresence(
                update,
                isMobileOnline(update.client_status),
            )
    }
    if (Object.keys(incoming).length === 0) return
    merge(session.get(presencesStore), incoming)
}

/** Writes `incoming` into the map in place, then notifies with a new state object. */
function merge(
    store: StoreApi<PresencesState>,
    incoming: PresencesState['presences'],
) {
    const { presences } = store.getState()
    Object.assign(presences, incoming)
    store.setState({ presences })
}

const isMobileOnline = (clientStatus: ClientStatus | undefined) =>
    clientStatus?.mobile === 'online' &&
    clientStatus.desktop !== 'online' &&
    clientStatus.vr !== 'online'

const MOBILE_CLIENTS = new Set(['mobile', 'android', 'ios'])

interface PresencesState {
    /**
     * By user id. Written in place: a copy per PRESENCE_UPDATE costs O(users seen).
     * Select an entry, or derive inside the selector. The map itself is only replaced on READY.
     */
    presences: Readonly<Record<string, Presence>>
}

/** Online status of friends, DM recipients, members of subscribed guilds and the current user. */
export const presencesStore = defineStore('presences', session => {
    const store = createStore<PresencesState>(() => ({ presences: {} }))
    const { dispatch } = session.gateway

    const set = (userId: string, presence: Presence) =>
        merge(store, { [userId]: presence })
    const setSelf = (sessions: Session[] | undefined) => {
        const own = sessions?.[0]
        if (!own) return
        const online = (client: (name: string) => boolean) =>
            sessions?.some(
                other =>
                    other.status === 'online' &&
                    client(other.client_info?.client ?? ''),
            )
        set(
            session.userId,
            toPresence(
                own,
                online(name => MOBILE_CLIENTS.has(name)) &&
                    !online(name => name === 'desktop'),
            ),
        )
    }

    dispatch.on('READY', ready => {
        store.setState({ presences: {} })
        setSelf(ready.sessions)
    })
    dispatch.on('SESSIONS_REPLACE', setSelf)
    dispatch.on('READY_SUPPLEMENTAL', supplemental => {
        const presences: Record<string, Presence> = {}
        for (const update of supplemental.merged_presences?.friends ?? []) {
            const id = update.user_id ?? update.user?.id
            if (id)
                presences[id] = toPresence(
                    update,
                    isMobileOnline(update.client_status),
                )
        }
        merge(store, presences)
    })
    dispatch.on('GUILD_MEMBERS_CHUNK', chunk => {
        if (chunk.presences?.length) applyPresences(session, chunk.presences)
    })
    dispatch.on('PRESENCE_UPDATE', update => {
        const id = update.user?.id ?? update.user_id
        // The current user's own status comes from SESSIONS_REPLACE; guild echoes can lag behind it.
        if (id && id !== session.userId)
            set(id, toPresence(update, isMobileOnline(update.client_status)))
    })

    return store
})
