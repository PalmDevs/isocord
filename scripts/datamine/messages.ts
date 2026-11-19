/**
 * English intl messages by hash. Read from the official APK once, then cached next to node_modules.
 * Hashes look like `t.wsoPhr` or `t["wsoPhr"]` in the datamine.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const CACHE_DIR = resolve(import.meta.dir, '../../node_modules/.cache/isocord')
const CACHE_FILE = join(CACHE_DIR, 'en-US.messages.json')
const MESSAGE_ENTRIES = [
    'res/raw/intl_messages_enuscompiledmessages.jsona',
    'res/raw/intl_messages_untranslatedcompiledmessages.jsona',
]
// Feature modules keep their English messages in files of their own.
const MODULE_ENTRY = /^res\/raw\/modules_.*compiledmessages\.jsona$/
const HASH = /^[A-Za-z0-9+/]{6}$/
const HASH_REFERENCE = /\bt\.([A-Za-z0-9+/]{6})\b|\bt\["([A-Za-z0-9+/]{6})"\]/g

type Messages = Record<string, string>

/** Flattens a compiled message into ICU-like text; enough to recognise the string. */
function render(node: unknown): string {
    if (typeof node === 'string') return node
    if (!Array.isArray(node)) return ''
    const [type, name, ...rest] = node as [unknown, unknown, ...unknown[]]
    if (typeof type !== 'number') return node.map(render).join('')
    const children = rest
        .map(child =>
            child && typeof child === 'object' ? renderOptions(child) : '',
        )
        .join('')
    return children ? `{${name}:${children}}` : `{${name}}`
}

function renderOptions(value: unknown): string {
    if (Array.isArray(value)) return value.map(render).join('')
    return Object.entries(value as Record<string, unknown>)
        .map(([key, option]) => `${key}[${renderOptions(option)}]`)
        .join(' ')
}

function readFromApk(apk: string): Messages {
    const messages: Messages = {}
    const list = Bun.spawnSync(['unzip', '-Z1', resolve(apk)])
    const moduleEntries = list.stdout
        .toString()
        .split('\n')
        .filter(entry => MODULE_ENTRY.test(entry))
    for (const entry of [...MESSAGE_ENTRIES, ...moduleEntries]) {
        const unzip = Bun.spawnSync(['unzip', '-p', resolve(apk), entry])
        if (unzip.exitCode !== 0)
            throw new Error(`Cannot read ${entry} from ${apk}`)
        const compiled: Record<string, unknown[]> = JSON.parse(
            unzip.stdout.toString(),
        )
        for (const [hash, nodes] of Object.entries(compiled))
            messages[hash] = render(nodes)
    }
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(CACHE_FILE, JSON.stringify(messages))
    return messages
}

let loaded: Messages | undefined

/** Loads the cached messages, or rebuilds the cache when `apk` is given. */
export function loadMessages(apk?: string): Messages {
    if (apk) loaded = readFromApk(apk)
    else if (!loaded && existsSync(CACHE_FILE))
        loaded = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
    else if (!loaded)
        console.error('No message cache yet. Run once with --apk <base.apk>.')
    return loaded ?? {}
}

/** Appends each known hash reference with its English text as a comment. */
export function annotateMessages(source: string, messages: Messages): string {
    return source.replace(
        HASH_REFERENCE,
        (match, dotted?: string, bracketed?: string) => {
            const text = messages[dotted ?? bracketed ?? '']
            return text === undefined
                ? match
                : `${match} /* ${JSON.stringify(text)} */`
        },
    )
}

/** Matches a hash exactly, or messages whose text contains `query`, ignoring case. */
export function searchMessages(
    messages: Messages,
    query: string,
): [hash: string, text: string][] {
    if (HASH.test(query) && messages[query] !== undefined)
        return [[query, messages[query]]]
    const needle = query.toLowerCase()
    return Object.entries(messages).filter(([, text]) =>
        text.toLowerCase().includes(needle),
    )
}
