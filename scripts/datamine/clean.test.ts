import { describe, expect, test } from 'bun:test'
import { clean } from './clean.ts'
import { convertJsx } from './jsx.ts'

describe('convertJsx', () => {
    test('literal props and child', () => {
        const source =
            'jsx(View, { style: s, pointerEvents: "none", flag: true, children: jsx(Text, { value }) }, key)'
        expect(convertJsx(source)).toBe(
            '<View style={s} pointerEvents="none" flag key={key}>\n  <Text value={value} />\n</View>',
        )
    })

    test('variable props spread', () => {
        expect(convertJsx('x = jsx(Image, obj1);')).toBe(
            'x = <Image {...obj1} />;',
        )
    })

    test('children placeholder stays visible', () => {
        expect(convertJsx('jsx(A, { children: null })')).toBe(
            '<A children={null} />',
        )
    })

    test('unsupported shape stays a call', () => {
        expect(convertJsx('jsx(A, { [k]: 1 })')).toBe('jsx(A, { [k]: 1 })')
    })

    test('array children and braces in strings', () => {
        const source = 'jsxs(A, { label: "a}b", children: [x, jsx(B, {})] })'
        expect(convertJsx(source)).toBe(
            '<A label={"a}b"}>\n  {x}\n  <B />\n</A>',
        )
    })
})

describe('clean', () => {
    const header = '// discord_app/intl/Thing.tsx\r\n'

    test('drops noise with CRLF endings', () => {
        const source = `${header}const size = fn(2);\r\nlet result = size.fileFinishedImporting("intl/Thing.tsx");\r\nrequire = fn;\r\nconst a = 1;\r\n`
        expect(clean(source)).toBe(
            '// discord_app/intl/Thing.tsx\nconst a = 1;\n',
        )
    })

    test('keeps the plain variant of a compiled component', () => {
        const source = `${header}const C = ReactCompilerGating.isReactCompilerEnabled() ? function C() {\n  return { a: "{" };\n} : function C() {\n  return 1;\n};\n`
        expect(clean(source)).toContain('function C() {\n  return 1;')
        expect(clean(source)).not.toContain('"{"')
    })

    test('drops unused runtime imports only', () => {
        const source = `${header}import c from "../../_runtime/00576_c.js";\nimport used from "../../_runtime/metro/00001__.js";\nused.x();\n`
        const out = clean(source)
        expect(out).not.toContain('00576_c')
        expect(out).toContain('import used')
    })

    test('renames index imports after their folder, outside strings', () => {
        const source = `${header}import util from "index.native.tsx";\nconst intl = util.intl;\nconst s = "util";\n`
        const out = clean(source)
        expect(out).toContain('import intlModule from "index.native.tsx";')
        expect(out).toContain('intlModule.intl')
        expect(out).toContain('"util"')
    })
})
