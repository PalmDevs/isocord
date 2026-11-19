import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native'

export interface NativeProps extends ViewProps {
    /** JSON array of `ChatRow`, newest first. See src/features/chat/rows/rows.ts. */
    rows: string
    /** JSON object of `ChatTheme`. See src/features/chat/theme.ts. */
    theme: string
    /** Identifies the chat, so its scroll position is restored when it is shown again. */
    scrollKey?: string
    /**
     * Scrolls to a message (no `messageId`: the newest one) and optionally flashes it. A new `nonce` makes a new
     * request. One whose `scrollKey` is not the current chat's is ignored. The list waits for the row to exist.
     */
    scrollTarget?: Readonly<{
        scrollKey: string
        messageId?: string
        nonce: CodegenTypes.Int32
        flash: boolean
    }>
    /**
     * A message the jump button leads back to instead of the present (a search result's preview): the button shows
     * while that message is off screen, points toward it, and scrolls to it with a flash.
     */
    jumpTarget?: string
    /** The message the composer is replying to or editing: highlighted until it is sent or cancelled. */
    composerTargetId?: string
    /**
     * dp at the bottom of the list that something floats over (the chat input overlaps the list). The newest
     * message rests above it, and the jump button with it.
     */
    bottomInset?: CodegenTypes.Float
    /**
     * dp the typing indicator adds above the chat input while it is up. Unlike `bottomInset`, a change is animated
     * (the list is pushed up and let back down), with the indicator's own spring.
     */
    typingInset?: CodegenTypes.Float
    /**
     * `nativeID` of the composer's floating part over the list. While the list is scrolled away from the newest
     * message, a change of that view's height (a reply bar, more lines) is kept from moving the messages; the
     * keyboard and panels below it still push the list.
     */
    composerNativeId?: string
    /** The list is near its oldest row and wants more history. */
    onLoadOlder?: CodegenTypes.DirectEventHandler<null>
    /** The list is near its newest row while it ends in a loading row (a detached window, see `loadNewerMessages`). */
    onLoadNewer?: CodegenTypes.DirectEventHandler<null>
    /** The jump button was pressed while the list is a detached window: JS must load the newest page. */
    onJumpToPresent?: CodegenTypes.DirectEventHandler<null>
    onLinkPress?: CodegenTypes.DirectEventHandler<{ url: string }>
    /** The first frame with real rows for `scrollKey` has been drawn. */
    onRowsDrawn?: CodegenTypes.DirectEventHandler<{ scrollKey: string }>
    /** The list came to rest at, or left, the newest message (within a small buffer): new messages are read at once. */
    onAtBottomChange?: CodegenTypes.DirectEventHandler<{
        scrollKey: string
        atBottom: boolean
    }>
    /** `media`: the held media tile's link without its origin (`isocord://media/<id>/<index>`), or "" off media. */
    onMessageLongPress?: CodegenTypes.DirectEventHandler<{
        messageId: string
        media: string
    }>
    /** A message was swiped left past the threshold: replies, or edits after a longer pull (rows with `swipe`). */
    onMessageSwipe?: CodegenTypes.DirectEventHandler<{
        messageId: string
        action: string
    }>
}

export default codegenNativeComponent<NativeProps>(
    'IsocordChatView',
) as HostComponent<NativeProps>
