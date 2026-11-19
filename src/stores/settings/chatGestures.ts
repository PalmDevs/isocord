import { createStore } from 'zustand/vanilla'
import { deviceStorage, readJson, writeJson } from '../../core/storage'

/**
 * Isocord's own chat gesture switches, kept on the device. The reference always copies on these gestures; here
 * each can be turned off in Settings → Chat.
 */
export interface ChatGestureState {
    /** A tap on inline code copies it (onTapInlineCode). */
    tapInlineCodeToCopy: boolean
    /** Holding a part of an embed copies its text (EmbedView's onTapCopyText). */
    holdEmbedToCopy: boolean
}

const STORAGE_KEY = 'chatGestures'

const DEFAULTS: ChatGestureState = {
    tapInlineCodeToCopy: true,
    holdEmbedToCopy: true,
}

export const chatGesturesStore = createStore<ChatGestureState>(() => ({
    ...DEFAULTS,
    ...readJson<Partial<ChatGestureState>>(deviceStorage, STORAGE_KEY),
}))

chatGesturesStore.subscribe(state =>
    writeJson(deviceStorage, STORAGE_KEY, state),
)

export function setChatGesture(
    key: keyof ChatGestureState,
    value: boolean,
): void {
    chatGesturesStore.setState({ [key]: value })
}
