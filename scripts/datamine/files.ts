/** Locating files in the datamine checkout, a sibling of this repo. */
import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const DATAMINE_ROOT = resolve(
    import.meta.dir,
    '../../../discord-mobile-datamining',
)
/** Source roots searched by default. `_runtime` is bundler helpers, `discord_assets` is images. */
export const SOURCE_ROOTS = ['discord_app', 'discord_common']
const SOURCE_GLOB = '**/*.{tsx,js}'

/** Lists source files as paths relative to the datamine root, under `roots`. */
export function listFiles(roots: string[] = SOURCE_ROOTS): string[] {
    const glob = new Bun.Glob(SOURCE_GLOB)
    return roots.flatMap(root =>
        [...glob.scanSync({ cwd: join(DATAMINE_ROOT, root) })].map(file =>
            join(root, file),
        ),
    )
}

/** Returns the size in bytes of a datamine file. */
export function sizeOf(file: string): number {
    return statSync(join(DATAMINE_ROOT, file)).size
}

/**
 * Resolves a user-given path. Tries it as given, from the datamine root, from
 * `discord_app`, then as a unique file name anywhere. Exits with candidates when ambiguous.
 */
export function resolveFile(arg: string): string {
    for (const base of [
        '',
        DATAMINE_ROOT,
        join(DATAMINE_ROOT, SOURCE_ROOTS[0]!),
    ]) {
        const path = resolve(base || process.cwd(), arg)
        if (existsSync(path) && statSync(path).isFile()) return path
    }
    const needle = `/${arg.replace(/^\/+/, '')}`
    const matches = listFiles().filter(file => `/${file}`.endsWith(needle))
    if (matches.length === 1) return join(DATAMINE_ROOT, matches[0]!)
    console.error(
        matches.length
            ? `Ambiguous ${arg}:\n${matches.join('\n')}`
            : `Not found: ${arg}. Try the find command.`,
    )
    process.exit(1)
}
