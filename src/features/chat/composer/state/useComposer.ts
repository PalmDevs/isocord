import { createContext, use } from 'react'
import { useStore } from 'zustand'
import type { ChangeEvent, NativeInput } from '../input/nativeInput'
import type { ComposerApi, ComposerState, LocalStore } from './ComposerContext'

export interface Internals {
    store: LocalStore
    /** The ref callback of the native input. */
    attachNative: (view: NativeInput | null) => void
    onSelectionOrTextChange: (event: { nativeEvent: ChangeEvent }) => void
    onTextFlushed: (event: {
        nativeEvent: { text: string; requestId: string }
    }) => void
}

export const ApiContext = createContext<ComposerApi | null>(null)

export const InternalContext = createContext<Internals | null>(null)

/** The composer API of the chat this is rendered in. */
export function useComposer(): ComposerApi {
    const api = use(ApiContext)
    if (!api) throw new Error('useComposer must be used inside a Composer')
    return api
}

export function useComposerInternals(): Internals {
    const internals = use(InternalContext)
    if (!internals)
        throw new Error('The composer must be inside ComposerProvider')
    return internals
}

/**
 * Subscribes to the composer's reactive state: text, selection, focus, keyboard, the open panel, whether the user
 * can send and the slowmode left.
 */
export function useComposerState<T>(selector: (state: ComposerState) => T): T {
    return useStore(useComposerInternals().store, selector)
}
