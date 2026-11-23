import { logger } from './log'
import { readJson, writeJson } from './storage'
import { traced } from './trace'
import type { MMKV } from 'react-native-mmkv'
import type { StoreApi } from 'zustand/vanilla'
import type {
    CacheParts,
    CacheReferences,
    CacheSpec,
    Session,
    StoreDefinition,
} from './session'

type Definition = StoreDefinition<unknown>
type State = Record<string, unknown>

const log = logger('StoreCache')

/** Returns whether two parts hold the same values, compared by identity `depth` levels down. */
function samePart(a: unknown, b: unknown, depth = 2): boolean {
    if (a === b) return true
    if (
        depth === 0 ||
        !a ||
        !b ||
        typeof a !== 'object' ||
        typeof b !== 'object'
    )
        return false
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    return keys.every(key =>
        samePart((a as State)[key], (b as State)[key], depth - 1),
    )
}

function addReferences(into: CacheReferences, from: CacheReferences): void {
    for (const id of from.users) into.users.add(id)
    for (const [guildId, ids] of from.members) {
        const members = into.members.get(guildId) ?? new Set()
        for (const id of ids) members.add(id)
        into.members.set(guildId, members)
    }
}

/**
 * Restores and saves the cached stores of a session. Restores can wait for idle time, and saves can run one
 * store per idle slice. A store with `cacheParts` is saved as one entry per part.
 */
export class StoreCache {
    /** How many stores got their state from the cache. */
    restored = 0
    private stores = new Map<Definition, StoreApi<State>>()
    private pending = new Map<Definition, StoreApi<State>>()
    /** Cached stores that changed since they were last written. */
    private dirty = new Set<Definition>()
    /** Last written parts, by store. */
    private savedParts = new Map<Definition, Record<string, object>>()
    /** Users and members that each store's written state shows. */
    private contributions = new Map<Definition, CacheReferences>()
    private merged: CacheReferences | undefined
    private restoreIdle: number | undefined
    private saveIdle: number | undefined

    constructor(
        private readonly session: Session,
        private readonly storage: Pick<MMKV, 'getString' | 'set' | 'remove'>,
        /** Returns the version a store's cache is saved under. */
        private readonly versionOf: (definition: Definition) => string,
        /** False skips reading the cache. */
        private readonly useCache: boolean,
    ) {}

    /** Restores a new store now, or on `restorePending` when `defer` is set. */
    add(definition: Definition, store: StoreApi<object>, defer: boolean): void {
        if (defer) this.pending.set(definition, store as StoreApi<State>)
        else this.restore(definition, store as StoreApi<State>)
    }

    /** Restores a deferred store now, or every deferred store when none is given. */
    restorePending(definition?: Definition): void {
        if (definition) {
            const store = this.pending.get(definition)
            if (store) this.restore(definition, store)
        } else for (const [key, store] of this.pending) this.restore(key, store)
    }

    /** Restores the deferred stores one per idle callback. */
    restoreWhenIdle(): void {
        const step = () => {
            const next = this.pending.entries().next().value
            if (next) this.restore(...next)
            this.restoreIdle =
                this.pending.size > 0 ? requestIdleCallback(step) : undefined
        }
        this.restoreIdle ??= requestIdleCallback(step)
    }

    /** Writes every changed store now. */
    save(): void {
        if (this.saveIdle !== undefined) cancelIdleCallback(this.saveIdle)
        this.saveIdle = undefined
        if (this.dirty.size === 0) return
        const started = performance.now()
        const order = this.saveOrder()
        for (const definition of order) this.write(definition)
        log.debug(
            `Saved ${order.length} stores to the cache in ${Math.round(performance.now() - started)} ms`,
        )
    }

    /** Writes the stores changed by now, one per idle callback. */
    saveWhenIdle(): void {
        if (this.saveIdle !== undefined) return
        const order = this.saveOrder()
        const step = () => {
            const definition = order.shift()
            // `save` may have written it since.
            if (definition && this.dirty.has(definition)) this.write(definition)
            this.saveIdle =
                order.length > 0 ? requestIdleCallback(step) : undefined
        }
        if (order.length > 0) this.saveIdle = requestIdleCallback(step)
    }

    dispose(): void {
        if (this.restoreIdle !== undefined) cancelIdleCallback(this.restoreIdle)
        if (this.saveIdle !== undefined) cancelIdleCallback(this.saveIdle)
    }

    private key(definition: Definition, part?: string): string {
        return part === undefined
            ? `cache.${definition.name}`
            : `cache.${definition.name}.${part}`
    }

    private restore(definition: Definition, store: StoreApi<State>): void {
        this.pending.delete(definition)
        this.stores.set(definition, store)
        traced(`cache:${definition.name}`, () => {
            try {
                const state = this.useCache ? this.read(definition) : undefined
                if (!state) return
                store.setState(state)
                this.restored++
                log.debug(`Restored ${definition.name} from the cache`)
            } catch (error) {
                // A corrupt cache only costs the head start; READY rebuilds the state.
                log.warn(`Dropped the cache of ${definition.name}`, error)
                this.storage.remove(this.key(definition))
            }
        })
        store.subscribe(() => this.dirty.add(definition))
    }

    private read(definition: Definition): object | undefined {
        const cached = readJson<{
            version: string
            state?: object
            parts?: string[]
        }>(this.storage, this.key(definition))
        if (cached?.version !== this.versionOf(definition)) return undefined
        const spec = definition.cacheParts as CacheParts<State> | undefined
        if (!spec) return cached.state
        const parts: Record<string, object> = {}
        for (const part of cached.parts ?? []) {
            const value = readJson<object>(
                this.storage,
                this.key(definition, part),
            )
            // A part lost to a crash between writes is left out. READY sends it again.
            if (value) parts[part] = value
        }
        this.savedParts.set(definition, parts)
        return spec.join(parts)
    }

    /** Stores with `references` first, so the users and members saved after them see their new state. */
    private saveOrder(): Definition[] {
        return [...this.dirty].sort(
            (a, b) => Number(!!b.references) - Number(!!a.references),
        )
    }

    private write(definition: Definition): void {
        this.dirty.delete(definition)
        traced(`save:${definition.name}`, () => {
            const state = this.pick(definition)
            if (definition.references) {
                this.contributions.set(
                    definition,
                    this.collect(definition, state),
                )
                this.merged = undefined
            }
            const spec = definition.cacheParts as CacheParts<State> | undefined
            if (!spec)
                return writeJson(this.storage, this.key(definition), {
                    version: this.versionOf(definition),
                    state,
                })
            const parts = spec.split(state)
            // shortcut: parts written before a skipped or outdated cache stay on disk unlisted, until the same key is written.
            const before = this.savedParts.get(definition) ?? {}
            for (const [part, value] of Object.entries(parts))
                if (!samePart(before[part], value))
                    writeJson(this.storage, this.key(definition, part), value)
            for (const part of Object.keys(before))
                if (!(part in parts))
                    this.storage.remove(this.key(definition, part))
            writeJson(this.storage, this.key(definition), {
                version: this.versionOf(definition),
                parts: Object.keys(parts),
            })
            this.savedParts.set(definition, parts)
        })
    }

    /** Returns the part of a store's state that its `cache` spec saves. */
    private pick(definition: Definition): State {
        const cache = definition.cache as CacheSpec<State>
        const state = (
            this.stores.get(definition) as StoreApi<State>
        ).getState()
        return typeof cache === 'function'
            ? (cache(state, () => this.references()) as State)
            : Object.fromEntries(cache.map(key => [key, state[key]]))
    }

    private collect(definition: Definition, saved: State): CacheReferences {
        const references: CacheReferences = {
            users: new Set(),
            members: new Map(),
        }
        ;(definition as StoreDefinition<StoreApi<State>>).references?.(
            saved,
            references,
            this.session,
        )
        return references
    }

    /** Returns the users and members that the written state of every cached store shows. */
    private references(): CacheReferences {
        if (this.merged) return this.merged
        const merged: CacheReferences = {
            users: new Set([this.session.userId]),
            members: new Map(),
        }
        for (const definition of this.stores.keys()) {
            if (!definition.references) continue
            let contribution = this.contributions.get(definition)
            // Unchanged since it was restored, so its state is what is on disk.
            if (!contribution) {
                contribution = this.collect(definition, this.pick(definition))
                this.contributions.set(definition, contribution)
            }
            addReferences(merged, contribution)
        }
        this.merged = merged
        return merged
    }
}
