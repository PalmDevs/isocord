import { deviceStorage } from './storage'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** LogAggregator's entry, plus a level. */
export interface LogEntry {
    /** Date.now() when logged. */
    time: number
    level: LogLevel
    /** LogAggregator's `category`: who logged it. */
    category: string
    message: string
}

export interface Logger {
    debug(message: string): void
    info(message: string): void
    warn(message: string, error?: unknown): void
    error(message: string, error?: unknown): void
}

/** LogAggregator keeps the last 5000 entries. */
const MAX_ENTRIES = 5000
/** The last lines before a fatal error, kept for the next launch. */
const CRASH_KEY = 'log.crash'
const CRASH_ENTRIES = 100

const entries: LogEntry[] = []
const listeners = new Set<() => void>()

/** The captured console methods, so dev builds still print without being captured twice. */
const consoleMethods = {
    debug: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
}

/** An error as one short line: its class (when not plain Error) and message. */
function describeError(error: unknown): string {
    if (error instanceof Error)
        return error.name && error.name !== 'Error'
            ? `${error.name}: ${error.message}`
            : error.message
    return typeof error === 'string' ? error : stringify(error)
}

function stringify(value: unknown): string {
    if (typeof value === 'string') return value
    if (value instanceof Error) return describeError(value)
    try {
        return JSON.stringify(value)?.slice(0, 1000) ?? String(value)
    } catch {
        return String(value)
    }
}

function push(entry: LogEntry): void {
    entries.push(entry)
    if (entries.length > MAX_ENTRIES) entries.shift()
    for (const listener of listeners) listener()
}

function report(level: LogLevel, category: string, message: string): void {
    push({ time: Date.now(), level, category, message })
    // console.log for every level: console.warn/error would raise LogBox for each failed request.
    if (__DEV__) consoleMethods.debug(`[${category}] ${message}`)
}

/**
 * A logger for one category, like the reference's `new Logger(name)`. Always on, in memory only, so release
 * builds have something to show in Debug Logs. Never log tokens, message contents or other private text.
 */
export function logger(category: string): Logger {
    const withError = (message: string, error: unknown) =>
        error === undefined ? message : `${message}: ${describeError(error)}`
    return {
        debug: message => report('debug', category, message),
        info: message => report('info', category, message),
        warn: (message, error) =>
            report('warn', category, withError(message, error)),
        error: (message, error) =>
            report('error', category, withError(message, error)),
    }
}

/** LogAggregator `getAllForDebugPanel`: a copy, oldest first unless `newestFirst`. */
export function getLogs(newestFirst = false): LogEntry[] {
    return newestFirst ? entries.slice().reverse() : entries.slice()
}

/** Calls `listener` after every new entry; returns the unsubscribe. */
export function subscribeLogs(listener: () => void): () => void {
    listeners.add(listener)
    return () => void listeners.delete(listener)
}

/**
 * LogAggregator `stringify`: one line per entry, `<ISO time> -> <level> -> <category> -> <message>`. Only the newest
 * lines that fit in `maxChars`, as a share Intent over Android's binder limit fails.
 */
export function stringifyLogs(maxChars: number): string {
    const lines: string[] = []
    let length = 0
    for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index]!
        const line = `${new Date(entry.time).toISOString()} -> ${entry.level.toUpperCase()} -> ${entry.category} -> ${entry.message}`
        length += line.length + 1
        if (length > maxChars) break
        lines.push(line)
    }
    return lines.reverse().join('\n')
}

// The previous launch died on a fatal error: its last lines come first.
const crash = deviceStorage.getString(CRASH_KEY)
if (crash !== undefined) {
    deviceStorage.remove(CRASH_KEY)
    try {
        entries.push(...(JSON.parse(crash) as LogEntry[]))
        report(
            'info',
            'Log',
            'The lines above are from the launch that crashed.',
        )
    } catch {}
}

// Warnings and errors from React Native and libraries.
for (const level of ['warn', 'error'] as const)
    console[level] = (...args: unknown[]) => {
        push({
            time: Date.now(),
            level,
            category: 'console',
            message: args.map(stringify).join(' '),
        })
        consoleMethods[level](...args)
    }

const previousHandler = ErrorUtils.getGlobalHandler()
ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Hermes stacks start with the class and message.
    const stack = error instanceof Error ? error.stack : undefined
    report(
        'error',
        isFatal ? 'fatal' : 'uncaught',
        stack ?? describeError(error),
    )
    if (isFatal)
        deviceStorage.set(
            CRASH_KEY,
            JSON.stringify(entries.slice(-CRASH_ENTRIES)),
        )
    previousHandler(error, isFatal)
})

declare const HermesInternal:
    | {
          enablePromiseRejectionTracker?: (options: {
              allRejections: boolean
              onUnhandled: (id: number, error: unknown) => void
          }) => void
      }
    | undefined

// Development builds already track rejections and show them in LogBox; release builds drop them silently.
if (!__DEV__ && typeof HermesInternal !== 'undefined')
    HermesInternal.enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled: (_id, error) =>
            report(
                'warn',
                'promise',
                `Unhandled rejection: ${describeError(error)}`,
            ),
    })
