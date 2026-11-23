import { Permission } from '../../../core/discord/permissions'
import { can } from '../../../stores/permissions'
import type { Message } from '../../../stores/readStates'
import type { RowContext } from './buildRows'
import type { ChatRow } from './rows'

/**
 * Reuses a message's row, and its JSON line, while nothing it read has changed. The reference regenerates only the
 * rows of `updateMessageIds` (MessagesRenderer). Here each row records what it read instead.
 */

/** Context maps whose entries a row reads. */
const MAPS = [
    'users',
    'members',
    'channels',
    'guilds',
    'threads',
    'threadMessages',
    'polls',
] as const
/** Context callbacks whose answers a row reads. */
const CALLS = ['canReact', 'swipeActions', 'hiddenReason'] as const
type Source = (typeof MAPS)[number] | (typeof CALLS)[number] | 'canView'

/** The key of a read that walked a whole map. */
const WHOLE = Symbol('whole')

/** Lines that follow the clock: relative timestamp mentions, poll time labels. */
const CLOCK_MARKERS = ['"timestamp":true', '"poll":']

interface Read {
    source: Source
    key: unknown
    value: unknown
}

interface Entry {
    older: Message | undefined
    scalars: unknown[]
    reads: Read[]
    unknownChannels: string[]
    row: ChatRow
}

// Messages are replaced when edited, so rows can be cached on the message object.
// A row lives as long as its message. A trimmed message stays reachable through the next row's `older` until that
// row is rebuilt, which the next build of the chat does.
const entries = new WeakMap<Message, Entry>()
const lines = new WeakMap<ChatRow, string>()

/** Returns a row's JSON line, encoded once per row object. */
export const rowLine = (row: ChatRow): string =>
    lines.get(row) ?? JSON.stringify(row)

/** What every row may read besides map entries, compared by identity. The day changes "Today" labels. */
const scalarsOf = (context: RowContext): unknown[] => [
    context.session,
    context.guild,
    context.channel,
    context.interactions,
    new Date().toDateString(),
    ...MAPS.map(source => context[source] === undefined),
]

/** Returns what a read gives in `context` now. */
function current(context: RowContext, { source, key }: Read): unknown {
    switch (source) {
        case 'canReact':
        case 'swipeActions':
            return context[source]?.(key as Message)
        case 'hiddenReason':
            return context.hiddenReason?.(key as string)
        case 'canView':
            return can(context.session, key as string, Permission.VIEW_CHANNEL)
    }
    const map = context[source]
    return key === WHOLE ? map : map?.[key as string]
}

/** Returns a context that records what a row reads, and the cache of rows built with it. */
export function rowMemo(context: RowContext) {
    const scalars = scalarsOf(context)
    let reads: Read[] = []
    let unknownChannels: string[] = []
    const tracked: RowContext = {
        ...context,
        onUnknownChannel: id => {
            unknownChannels.push(id)
            context.onUnknownChannel?.(id)
        },
    }
    const record = (source: Source, key: unknown, value: unknown) => {
        reads.push({ source, key, value })
        return value
    }
    for (const source of MAPS) {
        const map = context[source]
        if (!map) continue
        Object.assign(tracked, {
            [source]: new Proxy(map, {
                get: (target, key) =>
                    typeof key === 'string'
                        ? record(source, key, Reflect.get(target, key))
                        : Reflect.get(target, key),
                has: (target, key) => {
                    if (typeof key === 'string')
                        record(source, key, Reflect.get(target, key))
                    return Reflect.has(target, key)
                },
                ownKeys: target => {
                    record(source, WHOLE, target)
                    return Reflect.ownKeys(target)
                },
            }),
        })
    }
    const read = (source: Source, key: unknown) =>
        record(source, key, current(context, { source, key, value: undefined }))
    for (const source of CALLS)
        Object.assign(tracked, {
            [source]: (key: unknown) => read(source, key),
        })

    /** Returns the message's cached row while its reads hold, else builds and caches it. */
    function row<T extends ChatRow>(
        message: Message,
        older: Message | undefined,
        build: () => T,
    ): T {
        const entry = entries.get(message)
        if (
            entry &&
            entry.older === older &&
            entry.scalars.every((value, index) => value === scalars[index]) &&
            entry.reads.every(read => current(context, read) === read.value)
        ) {
            for (const id of entry.unknownChannels)
                context.onUnknownChannel?.(id)
            return entry.row as T
        }
        reads = []
        unknownChannels = []
        const built = build()
        const line = JSON.stringify(built)
        lines.set(built, line)
        if (CLOCK_MARKERS.some(marker => line.includes(marker)))
            entries.delete(message)
        else
            entries.set(message, {
                older,
                scalars,
                reads,
                unknownChannels,
                row: built,
            })
        return built
    }
    return {
        context: tracked,
        row,
        /** Whether the user can see a channel, from the session's permissions. */
        canView: (channelId: string) => read('canView', channelId) as boolean,
    }
}
