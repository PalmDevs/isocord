/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { stubNativeModules } from '../features/chat/rows/nativeStubs'

await stubNativeModules()
const { getLogs, logger, stringifyLogs } = await import('./log')

/** LogAggregator keeps the last 5000 entries. */
const KEPT = 5000

test('keeps the newest entries in order once full', () => {
    const log = logger('Test')
    for (let index = 0; index < KEPT + 3; index++) log.info(String(index))

    const oldestFirst = getLogs().map(entry => entry.message)
    expect(oldestFirst).toHaveLength(KEPT)
    expect(oldestFirst[0]).toBe('3')
    expect(oldestFirst.at(-1)).toBe(String(KEPT + 2))

    const newestFirst = getLogs(true).map(entry => entry.message)
    expect(newestFirst[0]).toBe(String(KEPT + 2))
    expect(newestFirst.at(-1)).toBe('3')

    const lines = stringifyLogs(Number.MAX_SAFE_INTEGER).split('\n')
    expect(lines).toHaveLength(KEPT)
    expect(lines[0]?.endsWith('-> Test -> 3')).toBe(true)
    expect(lines.at(-1)?.endsWith(`-> Test -> ${KEPT + 2}`)).toBe(true)
})
