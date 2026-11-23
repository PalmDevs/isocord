import { AppState } from 'react-native'
import { createStore } from 'zustand/vanilla'
import { removeAccount } from './accounts'
import { accountIdentity } from './api/identity'
import { RestClient } from './api/rest'
import { solveCaptcha } from './captcha'
import { features } from './feature'
import { GatewaySocket } from './gateway/socket'
import { logger } from './log'
import { NotifyBatch } from './notifyBatch'
import { accountStorage } from './storage'
import { StoreCache } from './storeCache'
import type { MMKV } from 'react-native-mmkv'
import type { StoreApi } from 'zustand/vanilla'
import type { ClientState } from './gateway/socket'

type StateOf<T> = T extends StoreApi<infer State> ? State : never

/**
 * Users and guild members that the saved state of the cached stores shows. The session collects
 * them from each store's `references`, so `usersStore` and `membersStore` save only these.
 */
export interface CacheReferences {
    users: Set<string>
    /** User ids by guild id. */
    members: Map<string, Set<string>>
}

/**
 * What of a store's state is saved to disk and restored when the next session starts, so the app
 * can draw the last known state before the gateway's READY arrives: a list of state keys, or a
 * function picking (and trimming) the state to save. READY must replace whatever is restored.
 */
export type CacheSpec<State> =
    | ReadonlyArray<keyof State & string>
    | ((state: State, references: () => CacheReferences) => Partial<State>)

/** Saves a store's cache as one storage entry per part, so a change rewrites only its part. */
export interface CacheParts<State> {
    /** Splits the saved state. A part is rewritten when a value two levels down changes identity. */
    split: (saved: Partial<State>) => Record<string, object>
    /** Rebuilds the state to restore from the parts read back. Some may be missing. */
    join: (parts: Record<string, object>) => Partial<State>
}

/** A per-session store. Create with `defineStore`, read with `session.get` or `useSessionStore`. */
export interface StoreDefinition<T> {
    name: string
    create: (session: Session) => T
    cache?: CacheSpec<StateOf<T>>
    cacheParts?: CacheParts<StateOf<T>>
    /**
     * Restores the cache in idle time after the first commit, not at startup. For stores the first frame
     * doesn't show. The first dispatch or a later `get` restores it at once.
     */
    deferRestore?: boolean
    /** Bump when this store's cached state changes shape. Only its own older cache is then ignored. */
    cacheVersion?: number
    /** Adds the users and members that the store's saved state shows. */
    references?: (
        saved: Partial<StateOf<T>>,
        references: CacheReferences,
        session: Session,
    ) => void
}

export function defineStore<T>(
    name: string,
    create: (session: Session) => T,
    options: Omit<StoreDefinition<T>, 'name' | 'create'> = {},
): StoreDefinition<T> {
    return { name, create, ...options }
}

const log = logger('Session')

/** Bump to drop the cache of every store. One store bumps its own `cacheVersion`. */
const CACHE_VERSION = 7
/**
 * Set while a launch starts up from the cache.
 * Cleared once the restored state survives the first render or the app backgrounds, not on READY.
 * Still set at the next launch means startup died, so the cache is skipped once.
 */
const RESTORING_KEY = 'cache.restoring'
/** READY's `qos_token`, kept for the next IDENTIFY. */
const QOS_KEY = 'qosToken'
/** READY's `api_code_version`, kept for the next IDENTIFY's `client_state` (NonGuildVersions). */
const API_CODE_VERSION_KEY = 'apiCodeVersion'
/** How long the restored state must survive before the startup crash guard is lifted. */
const RESTORE_SETTLE_MS = 3000
/** Saving waits for the burst of events after READY (previews, member chunks) to settle. */
const CACHE_SAVE_DELAY_MS = 5000
/** GatewaySocketDispatcher `dispatchMultiple`: how long UI notifications wait while resuming. */
const RESUME_NOTIFY_PAUSE_MS = 150

/** Returns the version a store's cache is saved under. */
function cacheVersion(definition: StoreDefinition<unknown>): string {
    return `${CACHE_VERSION}.${definition.cacheVersion ?? 0}`
}

/**
 * Everything that belongs to one logged-in account: REST client, gateway
 * connection, storage and stores. Switching accounts disposes the session
 * and builds a new one, so no store ever needs a manual reset.
 */
export class Session {
    readonly rest: RestClient
    readonly gateway: GatewaySocket
    readonly storage: MMKV
    /** `ready` is false until READY has arrived this launch, so cached or empty stores can tell loading from empty. */
    readonly connection = createStore<{ ready: boolean }>(() => ({
        ready: false,
    }))

    private stores = new Map<StoreDefinition<unknown>, unknown>()
    private cleanups: Array<() => void> = []
    private readonly cache: StoreCache
    /** Holds UI notifications during a gateway slice. */
    private readonly notify = new NotifyBatch()
    /** True while the constructor wires stores. A `get` after it restores a deferred store. */
    private starting = true
    private clientStateProviders: Array<
        () => Partial<ClientState> | undefined
    > = []
    private cacheTimer: ReturnType<typeof setTimeout> | undefined
    private settleTimer: ReturnType<typeof setTimeout> | undefined
    /** True once READY arrived, so the stores hold server data worth keeping even if offline now. */
    private ready = false

    constructor(
        readonly userId: string,
        readonly token: string,
    ) {
        const started = performance.now()
        this.storage = accountStorage(userId)
        const useCache = !this.storage.getBoolean(RESTORING_KEY)
        if (!useCache)
            log.warn(
                'The last launch crashed while starting, so the cache is skipped',
            )
        this.storage.set(RESTORING_KEY, true)
        this.cache = new StoreCache(this, this.storage, cacheVersion, useCache)
        // A 401 is not a logout: the reference only logs out when the gateway rejects the token (4004).
        this.rest = new RestClient({
            identity: accountIdentity(userId, this.storage),
            token,
            solveCaptcha,
        })
        this.gateway = new GatewaySocket(
            token,
            this.rest.identity,
            () => this.clientState(),
            () => this.storage.getString(QOS_KEY),
            slice => {
                // Partial READY merges onto restored state, and IDENTIFY claims it.
                this.cache.restorePending()
                if (this.gateway.state === 'resuming')
                    this.notify.pause(RESUME_NOTIFY_PAUSE_MS)
                this.notify.batched(slice)
            },
        )
        this.cleanups.push(
            this.gateway.events.on('authenticationFailed', () =>
                removeAccount(userId),
            ),
        )

        // The handshake runs on native threads while the cache restores. Frames wait for a drain timer,
        // so every handler below is wired before READY.
        this.gateway.connect()
        for (const feature of features) {
            const featureStarted = performance.now()
            for (const store of feature.stores ?? []) this.get(store)
            const cleanup = feature.setup?.(this)
            if (cleanup) this.cleanups.push(cleanup)
            log.debug(
                `Set up ${feature.name} in ${Math.round(performance.now() - featureStarted)} ms`,
            )
        }
        this.starting = false
        log.info(
            `Started in ${Math.round(performance.now() - started)} ms, ${this.cache.restored} stores from the cache`,
        )

        const scheduleSave = () => {
            clearTimeout(this.cacheTimer)
            this.cacheTimer = setTimeout(
                () => this.cache.saveWhenIdle(),
                CACHE_SAVE_DELAY_MS,
            )
        }
        this.settleTimer = setTimeout(
            () => this.endRestoreGuard(),
            RESTORE_SETTLE_MS,
        )
        this.cleanups.push(
            this.gateway.dispatch.on('READY', ready => {
                // DerivedQosDataStore: the server's half of the next IDENTIFY's qos_token.
                if (ready.qos_token) this.storage.set(QOS_KEY, ready.qos_token)
                else this.storage.remove(QOS_KEY)
                if (ready.api_code_version !== undefined)
                    this.storage.set(
                        API_CODE_VERSION_KEY,
                        ready.api_code_version,
                    )
                log.info(
                    `READY ${Math.round(performance.now() - started)} ms after starting`,
                )
                this.ready = true
                this.connection.setState({ ready: true })
                this.endRestoreGuard()
                scheduleSave()
            }),
        )
        const appState = AppState.addEventListener('change', state => {
            if (state === 'background') {
                this.endRestoreGuard()
                this.saveCache()
            }
        })
        this.cleanups.push(() => appState.remove())
    }

    /**
     * Lets a store say what it holds, for IDENTIFY's `client_state`. Return only what the store's
     * own (cached) state can vouch for, or undefined when it holds nothing worth claiming; a claim
     * the data does not back shows stale data silently.
     */
    registerClientState(
        provider: () => Partial<ClientState> | undefined,
    ): void {
        this.clientStateProviders.push(provider)
    }

    /** Plain `{ guild_versions: {} }` unless this launch restored a cache or READY has filled the stores since. */
    private clientState(): ClientState {
        const state: ClientState = { guild_versions: {} }
        if (this.cache.restored === 0 && !this.ready) return state
        state.api_code_version = this.storage.getNumber(API_CODE_VERSION_KEY)
        for (const provider of this.clientStateProviders) {
            try {
                Object.assign(state, provider())
            } catch (error) {
                // A store that cannot describe itself just asks for everything again.
                log.warn('client_state failed, asking for everything', error)
                return { guild_versions: {} }
            }
        }
        return state
    }

    private endRestoreGuard(): void {
        clearTimeout(this.settleTimer)
        this.storage.remove(RESTORING_KEY)
    }

    get<T>(definition: StoreDefinition<T>): T {
        let store = this.stores.get(definition) as T | undefined
        if (store === undefined) {
            store = definition.create(this)
            this.stores.set(definition, store)
            if (definition.cache)
                this.cache.add(
                    definition as StoreDefinition<unknown>,
                    store as StoreApi<object>,
                    this.starting && definition.deferRestore === true,
                )
        } else if (!this.starting)
            this.cache.restorePending(definition as StoreDefinition<unknown>)
        return store
    }

    /** Returns a store whose listeners hear once per gateway slice. For React subscriptions. */
    view<State>(definition: StoreDefinition<StoreApi<State>>): StoreApi<State> {
        return this.notify.view(this.get(definition))
    }

    /**
     * Starts the work kept off the first frame: hands IDENTIFY to native code and restores the
     * deferred stores in idle time. Call after the first commit.
     */
    afterFirstCommit(): void {
        this.gateway.prepareIdentify()
        this.cache.restoreWhenIdle()
    }

    /**
     * Writes the stores that changed since the last save, at once. Backgrounding calls it.
     * Timers and idle callbacks stop in the background, and the process can be killed.
     */
    saveCache(): void {
        clearTimeout(this.cacheTimer)
        if (this.ready) this.cache.save()
    }

    dispose(): void {
        log.info('Ended')
        clearTimeout(this.cacheTimer)
        this.cache.dispose()
        this.notify.dispose()
        this.endRestoreGuard()
        for (const cleanup of this.cleanups) cleanup()
        this.gateway.close()
        this.gateway.dispatch.clear()
        this.gateway.events.clear()
        this.stores.clear()
    }
}
