/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { computePermissions, Permission } from './permissions'

const ME = 'me'
const VIEW = Permission.VIEW_CHANNEL
const SEND = Permission.SEND_MESSAGES

function guild(everyone: bigint, myRoles: string[] = [], roles = {}) {
    return {
        id: 'g',
        ownerId: 'owner',
        myRoles,
        roles: { g: { permissions: String(everyone) }, ...roles },
    }
}

/** A channel that counts how often its overwrites are read. */
function countingChannel() {
    const reads = { count: 0 }
    const channel = {
        type: 0,
        get permission_overwrites() {
            reads.count++
            return []
        },
    }
    return { channel, reads }
}

describe('computePermissions', () => {
    test('applies everyone, role and member overwrites in order', () => {
        const g = guild(VIEW | SEND, ['r'], {
            r: { permissions: String(Permission.ADD_REACTIONS) },
        })
        const channel = {
            type: 0,
            permission_overwrites: [
                { id: 'g', type: 0, allow: '0', deny: String(SEND) },
                { id: 'r', type: 0, allow: String(SEND), deny: '0' },
                { id: ME, type: 1, allow: '0', deny: String(VIEW) },
            ],
        }
        expect(computePermissions(g, channel, ME)).toBe(
            Permission.ADD_REACTIONS | SEND,
        )
    })

    test('owner and administrator hold every bit', () => {
        expect(computePermissions(guild(0n), undefined, 'owner')).toBe(~0n)
        const admin = guild(0n, ['a'], {
            a: { permissions: String(Permission.ADMINISTRATOR) },
        })
        expect(computePermissions(admin, undefined, ME)).toBe(~0n)
    })

    test('a repeated call for the same guild, channel and user is a lookup', () => {
        const g = guild(VIEW)
        const { channel, reads } = countingChannel()
        const first = computePermissions(g, channel, ME)
        const readsAfterFirst = reads.count
        expect(readsAfterFirst).toBeGreaterThan(0)
        expect(computePermissions(g, channel, ME)).toBe(first)
        expect(reads.count).toBe(readsAfterFirst)
    })

    test('a replaced guild or channel is recomputed', () => {
        const channel = { type: 0 }
        expect(computePermissions(guild(VIEW), channel, ME)).toBe(VIEW)
        expect(computePermissions(guild(VIEW | SEND), channel, ME)).toBe(
            VIEW | SEND,
        )
        const denied = {
            type: 0,
            permission_overwrites: [
                { id: 'g', type: 0, allow: '0', deny: String(VIEW) },
            ],
        }
        const g = guild(VIEW)
        expect(computePermissions(g, channel, ME)).toBe(VIEW)
        expect(computePermissions(g, denied, ME)).toBe(0n)
    })

    test('the user id is part of the key', () => {
        const g = guild(VIEW)
        const channel = {
            type: 0,
            permission_overwrites: [
                { id: 'other', type: 1, allow: String(SEND), deny: '0' },
            ],
        }
        expect(computePermissions(g, channel, 'other')).toBe(VIEW | SEND)
        expect(computePermissions(g, channel, ME)).toBe(VIEW)
    })
})
