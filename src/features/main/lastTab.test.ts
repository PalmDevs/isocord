/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import {
    isRestorableTab,
    LAST_TAB_KEY,
    resolveInitialTab,
    saveLastTab,
} from './lastTab'

describe('lastTab', () => {
    test('isRestorableTab accepts only servers and messages', () => {
        expect(isRestorableTab('servers')).toBe(true)
        expect(isRestorableTab('messages')).toBe(true)
        expect(isRestorableTab('notifications')).toBe(false)
        expect(isRestorableTab('you')).toBe(false)
        expect(isRestorableTab(undefined)).toBe(false)
        expect(isRestorableTab('')).toBe(false)
    })

    test('resolveInitialTab defaults to servers when unset or unknown', () => {
        expect(resolveInitialTab({ getString: () => undefined })).toBe(
            'servers',
        )
        expect(resolveInitialTab({ getString: () => 'unknown' })).toBe(
            'servers',
        )
        expect(resolveInitialTab({ getString: () => 'notifications' })).toBe(
            'servers',
        )
        expect(resolveInitialTab({ getString: () => 'you' })).toBe('servers')
    })

    test('resolveInitialTab restores saved tab', () => {
        expect(resolveInitialTab({ getString: () => 'messages' })).toBe(
            'messages',
        )
        expect(resolveInitialTab({ getString: () => 'servers' })).toBe(
            'servers',
        )
    })

    test('saveLastTab saves servers and messages', () => {
        const saved: Record<string, string> = {}
        const storage = {
            set: (key: string, value: string) => {
                saved[key] = value
            },
        }

        saveLastTab(storage, 'messages')
        expect(saved[LAST_TAB_KEY]).toBe('messages')

        saveLastTab(storage, 'servers')
        expect(saved[LAST_TAB_KEY]).toBe('servers')
    })

    test('saveLastTab ignores notifications and you tabs', () => {
        const saved: Record<string, string> = { [LAST_TAB_KEY]: 'messages' }
        const storage = {
            set: (key: string, value: string) => {
                saved[key] = value
            },
        }

        saveLastTab(storage, 'notifications')
        expect(saved[LAST_TAB_KEY]).toBe('messages')

        saveLastTab(storage, 'you')
        expect(saved[LAST_TAB_KEY]).toBe('messages')

        saveLastTab(storage, undefined)
        expect(saved[LAST_TAB_KEY]).toBe('messages')
    })
})
