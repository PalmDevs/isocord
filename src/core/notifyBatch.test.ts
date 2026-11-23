/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { createStore } from 'zustand/vanilla'
import { NotifyBatch } from './notifyBatch'

const counter = () => createStore<{ n: number }>(() => ({ n: 0 }))

describe('NotifyBatch', () => {
    test('notifies a view listener once per batch, with the state from its start', () => {
        const batch = new NotifyBatch()
        const store = counter()
        const calls: Array<[number, number]> = []
        batch
            .view(store)
            .subscribe((state, prev) => calls.push([state.n, prev.n]))
        batch.batched(() => {
            store.setState({ n: 1 })
            store.setState({ n: 2 })
            store.setState({ n: 3 })
            expect(calls).toEqual([])
        })
        expect(calls).toEqual([[3, 0]])
    })

    test('notifies at once outside a batch', () => {
        const batch = new NotifyBatch()
        const store = counter()
        const calls: number[] = []
        batch.view(store).subscribe(state => calls.push(state.n))
        store.setState({ n: 1 })
        expect(calls).toEqual([1])
    })

    test('runs direct subscribers at once inside a batch', () => {
        const batch = new NotifyBatch()
        const store = counter()
        const direct: number[] = []
        store.subscribe(state => direct.push(state.n))
        batch.view(store).subscribe(() => {})
        batch.batched(() => {
            store.setState({ n: 1 })
            store.setState({ n: 2 })
        })
        expect(direct).toEqual([1, 2])
    })

    test('flushes after a throwing batch', () => {
        const batch = new NotifyBatch()
        const store = counter()
        const calls: number[] = []
        batch.view(store).subscribe(state => calls.push(state.n))
        expect(() =>
            batch.batched(() => {
                store.setState({ n: 1 })
                throw new Error('handler')
            }),
        ).toThrow('handler')
        expect(calls).toEqual([1])
    })

    test('holds notifications while paused, then flushes once', async () => {
        const batch = new NotifyBatch()
        const store = counter()
        const calls: Array<[number, number]> = []
        batch
            .view(store)
            .subscribe((state, prev) => calls.push([state.n, prev.n]))
        batch.pause(20)
        batch.batched(() => store.setState({ n: 1 }))
        store.setState({ n: 2 })
        expect(calls).toEqual([])
        await new Promise(resolve => setTimeout(resolve, 40))
        expect(calls).toEqual([[2, 0]])
    })

    test('keeps one view per store, and unsubscribes', () => {
        const batch = new NotifyBatch()
        const store = counter()
        expect(batch.view(store)).toBe(batch.view(store))
        const calls: number[] = []
        const off = batch.view(store).subscribe(state => calls.push(state.n))
        off()
        store.setState({ n: 1 })
        expect(calls).toEqual([])
    })
})
