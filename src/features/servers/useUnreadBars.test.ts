/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { findUnreadBarTarget } from './useUnreadBars'

test('uses FlashList indexes to find the unread above or below the viewport', () => {
    const unread = { index: 12, mention: false }
    expect(findUnreadBarTarget([unread], 4, 10)).toEqual({
        row: unread,
        edge: 'bottom',
    })
    expect(findUnreadBarTarget([unread], 15, 20)).toEqual({
        row: unread,
        edge: 'top',
    })
})

test('hides the bar once every unread target is visible', () => {
    expect(
        findUnreadBarTarget([{ index: 12, mention: false }], 12, 20),
    ).toBeNull()
})

test('visible normal unreads and mentions leave offscreen normal unreads eligible', () => {
    const visibleUnread = { index: 12, mention: false }
    const visibleMention = { index: 15, mention: true }
    const unread = { index: 22, mention: false }
    expect(
        findUnreadBarTarget([visibleUnread, visibleMention, unread], 12, 20),
    ).toEqual({
        row: unread,
        edge: 'bottom',
    })
})

test('shows an offscreen mention even when a plain unread is visible', () => {
    const unread = { index: 12, mention: false }
    const mention = { index: 22, mention: true }
    expect(findUnreadBarTarget([unread, mention], 12, 20)).toEqual({
        row: mention,
        edge: 'bottom',
    })
})
