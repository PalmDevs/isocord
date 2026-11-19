/**
 * Explores the decompiled Discord app in `../discord-mobile-datamining`.
 *
 *   bun scripts/read-datamine.ts [read] <file> [--lines A-B] [--raw] [--apk <base.apk>]
 *   bun scripts/read-datamine.ts outline <file>
 *   bun scripts/read-datamine.ts find <word>...
 *   bun scripts/read-datamine.ts grep <regex> [dir] [-i] [--max N]   (searches the cleaned text)
 *   bun scripts/read-datamine.ts msg <hash|text> [--apk <base.apk>]
 *
 * `read` prints a file with decompiler noise removed (see scripts/datamine/clean.ts):
 *   - the plain variant of components that also ship a React Compiler variant
 *   - Metro and Hermes bookkeeping, unused runtime imports
 *   - split object building (`obj = { a: null }; obj.a = x`) folded into one literal
 *   - `jsx()` calls as JSX, index imports named after their folder
 *   - message hashes (`t.wsoPhr`) followed by their English text
 * `--raw` prints the file as shipped. Line numbers of `outline` and `--lines` refer to the cleaned text.
 * Start with `find`, then `outline`, then `read --lines`, to avoid reading a whole file.
 * The English messages come from the APK once, then a cache next to node_modules.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { clean } from './datamine/clean.ts'
import {
    DATAMINE_ROOT,
    listFiles,
    resolveFile,
    SOURCE_ROOTS,
    sizeOf,
} from './datamine/files.ts'
import {
    annotateMessages,
    loadMessages,
    searchMessages,
} from './datamine/messages.ts'

const DEFAULT_MAX_MATCHES = 40
const MAX_LINE_WIDTH = 180
const MAX_FIND_RESULTS = 40
const MAX_MESSAGE_RESULTS = 25
const MAX_USAGE_FILES = 5
const BYTES_PER_KB = 1024
// A top-level declaration, or a method of the object or class that follows it.
const DECLARATION =
    /^(?:export )?(?:(?:async )?function\s*\*?\s*\w+|(?:const|let) \w+ = (?:async )?(?:function|\()|class \w+)|^ {2}(?:async |static |get |set )?\w+\(.*\) \{$/
const USAGE_FOLDERS = ['discord_app']

const USAGE = `usage:
  read <file> [--lines A-B] [--raw] [--apk <base.apk>]   (read is the default)
  outline <file>
  find <word>...
  grep <regex> [dir] [-i] [--max N]
  msg <hash|text> [--apk <base.apk>]`

/** Removes `--name value` from `args` and returns the value. */
function takeOption(args: string[], name: string): string | undefined {
    const at = args.indexOf(name)
    return at < 0 ? undefined : args.splice(at, 2)[1]
}

function takeFlag(args: string[], name: string): boolean {
    const at = args.indexOf(name)
    if (at >= 0) args.splice(at, 1)
    return at >= 0
}

function fail(message: string): never {
    console.error(message)
    process.exit(1)
}

function view(file: string, raw: boolean, apk?: string): string {
    const source = readFileSync(file, 'utf8')
    if (raw) return source
    return annotateMessages(clean(source), loadMessages(apk))
}

function read(args: string[]) {
    const apk = takeOption(args, '--apk')
    const range = takeOption(args, '--lines')
    const raw = takeFlag(args, '--raw')
    if (!args[0]) fail(USAGE)
    const text = view(resolveFile(args[0]), raw, apk)
    if (!range) return process.stdout.write(text)
    const [from, to] = range.split('-').map(Number)
    if (!from) fail('--lines takes A-B, such as 120-180')
    const lines = text.split('\n')
    console.log(lines.slice(from - 1, to ?? from).join('\n'))
}

function outline(args: string[]) {
    if (!args[0]) fail(USAGE)
    const lines = view(resolveFile(args[0]), false).split('\n')
    lines.forEach((line, index) => {
        if (DECLARATION.test(line))
            console.log(`${index + 1}\t${line.trim().slice(0, MAX_LINE_WIDTH)}`)
    })
    console.log(`${lines.length} lines`)
}

function find(words: string[]) {
    if (!words.length) fail(USAGE)
    const needles = words.map(word => word.toLowerCase())
    const matches = listFiles().filter(file => {
        const path = file.toLowerCase()
        return needles.every(needle => path.includes(needle))
    })
    for (const file of matches.slice(0, MAX_FIND_RESULTS))
        console.log(`${file}\t${Math.ceil(sizeOf(file) / BYTES_PER_KB)}K`)
    if (matches.length > MAX_FIND_RESULTS)
        console.log(`... ${matches.length - MAX_FIND_RESULTS} more`)
    if (!matches.length) console.log('no files')
}

function grep(args: string[]) {
    const ignoreCase = takeFlag(args, '-i')
    const max = Number(takeOption(args, '--max') ?? DEFAULT_MAX_MATCHES)
    const [source, dir] = args
    if (!source) fail(USAGE)
    const pattern = new RegExp(source, ignoreCase ? 'i' : '')
    let count = 0
    for (const file of listFiles(dir ? [dir] : SOURCE_ROOTS)) {
        const lines = view(join(DATAMINE_ROOT, file), false).split('\n')
        for (const [index, line] of lines.entries()) {
            if (!pattern.test(line)) continue
            if (++count > max)
                return console.log(`... more than ${max}, narrow it`)
            console.log(
                `${file}:${index + 1}: ${line.trim().slice(0, MAX_LINE_WIDTH)}`,
            )
        }
    }
    if (!count) console.log('no matches')
}

/** Lists files that reference message `hash`. */
function usedBy(hash: string): string[] {
    const reference = new RegExp(`\\bt\\.${hash}\\b|\\bt\\["${hash}"\\]`)
    return listFiles(USAGE_FOLDERS)
        .filter(file =>
            reference.test(readFileSync(join(DATAMINE_ROOT, file), 'utf8')),
        )
        .slice(0, MAX_USAGE_FILES)
}

function msg(args: string[]) {
    const apk = takeOption(args, '--apk')
    const query = args.join(' ')
    if (!query) fail(USAGE)
    const found = searchMessages(loadMessages(apk), query)
    for (const [hash, text] of found.slice(0, MAX_MESSAGE_RESULTS)) {
        console.log(`${hash}\t${JSON.stringify(text)}`)
        if (found.length <= MAX_USAGE_FILES)
            for (const file of usedBy(hash)) console.log(`\t${file}`)
    }
    if (found.length > MAX_MESSAGE_RESULTS)
        console.log(`... ${found.length - MAX_MESSAGE_RESULTS} more`)
    if (!found.length) console.log('no messages')
}

const [command, ...rest] = process.argv.slice(2)
if (!command) fail(USAGE)
const commands: Record<string, (args: string[]) => void> = {
    read,
    outline,
    find,
    grep,
    msg,
}
const run = commands[command]
if (run) run(rest)
else read([command, ...rest])
