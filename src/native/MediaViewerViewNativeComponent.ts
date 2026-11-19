import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native'

export interface NativeProps extends ViewProps {
    /** JSON array of `ViewerSource` (src/features/mediaViewer/sources.ts, decoded as ViewerSource in MediaViewer.kt). */
    sources: string
    /** The source the viewer opens on, which grows out of `origin`. */
    initialIndex?: CodegenTypes.Int32
    /** The tapped tile in the window (dp). */
    origin?: Readonly<{
        x: CodegenTypes.Float
        y: CodegenTypes.Float
        width: CodegenTypes.Float
        height: CodegenTypes.Float
    }>
    /** JSON of the chat `MessageRow` drawn in the footer (without its media). Empty for no message. */
    message?: string
    /** JSON object of `ChatTheme` for the footer (src/features/chat/theme.ts). */
    theme: string
    /** The text of the footer's add reaction button. */
    reactLabel: string
    /** The text of the button that shows the alt text. */
    altLabel: string
    /** Set to close the viewer: the media slides away, then `onClosed`. */
    closeRequested?: boolean
    /** dp of system navigation below the footer. */
    bottomInset?: CodegenTypes.Float
    onIndexChange?: CodegenTypes.DirectEventHandler<{
        index: CodegenTypes.Int32
    }>
    /** Whether the header should show: not hidden by a tap, no swipe under way, not closing. */
    onOverlayChange?: CodegenTypes.DirectEventHandler<{ visible: boolean }>
    /** The close animation started (a swipe or `closeRequested`): the header goes at once. */
    onClosing?: CodegenTypes.DirectEventHandler<null>
    /** The close animation finished. */
    onClosed?: CodegenTypes.DirectEventHandler<null>
    /**
     * A link in the footer (reactions, mentions, the author...): an `isocord://` action or a web link. Also the
     * viewer's own: `isocord://viewer/options/<index>` (a long press on the media), `isocord://viewer/alt/<index>`.
     */
    onLinkPress?: CodegenTypes.DirectEventHandler<{ url: string }>
}

export default codegenNativeComponent<NativeProps>(
    'IsocordMediaViewerView',
) as HostComponent<NativeProps>
