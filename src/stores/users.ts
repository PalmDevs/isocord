import { createStore } from 'zustand/vanilla'
import { updateAccount } from '../core/accounts'
import { defineStore } from '../core/session'

export interface User {
    id: string
    username: string
    global_name?: string | null
    avatar: string | null
    discriminator?: string
    bot?: boolean
    /** Discord's own system user. */
    system?: boolean
    /** Nitro tier, known for the current user. 2 is Nitro, which raises the message limit to 4000. */
    premium_type?: number
    avatar_decoration_data?: { asset: string; sku_id?: string } | null
    /** The server tag the user displays next to their name. */
    primary_guild?: {
        identity_enabled?: boolean | null
        identity_guild_id?: string | null
        tag?: string | null
        badge?: string | null
    } | null
}

declare module '../core/gateway/events' {
    interface ReadyPayload {
        users?: User[]
    }
    interface GatewayEvents {
        USER_UPDATE: User
    }
}

interface UsersState {
    users: Record<string, User>
    /** Adds users learned outside the gateway, such as authors in fetched history. */
    upsert: (users: Iterable<User | undefined | null>) => void
}

/** A webhook's author: a bot with the zero discriminator (UserRecord.isNonUserBot without the system user). */
const WEBHOOK_DISCRIMINATOR = '0000'
export const isWebhookUser = (user: User) =>
    user.bot === true && user.discriminator === WEBHOOK_DISCRIMINATOR

/** UserRecord.isNonUserBot: a system user or a webhook, neither of which has a profile to fetch. */
export const isNonUserBot = (user: User) =>
    user.system === true || isWebhookUser(user)

/** Returns the member's nick, else the user's global name, else the username. */
export const displayName = (
    user: Pick<User, 'username' | 'global_name'> | undefined,
    nick?: string | null,
): string => nick ?? user?.global_name ?? user?.username ?? ''

/** Every user the client has been told about. Other stores hold ids and look users up here. */
export const usersStore = defineStore(
    'users',
    session => {
        const store = createStore<UsersState>(() => ({
            users: {},
            upsert: users => upsert(users),
        }))
        const { dispatch } = session.gateway

        /** Adds users that are new or whose visible fields changed. */
        const upsert = (incoming: Iterable<User | undefined | null>) => {
            const { users } = store.getState()
            let next: Record<string, User> | undefined
            for (const user of incoming) {
                if (!user?.id || user.username === undefined) continue
                const known = (next ?? users)[user.id]
                if (
                    known &&
                    known.username === user.username &&
                    known.avatar === user.avatar &&
                    known.global_name === user.global_name &&
                    known.premium_type === user.premium_type &&
                    known.avatar_decoration_data?.asset ===
                        user.avatar_decoration_data?.asset &&
                    known.primary_guild?.tag === user.primary_guild?.tag &&
                    known.primary_guild?.badge === user.primary_guild?.badge
                ) {
                    continue
                }
                next ??= { ...users }
                next[user.id] = { ...known, ...user }
            }
            if (next) store.setState({ users: next })
        }

        dispatch.on('READY', ready =>
            upsert([...(ready.users ?? []), ready.user]),
        )
        dispatch.on('USER_UPDATE', user => {
            upsert([user])
            updateAccount(user.id, {
                username: user.username,
                globalName: user.global_name ?? null,
                avatar: user.avatar,
            })
        })
        dispatch.on('MESSAGE_CREATE', message =>
            upsert([message.author, ...(message.mentions ?? [])]),
        )
        dispatch.on('CHANNEL_CREATE', channel =>
            upsert(channel.recipients ?? []),
        )
        dispatch.on('PRESENCE_UPDATE', presence =>
            upsert([presence.user as User]),
        )

        return store
    },
    {
        // Users are only ever added, so only those the cached state of other stores shows are saved.
        cache: (state, references) => ({
            users: Object.fromEntries(
                [...references().users].flatMap(id =>
                    state.users[id] ? [[id, state.users[id]]] : [],
                ),
            ),
        }),
    },
)
