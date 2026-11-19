/** Strips decompiler noise from a datamined file so it costs fewer tokens to read. */
import { posix } from 'node:path'
import { convertJsx } from './jsx.ts'
import { foldObjects } from './objects.ts'
import { escapeRegex, matchClose } from './scan.ts'

const NOISE = [
    /^.*\.fileFinishedImporting\(.*$\n?/gm,
    /^(?:const|let) \w+ = fn\(2\);\n/gm, // Metro's module registry, used only by fileFinishedImporting
    /^\s*const _HermesInternal\d* = HermesInternal;\n/gm,
    /^require = fn;\n/gm,
    /^const ReactCompilerGating = .*;\n/gm,
    /^import _objectWithoutProperties .*\n/gm,
    /\n{3,}/g,
]

/** `gating() ? function A() {compiled} : function A() {plain}` becomes `function A() {plain}`. */
function dropCompiledVariants(source: string): string {
    const marker =
        /ReactCompilerGating\.isReactCompilerEnabled\(\)\s*\?\s*\(?function[^{]*/g
    let output = ''
    let cursor = 0
    for (let match = marker.exec(source); match; match = marker.exec(source)) {
        const end = matchClose(source, match.index + match[0].length) + 1
        const separator = end ? /^\)?\s*:\s*/.exec(source.slice(end)) : null
        if (!separator) continue
        output += source.slice(cursor, match.index)
        cursor = end + separator[0].length
        marker.lastIndex = cursor
    }
    return output + source.slice(cursor)
}

function isReferenced(source: string, name: string): boolean {
    return new RegExp(`(?<![\\w$.])${escapeRegex(name)}(?![\\w$])`).test(source)
}

/** Drops `_runtime` imports that nothing uses, such as Metro helpers and `_modDef123`. */
function dropUnusedRuntimeImports(source: string): string {
    const pattern = /^import (\S+) from "[^"]*\/_runtime\/[^"]+";\n/gm
    return source.replace(pattern, (line, name: string) =>
        isReferenced(source.replace(line, ''), name) ? line : '',
    )
}

// A folder named `native` says nothing about the module, so its imports keep their name.
const GENERIC_FOLDER = 'native'
const INDEX_IMPORT =
    /^import (\S+) from "((?:[^"]*\/)?)(?:index|native)(?:\.(?:native|android|ios))?\.tsx";$/gm

const STRING_LITERAL =
    /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g

/** Renames every use of identifier `old`, leaving string contents alone. */
function renameIdentifier(source: string, old: string, name: string): string {
    const identifier = new RegExp(
        `(?<![\\w$.])${escapeRegex(old)}(?![\\w$])`,
        'g',
    )
    let output = ''
    let cursor = 0
    for (const string of source.matchAll(STRING_LITERAL)) {
        output += source.slice(cursor, string.index).replace(identifier, name)
        output += string[0]
        cursor = string.index + string[0].length
    }
    return output + source.slice(cursor).replace(identifier, name)
}

/** `media-engine` becomes `mediaEngineModule`. */
function moduleName(folder: string): string {
    const camel = folder.replace(/[^\w]+(\w)/g, (_, char: string) =>
        char.toUpperCase(),
    )
    return `${camel}Module`
}

const SHADOW_KINDS = '(?:let|const|var|function|class)'

/**
 * The decompiler names an index or native module after one of its exports
 * (`util` for `intl/index.native.tsx`). Renames it after its folder (`intlModule`)
 * unless the old name already says the folder. Skips a rename when the old name
 * is also declared, defined as a method or used as a key in the file.
 */
function renameIndexImports(source: string): string {
    const here = /^\/\/ (.*)\n/.exec(source)?.[1] ?? ''
    let result = source
    for (const match of source.matchAll(INDEX_IMPORT)) {
        const [line, old, dir] = match as unknown as [string, string, string]
        const folder = posix
            .resolve('/', posix.dirname(here), dir)
            .split('/')
            .at(-1)!
        const flat = (text: string) => text.toLowerCase().replace(/\W|_/g, '')
        const name = moduleName(folder)
        if (
            folder === GENERIC_FOLDER ||
            flat(old).includes(flat(folder)) ||
            isReferenced(result, name)
        )
            continue
        const o = escapeRegex(old)
        const shadowed = new RegExp(
            `${SHADOW_KINDS}\\s+${o}(?![\\w$])|^\\s*(?:async\\s+)?${o}\\s*\\(.*\\)\\s*\\{|(?<![\\w$.])${o}\\s*:`,
            'm',
        )
        if (shadowed.test(result.replace(line, ''))) continue
        result = renameIdentifier(result, old, name)
    }
    return result
}

/** Returns the cleaned source: no compiler variants, noise, unused helpers or `jsx()` calls. */
export function clean(source: string): string {
    let result = dropCompiledVariants(source.replaceAll('\r\n', '\n'))
    for (const pattern of NOISE) result = result.replace(pattern, '')
    result = dropUnusedRuntimeImports(result)
    result = renameIndexImports(result)
    return convertJsx(foldObjects(result))
}
