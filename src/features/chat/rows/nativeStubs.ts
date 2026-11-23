/// <reference types="bun" />
import { mock } from 'bun:test'

/** Native constants the row builders read at import. */
const CONSTANTS: Record<string, unknown> = { avatarSize: 40 }

/** A value that stands in for any native API: every property and call returns it again. */
const anything: unknown = new Proxy(function stub() {}, {
    get: (_, key) => {
        if (key === Symbol.toPrimitive) return () => 0
        if (key === 'then') return undefined
        if (key === 'getConstants')
            return () =>
                new Proxy(CONSTANTS, { get: (t, k) => t[k as string] ?? '' })
        return anything
    },
    apply: () => anything,
    construct: () => anything as object,
})

/** Packages that need the React Native runtime. Plain JS packages, such as the markdown parser, stay real. */
const NATIVE =
    /^(react-native|expo|@react-navigation|@shopify|@hcaptcha|@tanstack)/

/** The app's sources, wherever `bun test` runs from. */
const SRC = `${import.meta.dir}/../../..`

const IMPORT =
    /import\s+(?!type\b)(\w+\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+'([^'.][^']*)'/g

/**
 * Replaces every package the app imports with stubs, so code that builds rows runs under `bun test`.
 * The named exports come from the app's own imports.
 */
export async function stubNativeModules() {
    Object.assign(globalThis, { __DEV__: false, ErrorUtils: anything })
    // Imported by packages, not by the app.
    const names = new Map([
        [
            'expo',
            new Set([
                'requireNativeModule',
                'requireOptionalNativeModule',
                'requireNativeView',
                'UnavailabilityError',
                'CodedError',
                'EventEmitter',
                'LegacyEventEmitter',
                'NativeModule',
                'SharedObject',
                'SharedRef',
                'Platform',
                'PermissionStatus',
                'createPermissionHook',
                'registerWebModule',
                'uuid',
            ]),
        ],
    ])
    const files = new Bun.Glob('**/*.{ts,tsx}').scan({
        cwd: SRC,
        absolute: true,
    })
    for await (const path of files) {
        for (const match of (await Bun.file(path).text()).matchAll(IMPORT)) {
            const [, , named = '', pkg = ''] = match
            if (!NATIVE.test(pkg)) continue
            const set = names.get(pkg) ?? new Set()
            for (const part of named.split(',')) {
                const name = part.trim().split(/\s+as\s+/)[0]
                if (name && !name.startsWith('type ')) set.add(name)
            }
            names.set(pkg, set)
        }
    }
    for (const [pkg, set] of names)
        mock.module(pkg, () => ({
            __esModule: true,
            default: anything,
            ...Object.fromEntries([...set].map(name => [name, anything])),
        }))
}
