import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native'

export interface NativeProps extends ViewProps {
    /**
     * JSON of a chat `MessageRow` (src/features/chat/rows/rows.ts, decoded as ChatRow.Message in ChatRows.kt). Only its body is
     * drawn: text, rich parts, attachments, embeds and stickers.
     */
    message: string
    /** JSON object of `ChatTheme` (src/features/chat/theme.ts). */
    theme: string
    /** Lines of text shown before it is cut. 0 for no limit. */
    lineClamp?: CodegenTypes.Int32
    /** dp past which the content is cut with a fade. 0 for no limit. */
    maxHeight?: CodegenTypes.Float
    /** The height (dp) the content takes, up to `maxHeight`. The view has no height of its own until JS sets it. */
    onContentHeight?: CodegenTypes.DirectEventHandler<{
        height: CodegenTypes.Double
    }>
}

export default codegenNativeComponent<NativeProps>(
    'IsocordMessagePreviewView',
) as HostComponent<NativeProps>
