import { codegenNativeCommands, codegenNativeComponent } from 'react-native'
import type * as React from 'react'
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native'

export interface NativeProps extends ViewProps {
    /**
     * JSON array of sections, top to bottom. See `GridSection` in src/features/expressions/picker/ExpressionGrid.tsx
     * (decoded as GridSection in GridSections.kt). The view splits them into rows for its width.
     */
    sections: string
    /** `emoji` (33dp images in 44dp cells) or `sticker` (64dp images). */
    kind: string
    /** JSON object of `ChatTheme` (src/features/chat/theme.ts). */
    theme: string
    /** Whether animated items play (the user's `animate_emoji`); they hold still while the grid scrolls. */
    animate: boolean
    /** dp below the last row. */
    bottomPadding?: CodegenTypes.Float
    /** An item was tapped. */
    onPressItem?: CodegenTypes.DirectEventHandler<{
        key: string
        flightId: string
    }>
    /** An item was held. */
    onLongPressItem?: CodegenTypes.DirectEventHandler<{ key: string }>
    /** The section at the top of the grid changed (the category rail follows it). */
    onActiveSection?: CodegenTypes.DirectEventHandler<{
        index: CodegenTypes.Int32
    }>
    /** Whether the grid is scrolled to its top (the sheet it is in drags from it then). */
    onAtTop?: CodegenTypes.DirectEventHandler<{ atTop: boolean }>
}

type ComponentType = HostComponent<NativeProps>

interface NativeCommands {
    /** Jumps to the header of the section at `index` (EmojiPickerView's scrollToHeaderIndex). */
    scrollToSection: (
        viewRef: React.ElementRef<ComponentType>,
        index: CodegenTypes.Int32,
    ) => void
}

export const Commands = codegenNativeCommands<NativeCommands>({
    supportedCommands: ['scrollToSection'],
})

export default codegenNativeComponent<NativeProps>(
    'IsocordExpressionGridView',
) as ComponentType
