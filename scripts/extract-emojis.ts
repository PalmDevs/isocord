/**
 * Extracts the reference client's own Unicode emoji dataset (module 4725: names and aliases,
 * categories, skin tone variants) and its emoticon shortcut table (module 14220) into a compact JSON.
 *
 *   bun scripts/extract-emojis.ts <path-to-discord-mobile-datamining>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = process.argv[2]
if (!root) {
    console.error(
        'usage: bun scripts/extract-emojis.ts <path-to-discord-mobile-datamining>',
    )
    process.exit(1)
}

/** The modules are plain data literals ending in `export default`; evaluate them without a bundler. */
function load(file: string, binding: string): any {
    const source = readFileSync(
        join(resolve(root), '_runtime/metro', file),
        'utf8',
    )
    return new Function(
        `${source
            .replace(/^export default (\w+|\{)/m, (_, head) =>
                head === '{' ? 'return {' : `return ${head}`,
            )
            .replace(/^return (\w+);$/m, `return ${binding};`)}`,
    )()
}

const data = load('04725__.js', 'obj')
const shortcuts = load('14220__.js', 'null')

interface RawEmoji {
    names: string[]
    surrogates: string
    unicodeVersion?: number
    hasDiversity?: boolean
    hasMultiDiversity?: boolean
    hasDiversityParent?: boolean
    diversity?: string[]
    diversityChildren?: number[]
}

const emojis = (data.emojis as RawEmoji[]).map(emoji => {
    const flags =
        (emoji.hasDiversity ? 1 : 0) |
        (emoji.hasMultiDiversity ? 2 : 0) |
        (emoji.hasDiversityParent ? 4 : 0)
    const row: unknown[] = [
        emoji.names,
        emoji.surrogates,
        emoji.unicodeVersion ?? 0,
        flags,
    ]
    const extra = emoji.diversityChildren ?? emoji.diversity
    if (extra) row.push(extra)
    return row
})

const categories = Object.entries(
    data.emojisByCategory as Record<string, [number, number]>,
).map(([name, [start, end]]) => [name, start, end])

writeFileSync(
    resolve(
        import.meta.dir,
        '../android/app/src/main/assets/unicode-emojis.json',
    ),
    JSON.stringify({ categories, emojis, shortcuts }),
)
console.log(`${emojis.length} emojis, ${categories.length} categories`)
