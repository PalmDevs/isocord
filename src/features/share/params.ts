import type { SharedContent } from '../../native/NativeIsocordShare'
import type { Message } from '../../stores/readStates'

/** What the share screen sends: a message to forward (ForwardModal), or what another app shared (ShareScreen). */
export type ShareParams =
    | { kind: 'forward'; message: Message }
    | { kind: 'share'; content: SharedContent }
