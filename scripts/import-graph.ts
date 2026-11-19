/**
 * Maps the bundle's runtime import graph and checks it against Metro's Fast Refresh.
 *   - lists import cycles, with the edges that close each one
 *   - lists modules whose edit forces a full reload, grouped by cause
 *   - lists component files that also export values
 *
 *   bun scripts/import-graph.ts            full report
 *   bun scripts/import-graph.ts --cycles   cycles only
 *   bun scripts/import-graph.ts --why <file>
 *   bun scripts/import-graph.ts --json
 *   bun scripts/import-graph.ts --check    exits 1 on any cycle or full-reload component
 *   bun scripts/import-graph.ts --cut <from>=<to> ...   previews the graph without an import
 *
 * Mirrors `metroHotUpdateModule` and `isReactRefreshBoundary` in metro-runtime's require.js.
 * An edit walks up through importers until every path ends at a boundary.
 * A boundary is a module whose exports are all components.
 * A path that reaches the entry, or a cycle among non-boundaries, forces a full reload.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(import.meta.dir, '..')
const ENTRY = join(ROOT, 'index.js')
const SOURCE_DIR = join(ROOT, 'src')
const SOURCE_FILE = /\.(tsx?|js)$/
const SKIPPED_FILE = /\.(test\.tsx?|d\.ts)$/
/** Suffixes Metro tries, in order, for an extensionless import. */
const RESOLVE_SUFFIXES = [
    '',
    '.android.tsx',
    '.android.ts',
    '.tsx',
    '.ts',
    '.js',
    '/index.tsx',
    '/index.ts',
    '/index.js',
]
const args = process.argv.slice(2)
/** Import edges left out with `--cut from=to`, to preview a refactor. */
const cuts = new Set(
    args
        .flatMap((arg, i) => (args[i - 1] === '--cut' ? [arg] : []))
        .map(edge =>
            edge
                .split('=')
                .map(file => resolve(file))
                .join('='),
        ),
)
/** Calls whose result react-refresh treats as a component (`$$typeof` memo or forward_ref, or a named function). */
const COMPONENT_WRAPPERS =
    /(^|\.)(memo|forwardRef|withUnistyles|createAnimatedComponent)$/

type Export = { name: string; component: boolean; why: string }
type Module = {
    file: string
    deps: Set<string>
    parents: string[]
    exports: Export[]
}
type Walk = {
    reachesEntry: string[] | null
    cycles: string[][]
    through: string[]
    pathTo: (file: string) => string[]
}

const rel = (file: string) => relative(ROOT, file)
const isUpper = (name: string) => /^[A-Z]/.test(name)

function listSources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) listSources(path, out)
        else if (SOURCE_FILE.test(name) && !SKIPPED_FILE.test(name))
            out.push(path)
    }
    return out
}

const sources = new Set([ENTRY, ...listSources(SOURCE_DIR)])

/** Returns the source file a relative specifier points to, or null for packages. */
function resolveImport(from: string, specifier: string): string | null {
    if (!specifier.startsWith('.')) return null
    const base = resolve(dirname(from), specifier)
    for (const suffix of RESOLVE_SUFFIXES)
        if (sources.has(base + suffix)) return base + suffix
    return null
}

/** Returns the value imports Babel keeps, after type-only and unused imports are elided. */
function runtimeDeps(file: string, text: string): Set<string> {
    const output = ts.transpileModule(text, {
        fileName: file,
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ESNext,
            jsx: ts.JsxEmit.Preserve,
            isolatedModules: true,
        },
    }).outputText
    const tree = ts.createSourceFile(
        `${file}.out.tsx`,
        output,
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.TSX,
    )
    const deps = new Set<string>()
    const add = (specifier: ts.Node | undefined) => {
        const target =
            specifier && ts.isStringLiteral(specifier)
                ? resolveImport(file, specifier.text)
                : null
        if (target) deps.add(target)
    }
    const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
            add(node.moduleSpecifier)
        if (
            ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) &&
                    node.expression.text === 'require'))
        )
            add(node.arguments[0])
        ts.forEachChild(node, visit)
    }
    visit(tree)
    return deps
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some(m => m.kind === kind) ?? false)

/** Classifies a `const` initializer the way react-refresh's `isLikelyComponentType` sees its value. */
function classifyValue(
    name: string,
    init: ts.Expression | undefined,
    tree: ts.SourceFile,
): [boolean, string] {
    let value = init
    while (
        value &&
        (ts.isAsExpression(value) ||
            ts.isSatisfiesExpression(value) ||
            ts.isParenthesizedExpression(value))
    )
        value = value.expression
    if (!value) return [false, 'declared']
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
        return isUpper(name) ? [true, 'function'] : [false, 'function']
    if (ts.isCallExpression(value)) {
        const callee = value.expression.getText(tree)
        return COMPONENT_WRAPPERS.test(callee)
            ? [true, callee]
            : [false, `${callee}()`]
    }
    if (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value))
        return isUpper(value.getText(tree).split('.').pop() ?? '')
            ? [true, 'alias']
            : [false, 'alias']
    if (ts.isObjectLiteralExpression(value)) return [false, 'object']
    if (ts.isArrayLiteralExpression(value)) return [false, 'array']
    return [false, 'constant']
}

type Reexport = {
    from: string
    names: [exported: string, imported: string][] | 'all'
}

/** Returns a file's own value exports and its `export ... from` clauses. */
function readExports(
    file: string,
    text: string,
): { own: Export[]; reexports: Reexport[] } {
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true)
    const own: Export[] = []
    const locals = new Map<string, [boolean, string]>()
    const named: [exported: string, local: string][] = []
    const reexports: Reexport[] = []
    for (const statement of tree.statements) {
        const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword)
        const asDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
        if (hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) continue
        if (ts.isFunctionDeclaration(statement)) {
            const name = statement.name?.text
            // Babel names an anonymous default function `_default`, which is lowercase.
            const kind: [boolean, string] =
                name && isUpper(name) ? [true, 'function'] : [false, 'function']
            if (name) locals.set(name, kind)
            if (exported)
                own.push({
                    name: asDefault ? 'default' : (name ?? 'default'),
                    component: kind[0],
                    why: kind[1],
                })
        } else if (ts.isClassDeclaration(statement)) {
            const component =
                statement.heritageClauses?.some(h =>
                    /Component\b/.test(h.getText(tree)),
                ) ?? false
            const name = statement.name?.text ?? 'default'
            locals.set(name, [component, 'class'])
            if (exported)
                own.push({
                    name: asDefault ? 'default' : name,
                    component,
                    why: 'class',
                })
        } else if (ts.isVariableStatement(statement)) {
            for (const decl of statement.declarationList.declarations) {
                if (!ts.isIdentifier(decl.name)) {
                    if (exported)
                        own.push({
                            name: decl.name.getText(tree),
                            component: false,
                            why: 'destructured',
                        })
                    continue
                }
                const kind = classifyValue(
                    decl.name.text,
                    decl.initializer,
                    tree,
                )
                locals.set(decl.name.text, kind)
                if (exported)
                    own.push({
                        name: decl.name.text,
                        component: kind[0],
                        why: kind[1],
                    })
            }
        } else if (ts.isEnumDeclaration(statement) && exported) {
            own.push({
                name: statement.name.text,
                component: false,
                why: 'enum',
            })
        } else if (
            ts.isExportAssignment(statement) &&
            !statement.isExportEquals
        ) {
            const value = statement.expression
            if (ts.isIdentifier(value)) named.push(['default', value.text])
            else if (
                ts.isArrowFunction(value) ||
                ts.isFunctionExpression(value)
            )
                own.push({
                    name: 'default',
                    component: false,
                    why: 'anonymous function',
                })
            else {
                const [component, why] = classifyValue('Default', value, tree)
                own.push({ name: 'default', component, why })
            }
        } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
            const from = statement.moduleSpecifier
            const target =
                from && ts.isStringLiteral(from)
                    ? resolveImport(file, from.text)
                    : null
            const clause = statement.exportClause
            if (!clause) {
                if (target) reexports.push({ from: target, names: 'all' })
            } else if (ts.isNamespaceExport(clause)) {
                own.push({
                    name: clause.name.text,
                    component: false,
                    why: 'namespace',
                })
            } else {
                const pairs = clause.elements
                    .filter(e => !e.isTypeOnly)
                    .map(
                        e =>
                            [
                                e.name.text,
                                (e.propertyName ?? e.name).getText(tree),
                            ] as [string, string],
                    )
                if (target) reexports.push({ from: target, names: pairs })
                else named.push(...pairs)
            }
        }
    }
    for (const [name, local] of named) {
        const kind = locals.get(local)
        // Type aliases and interfaces have no local value binding.
        if (kind) own.push({ name, component: kind[0], why: kind[1] })
        else if (!isTypeName(tree, local))
            own.push({ name, component: isUpper(local), why: 'imported' })
    }
    return { own, reexports }
}

function isTypeName(tree: ts.SourceFile, name: string): boolean {
    return tree.statements.some(
        s =>
            (ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) &&
            s.name.text === name,
    )
}

const parsed = new Map<
    string,
    { deps: Set<string>; own: Export[]; reexports: Reexport[] }
>()
for (const file of sources) {
    const text = readFileSync(file, 'utf8')
    parsed.set(file, {
        deps: runtimeDeps(file, text),
        ...readExports(file, text),
    })
}

/** Returns a file's exports with `export ... from` clauses flattened. */
function flatExports(file: string, seen = new Set<string>()): Export[] {
    const entry = parsed.get(file)
    if (!entry || seen.has(file)) return []
    seen.add(file)
    const out = [...entry.own]
    for (const { from, names } of entry.reexports) {
        const source = flatExports(from, seen)
        const via = (e: Export) => ({ ...e, why: `${e.why} via ${rel(from)}` })
        if (names === 'all')
            out.push(...source.filter(e => e.name !== 'default').map(via))
        else
            for (const [exported, imported] of names) {
                const match = source.find(e => e.name === imported)
                if (match) out.push({ ...via(match), name: exported })
            }
    }
    return out
}

/** Returns the modules Metro bundles: everything the entry reaches through runtime imports. */
function bundle(): Map<string, Module> {
    const modules = new Map<string, Module>()
    const queue = [ENTRY]
    while (queue.length) {
        const file = queue.pop() as string
        if (modules.has(file)) continue
        const deps = new Set(
            [...(parsed.get(file)?.deps ?? [])].filter(
                dep => !cuts.has(`${file}=${dep}`),
            ),
        )
        modules.set(file, {
            file,
            deps,
            parents: [],
            exports: flatExports(file),
        })
        queue.push(...deps)
    }
    for (const mod of modules.values())
        for (const dep of mod.deps) modules.get(dep)?.parents.push(mod.file)
    return modules
}

const modules = bundle()
const isBoundary = (mod: Module) =>
    mod.exports.length > 0 && mod.exports.every(e => e.component)
/** A `.tsx` file, which defines components whether or not it exports one. */
const isComponentFile = (mod: Module) => mod.file.endsWith('.tsx')

/** Returns strongly connected groups of two or more modules, using Tarjan's algorithm. */
function stronglyConnected(
    nodes: string[],
    edges: (file: string) => Iterable<string>,
): string[][] {
    const index = new Map<string, number>()
    const low = new Map<string, number>()
    const stack: string[] = []
    const onStack = new Set<string>()
    const groups: string[][] = []
    const connect = (node: string) => {
        index.set(node, index.size)
        low.set(node, index.get(node) as number)
        stack.push(node)
        onStack.add(node)
        for (const next of edges(node)) {
            if (!index.has(next)) {
                connect(next)
                low.set(
                    node,
                    Math.min(low.get(node) as number, low.get(next) as number),
                )
            } else if (onStack.has(next))
                low.set(
                    node,
                    Math.min(
                        low.get(node) as number,
                        index.get(next) as number,
                    ),
                )
        }
        if (low.get(node) !== index.get(node)) return
        const group: string[] = []
        let member: string | undefined
        do {
            member = stack.pop() as string
            onStack.delete(member)
            group.push(member)
        } while (member !== node)
        if (group.length > 1) groups.push(group.sort())
    }
    for (const node of nodes) if (!index.has(node)) connect(node)
    return groups.sort((a, b) => b.length - a.length)
}

const importCycles = stronglyConnected(
    [...modules.keys()],
    file => modules.get(file)?.deps ?? [],
)
/** Cycles Metro's walk can enter: every member is a non-boundary, so the walk passes through. */
const refreshCycles = stronglyConnected(
    [...modules.values()].filter(m => !isBoundary(m)).map(m => m.file),
    file =>
        (modules.get(file)?.parents ?? []).filter(
            p => !isBoundary(modules.get(p) as Module),
        ),
)

/** Walks up from an edited module as Metro does, collecting every cause of a full reload. */
function walk(start: string): Walk {
    const seen = new Set<string>()
    const from = new Map<string, string>()
    const queue = [start]
    let reachesEntry: string[] | null = null
    const pathTo = (file: string) => {
        const path = [file]
        for (let at = from.get(file); at; at = from.get(at)) path.push(at)
        return path.reverse()
    }
    while (queue.length) {
        const file = queue.shift() as string
        if (seen.has(file)) continue
        seen.add(file)
        const mod = modules.get(file) as Module
        if (isBoundary(mod)) continue
        if (mod.parents.length === 0 && !reachesEntry)
            reachesEntry = pathTo(file)
        for (const parent of mod.parents)
            if (!seen.has(parent)) {
                if (!from.has(parent)) from.set(parent, file)
                queue.push(parent)
            }
    }
    const through = [...seen].filter(f => !isBoundary(modules.get(f) as Module))
    const cycles = refreshCycles.filter(group => group.some(f => seen.has(f)))
    return { reachesEntry, cycles, through, pathTo }
}

/** Returns the import edges that keep a cycle closed. */
function cycleEdges(group: string[]): string[] {
    const members = new Set(group)
    return group.flatMap(file =>
        [...(modules.get(file)?.deps ?? [])]
            .filter(d => members.has(d))
            .map(d => `${rel(file)} -> ${rel(d)}`),
    )
}

const formatExports = (mod: Module) =>
    mod.exports
        .filter(e => !e.component)
        .map(e => `${e.name} (${e.why})`)
        .join(', ')

function printCycles() {
    console.log(`## Import cycles (${importCycles.length})\n`)
    for (const group of importCycles) {
        const live = refreshCycles.some(r => r.some(f => group.includes(f)))
        console.log(
            `- ${group.length} modules${live ? ', breaks Fast Refresh' : ''}`,
        )
        for (const edge of cycleEdges(group)) console.log(`    ${edge}`)
    }
    console.log()
}

function printReport() {
    printCycles()
    const all = [...modules.values()].map(mod => ({
        mod,
        walk: walk(mod.file),
    }))
    const failing = all.filter(r => r.walk.reachesEntry || r.walk.cycles.length)
    console.log(
        `## Full reloads (${failing.length} of ${modules.size} modules)\n`,
    )
    const byCause = new Map<string, Module[]>()
    for (const { mod, walk: w } of failing) {
        const causes = [
            ...w.cycles.map(c => `cycle: ${c.map(rel).join(', ')}`),
            ...(w.reachesEntry ? ['reaches index.js'] : []),
        ]
        for (const cause of causes)
            byCause.set(cause, [...(byCause.get(cause) ?? []), mod])
    }
    for (const [cause, mods] of byCause) {
        const components = mods.filter(isComponentFile)
        console.log(
            `- ${cause}: ${mods.length} modules, ${components.length} component files`,
        )
        for (const mod of components) console.log(`    ${rel(mod.file)}`)
    }
    const mixed = all.filter(r => isComponentFile(r.mod) && !isBoundary(r.mod))
    console.log(
        `\n## Component files that are not boundaries (${mixed.length})\n`,
    )
    for (const { mod, walk: w } of mixed) {
        const result =
            w.reachesEntry || w.cycles.length
                ? 'full reload'
                : `hot, ${w.through.length - 1} importers re-run`
        const components = mod.exports.filter(e => e.component).length
        console.log(
            `- ${rel(mod.file)} [${result}, ${components} component exports]\n    ${formatExports(mod)}`,
        )
    }
}

function printWhy(target: string) {
    const mod = modules.get(resolve(target))
    if (!mod) throw new Error(`${target} is not in the bundle`)
    const w = walk(mod.file)
    console.log(
        `${rel(mod.file)}: ${isBoundary(mod) ? 'boundary' : 'not a boundary'}`,
    )
    for (const e of mod.exports)
        console.log(
            `  export ${e.name}: ${e.component ? 'component' : 'value'} (${e.why})`,
        )
    console.log(`  importers: ${mod.parents.map(rel).join(', ') || 'none'}`)
    if (w.reachesEntry)
        console.log(
            `  reaches the entry: ${w.reachesEntry.map(rel).join(' -> ')}`,
        )
    for (const c of w.cycles) {
        const entered = c.find(f => w.through.includes(f)) as string
        console.log(
            `  importer chain: ${w.pathTo(entered).map(rel).join(' -> ')}`,
        )
        console.log(`  enters cycle:\n    ${cycleEdges(c).join('\n    ')}`)
    }
    const blockers = w.through
        .filter(f => f !== mod.file)
        .map(f => modules.get(f) as Module)
    if (blockers.length)
        console.log(`  non-boundaries on the way up: ${blockers.length}`)
    for (const b of blockers.filter(isComponentFile))
        console.log(`    ${rel(b.file)}: ${formatExports(b)}`)
    if (!w.reachesEntry && !w.cycles.length)
        console.log('  hot-updates without a full reload')
}

function printJson() {
    const out = [...modules.values()].map(mod => {
        const w = walk(mod.file)
        return {
            file: rel(mod.file),
            boundary: isBoundary(mod),
            imports: [...mod.deps].map(rel),
            exports: mod.exports,
            fullReload: Boolean(w.reachesEntry || w.cycles.length),
            reruns: w.through.filter(f => f !== mod.file).map(rel),
        }
    })
    console.log(
        JSON.stringify(
            { cycles: importCycles.map(g => g.map(rel)), modules: out },
            null,
            2,
        ),
    )
}

if (args.includes('--json')) printJson()
else if (args.includes('--cycles')) printCycles()
else if (args.includes('--why')) printWhy(args[args.indexOf('--why') + 1] ?? '')
else if (args.includes('--check')) {
    const broken = [...modules.values()].filter(m => {
        const w = walk(m.file)
        return isComponentFile(m) && (w.reachesEntry || w.cycles.length)
    })
    printCycles()
    for (const mod of broken) console.log(`full reload: ${rel(mod.file)}`)
    process.exit(importCycles.length || broken.length ? 1 : 0)
} else printReport()
