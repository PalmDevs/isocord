import { codegenNativeComponent } from 'react-native'
import type {
    CodegenTypes,
    ColorValue,
    HostComponent,
    ViewProps,
} from 'react-native'

export interface NativeProps extends ViewProps {
    /** JSON array of `Span` (src/features/chat/rows/rows.ts, decoded as Span in ChatRows.kt). */
    spans: string
    /** JSON object of `ChatTheme` (src/features/chat/theme.ts). */
    theme: string
    color?: ColorValue
    /** sp. */
    fontSize?: CodegenTypes.Float
    /** sp. */
    lineHeight?: CodegenTypes.Float
    /** Drawn bold before the spans, such as "You: ". */
    prefix?: string
    /** Lines shown before the text is cut. 0 for no limit. */
    lineClamp?: CodegenTypes.Int32
    /** PreviewIcon name drawn after the text (`PreviewIcon` in src/features/chat/rows/messagePreview.ts). */
    trailingIcon?: string
    /**
     * Draws the spans as a message body (blocks, quotes, code) and takes touches on links, reported by
     * `onLinkPress`. Other touches pass through. Inline text otherwise, passing every touch.
     */
    markdown?: boolean
    /** Height (dp) of the text, and whether `lineClamp` cut it. The view has no height of its own until JS sets it. */
    onContentHeight?: CodegenTypes.DirectEventHandler<{
        height: CodegenTypes.Double
        truncated: boolean
    }>
    onLinkPress?: CodegenTypes.DirectEventHandler<{ url: string }>
}

export default codegenNativeComponent<NativeProps>(
    'IsocordSpanTextView',
) as HostComponent<NativeProps>
