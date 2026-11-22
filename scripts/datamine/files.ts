/** Locating files in a datamine checkout. The caller sets its path. */
import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

let datamineRoot: string | undefined

/** Sets the datamine checkout that file lookups resolve against. */
export function setDatamineRoot(path: string): void {
    datamineRoot = resolve(path)
}

/** Returns the datamine checkout, failing when no path was given. */
export function getDatamineRoot(): string {
    if (!datamineRoot)
        throw new Error('No datamine path. Pass --datamine <path>.')
    return datamineRoot
}

/** Source roots searched by default. `_runtime` is bundler helpers, `discord_assets` is images. */
export const SOURCE_ROOTS = ['discord_app', 'discord_common']
const SOURCE_GLOB = '**/*.{tsx,js}'

/** Lists source files as paths relative to the datamine root, under `roots`. */
export function listFiles(roots: string[] = SOURCE_ROOTS): string[] {
    const glob = new Bun.Glob(SOURCE_GLOB)
    const root = getDatamineRoot()
    return roots.flatMap(entry =>
        [...glob.scanSync({ cwd: join(root, entry) })].map(file =>
            join(entry, file),
        ),
    )
}

/** Returns the size in bytes of a datamine file. */
export function sizeOf(file: string): number {
    return statSync(join(getDatamineRoot(), file)).size
}

/**
 * Resolves a user-given path. Tries it as given, from the datamine root, from
 * `discord_app`, then as a unique file name anywhere. Exits with candidates when ambiguous.
 */
export function resolveFile(arg: string): string {
    const root = getDatamineRoot()
    for (const base of ['', root, join(root, SOURCE_ROOTS[0]!)]) {
        const path = resolve(base || process.cwd(), arg)
        if (existsSync(path) && statSync(path).isFile()) return path
    }
    const needle = `/${arg.replace(/^\/+/, '')}`
    const matches = listFiles().filter(file => `/${file}`.endsWith(needle))
    if (matches.length === 1) return join(root, matches[0]!)
    console.error(
        matches.length
            ? `Ambiguous ${arg}:\n${matches.join('\n')}`
            : `Not found: ${arg}. Try the find command.`,
    )
    process.exit(1)
}
