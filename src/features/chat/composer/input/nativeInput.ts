import { Commands } from '../../../../native/ChatInputNativeComponent'
import { typedShortcode } from '../parsing/parse'
import { useComposerSlots } from '../parsing/slots'
import { throttle } from '../throttle'
import type { ComponentRef } from 'react'
import type ChatInputNative from '../../../../native/ChatInputNativeComponent'
import type { LocalStore } from '../state/ComposerContext'

export type NativeInput = ComponentRef<typeof ChatInputNative>
type FocusCommand = 'focus' | 'openCustomKeyboard' | 'openSystemKeyboard'

/** What the input reports on every change of its text or selection. */
export interface ChangeEvent {
    start: number
    end: number
    text: string
    editId: number
}

/** The interval at which typed text is restyled. */
const RESTYLE_MS = 200

/**
 * Creates the composer's side of the native input: its view, the text it holds, and the styles of that text.
 * `styleBlocks` returns the style JSON for a text in a channel.
 */
export function createComposerInput(
    store: LocalStore,
    channelId: string,
    currentChannel: () => string,
    styleBlocks: (text: string, channelId: string) => string,
) {
    let native: NativeInput | null = null
    let requestCount = 0
    /** The edit counter of the input's last change event. */
    let editId = -1
    const flushes = new Map<string, (text: string) => void>()
    /** The flush that follows the last setText. Change events are stale until it comes back. */
    let barrier: string | null = null
    /** The text whose styles were last pushed. */
    let styledText: string | null = null
    let pendingFocus: FocusCommand | undefined

    const requestInput = () => {
        if (!store.getState().inputRequested)
            store.setState({ inputRequested: true })
    }

    const restyle = throttle((id: string, text: string, edit: number) => {
        if (!native || input.channelId !== id) return
        Commands.updateTextBlocks(native, styleBlocks(text, id), edit)
    }, RESTYLE_MS)

    const input = {
        /** The chat the input shows. */
        get channelId() {
            return channelId
        },
        set channelId(next: string) {
            if (channelId === next) return
            channelId = next
            pendingFocus = undefined
        },
        focus: (command: FocusCommand = 'focus') => {
            if (native) Commands[command](native)
            else {
                pendingFocus = command
                requestInput()
            }
        },
        blur: () => {
            pendingFocus = undefined
            if (native) Commands.blur(native)
        },
        restyle: () => restyle(input.channelId, store.getState().text, editId),
        cancelRestyle: () => restyle.cancel(),

        /** Returns the text including anything the input has not reported yet. */
        flushText: () =>
            new Promise<string>(resolve => {
                if (!native) return resolve(store.getState().text)
                const requestId = `flush.${++requestCount}`
                flushes.set(requestId, resolve)
                Commands.flushText(native, requestId)
            }),

        /** Replaces the text and puts the cursor at its end. */
        setText: (text: string) => {
            if (native) {
                Commands.setText(native, text)
                // Change events already on their way carry the text this replaces (another chat's draft, the
                // message being edited), and would be saved as this chat's draft. They are dropped until the input
                // confirms the new text. The flush runs after setText on the UI thread, and its event arrives after
                // every change event sent before it (the input's events never coalesce).
                const requestId = `set.${++requestCount}`
                barrier = requestId
                Commands.flushText(native, requestId)
            }
            // setText drops the input's styles: the text is styled again once it reports it.
            styledText = null
            store.setState({
                text,
                selection: { start: text.length, end: text.length },
            })
        },

        /** Sets the selection, including before native attachment. */
        setSelection: (start: number, length: number) => {
            if (native) Commands.setSelectedRange(native, start, length)
            else {
                const size = store.getState().text.length
                const from = Math.max(0, Math.min(start, size))
                store.setState({
                    selection: {
                        start: from,
                        end: Math.min(from + length, size),
                    },
                })
                requestInput()
            }
        },

        /** Replaces a range, returning the local text if the field is detached. */
        replaceRange: (
            location: number,
            length: number,
            text: string,
            keepCursorPosition = false,
        ) => {
            const { text: current, selection } = store.getState()
            const start = Math.max(0, Math.min(location, current.length))
            const end = Math.min(start + Math.max(0, length), current.length)
            const next = current.slice(0, start) + text + current.slice(end)
            if (native) {
                Commands.replaceRange(
                    native,
                    location,
                    length,
                    text,
                    styleBlocks(next, input.channelId),
                    keepCursorPosition,
                    editId,
                )
                return
            }
            const cursor = start + text.length
            const shift = (position: number) =>
                position <= start
                    ? position
                    : position >= end
                      ? position + cursor - end
                      : cursor
            store.setState({
                text: next,
                selection: keepCursorPosition
                    ? {
                          start: shift(selection.start),
                          end: shift(selection.end),
                      }
                    : { start: cursor, end: cursor },
            })
            requestInput()
            return next === current ? undefined : next
        },

        /** The ref callback of the native view. */
        attach: (view: NativeInput | null) => {
            native = view
            // A detached input will not answer the flush that ends the barrier.
            barrier = null
            editId = -1
            if (!view) return
            const focus = pendingFocus
            pendingFocus = undefined
            if (channelId !== currentChannel()) return
            // Hydrate the draft and selection before replaying an early focus request.
            const { text, selection, panel, canSend } = store.getState()
            input.setText(text)
            if (
                selection.start !== text.length ||
                selection.end !== text.length
            ) {
                input.setSelection(
                    selection.start,
                    selection.end - selection.start,
                )
                store.setState({ selection })
            }
            if (focus && canSend && (focus !== 'openCustomKeyboard' || panel))
                Commands[focus](view)
        },

        /** Takes a change event. `onText` hears of a changed text, unless the event is stale. */
        change: (event: ChangeEvent, onText: (text: string) => void) => {
            // Stale: sent before the text was replaced.
            if (barrier !== null) return
            const { start, end, text } = event
            editId = event.editId
            const previous = store.getState().text
            store.setState({ text, selection: { start, end } })
            // The restored draft equals what was set, but its styles have not been computed yet.
            if (text !== styledText) {
                styledText = text
                restyle(input.channelId, text, editId)
            }
            if (text === previous) return
            onText(text)
            if (native)
                replaceTypedShortcode(native, event, previous, next =>
                    styleBlocks(next, input.channelId),
                )
        },

        /** Takes the input's answer to a flush. */
        flushed: (requestId: string, text: string) => {
            if (requestId === barrier) barrier = null
            flushes.get(requestId)?.(text)
            flushes.delete(requestId)
        },
    }

    return input
}

export type ComposerInput = ReturnType<typeof createComposerInput>

/** A `:name:` closed by the colon just typed becomes its Unicode emoji. */
function replaceTypedShortcode(
    native: NativeInput,
    event: ChangeEvent,
    previous: string,
    styleBlocks: (text: string) => string,
) {
    const { start, end, text } = event
    const lookup = useComposerSlots.getState().unicodeEmoji
    const typedColon =
        start === end &&
        text.charAt(start - 1) === ':' &&
        text.slice(0, start - 1) + text.slice(start) === previous
    const typed =
        lookup && typedColon ? typedShortcode(text, start, lookup) : undefined
    if (!typed) return
    const next =
        text.slice(0, typed.location) +
        typed.text +
        text.slice(typed.location + typed.length)
    Commands.replaceRange(
        native,
        typed.location,
        typed.length,
        typed.text,
        styleBlocks(next),
        false,
        event.editId,
    )
}
