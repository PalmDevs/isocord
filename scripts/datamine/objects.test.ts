import { describe, expect, test } from 'bun:test'
import { foldObjects } from './objects.ts'

const fold = (...lines: string[]) => foldObjects(lines.join('\n'))

describe('foldObjects', () => {
    test('folds assignments into the declaration', () => {
        expect(
            fold(
                'const obj = { a: null, b: null };',
                'obj.a = x;',
                'obj.b = y;',
                'use(obj);',
            ),
        ).toBe('const obj = { a: x, b: y };\nuse(obj);')
    })

    test('moves the declaration down past unrelated code', () => {
        expect(
            fold(
                'const obj = { sku, a: null };',
                'id = compute();',
                'obj.a = id;',
                'use(obj);',
            ),
        ).toBe('id = compute();\nconst obj = { sku, a: id };\nuse(obj);')
    })

    test('keeps the order when the gap changes a value the literal reads', () => {
        const source = ['const obj = { a: x };', 'x = 2;', 'obj.b = 1;'].join(
            '\n',
        )
        expect(foldObjects(source)).toBe(source)
    })

    test('keeps the order when the gap uses the object', () => {
        const source = [
            'const obj = { a: 1 };',
            'log(obj);',
            'obj.b = 1;',
        ].join('\n')
        expect(foldObjects(source)).toBe(source)
    })

    test('adds missing keys and shorthand', () => {
        expect(fold('o = { a: 1 };', 'o.b = b;', 'o.c = 3;')).toBe(
            'o = { a: 1, b, c: 3 };',
        )
    })

    test('folds arrays with holes', () => {
        expect(
            fold('const items = [, ,];', 'items[0] = a;', 'items[1] = b;'),
        ).toBe('const items = [ a, b ];')
    })

    test('stops at a reassignment', () => {
        expect(
            fold('let obj = { a: 1 };', 'obj = { a: 2 };', 'obj.b = 1;'),
        ).toBe('let obj = { a: 1 };\nobj = { a: 2, b: 1 };')
    })

    test('inlines a props object used once by a jsx call', () => {
        expect(
            fold(
                'const props = { style: s, children: kids };',
                'view = jsx(View, props);',
            ),
        ).toBe('view = jsx(View, { style: s, children: kids });')
    })

    test('keeps a props object used twice', () => {
        const source = [
            'const props = { a: 1 };',
            'jsx(A, props);',
            'jsx(B, props);',
        ].join('\n')
        expect(foldObjects(source)).toBe(source)
    })
})

test('skips an assignment whose value uses the object', () => {
    const source = ['const obj = { a: 1 };', 'obj.b = obj.a;'].join('\n')
    expect(foldObjects(source)).toBe(source)
})
