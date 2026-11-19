import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native'

export interface NativeProps extends ViewProps {
    /** The message the chips' links name. */
    messageId: string
    /** JSON array of the chat's `ReactionRow` (src/features/chat/rows/rows.ts, decoded as Reaction in ChatRows.kt). */
    reactions: string
    /** JSON object of `ChatTheme` (src/features/chat/theme.ts). */
    theme: string
    /** The size (dp) the chips take on one line. The view has no size of its own until JS sets it. */
    onContentSize?: CodegenTypes.DirectEventHandler<{
        width: CodegenTypes.Double
        height: CodegenTypes.Double
    }>
    /** A chip's `isocord://` link (react or reactions), as the chat reports it. */
    onLinkPress?: CodegenTypes.DirectEventHandler<{ url: string }>
}

export default codegenNativeComponent<NativeProps>(
    'IsocordReactionsView',
) as HostComponent<NativeProps>
