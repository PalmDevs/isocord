import { codegenNativeCommands, codegenNativeComponent } from 'react-native'
import type {
    CodegenTypes,
    ColorValue,
    HostComponent,
    ViewProps,
} from 'react-native'

/**
 * The composer's text field, modelled on the reference's DCDChatInput
 * (discord_common/js/packages/rtn-codegen/js/ChatInputNativeComponent.tsx).
 * Native side: android/.../isocord/input/ChatInputView.kt.
 */
export interface NativeProps extends ViewProps {
    textColor?: ColorValue
    editable?: boolean
    shouldShowCursor?: boolean
    placeholder?: string
    placeholderColor?: ColorValue
    /** Title of the "mark as spoiler" item in the selection menu. */
    markAsSpoilerTitle?: string
    /** Android's keyboard has no appearance of its own. */
    keyboardAppearance?: CodegenTypes.WithDefault<'dark' | 'light', 'dark'>
    selectionColor?: ColorValue
    /** IME_FLAG_NO_EXTRACT_UI. */
    setNoExtractUI?: boolean
    keyboardType?: string
    /** dp. The reported content height never exceeds it; the field scrolls beyond. */
    maxHeight?: CodegenTypes.Float
    /** dp of padding above and below the text. */
    verticalInset?: CodegenTypes.Float
    /** Adds the spoiler item to the selection menu. */
    showFormatMenu?: boolean

    /** Content height in dp, clamped to `maxHeight`. */
    onChangeContentSize?: CodegenTypes.DirectEventHandler<{
        height: CodegenTypes.Double
    }>
    // biome-ignore lint/complexity/noBannedTypes: codegen needs an object type for an event without data
    onEndBlur?: CodegenTypes.DirectEventHandler<{}>
    onBeginFocus?: CodegenTypes.DirectEventHandler<{
        start: CodegenTypes.Int32
        end: CodegenTypes.Int32
    }>
    /** Text or selection changed. `editId` grows with every text change. */
    onSelectionOrTextChange?: CodegenTypes.DirectEventHandler<{
        start: CodegenTypes.Int32
        end: CodegenTypes.Int32
        text: string
        editId: CodegenTypes.Int32
    }>
    onTextFlushed?: CodegenTypes.DirectEventHandler<{
        text: string
        requestId: string
    }>
    /** An image from the keyboard or clipboard, copied to a `file://` URI in the cache. */
    onPasteImage?: CodegenTypes.DirectEventHandler<{
        url: string
        width: CodegenTypes.Int32
        height: CodegenTypes.Int32
        type: string
    }>
    /** Reserved for pasted slash commands (not emitted on Android yet). */
    // biome-ignore lint/complexity/noBannedTypes: codegen needs an object type for an event without data
    onPasteCommand?: CodegenTypes.DirectEventHandler<{}>
    /** Hardware Enter. */
    // biome-ignore lint/complexity/noBannedTypes: codegen needs an object type for an event without data
    onRequestSend?: CodegenTypes.DirectEventHandler<{}>
}

type ComponentType = HostComponent<NativeProps>

interface NativeCommands {
    backspace: (viewRef: React.ElementRef<ComponentType>) => void
    blur: (viewRef: React.ElementRef<ComponentType>) => void
    focus: (viewRef: React.ElementRef<ComponentType>) => void
    /** Hides the system keyboard but keeps focus; JS draws its own panel in that space. */
    openCustomKeyboard: (viewRef: React.ElementRef<ComponentType>) => void
    closeCustomKeyboard: (viewRef: React.ElementRef<ComponentType>) => void
    openSystemKeyboard: (viewRef: React.ElementRef<ComponentType>) => void
    /** `editId` -1 applies unconditionally; otherwise a stale id is ignored. */
    replaceRange: (
        viewRef: React.ElementRef<ComponentType>,
        location: CodegenTypes.Int32,
        length: CodegenTypes.Int32,
        text: string,
        styleBlocks: string,
        keepCursorPosition: boolean,
        editId: CodegenTypes.Int32,
    ) => void
    setSelectedRange: (
        viewRef: React.ElementRef<ComponentType>,
        location: CodegenTypes.Int32,
        length: CodegenTypes.Int32,
    ) => void
    setText: (viewRef: React.ElementRef<ComponentType>, text: string) => void
    flushText: (
        viewRef: React.ElementRef<ComponentType>,
        requestId: string,
    ) => void
    updateTextBlocks: (
        viewRef: React.ElementRef<ComponentType>,
        styleBlocks: string,
        editId: CodegenTypes.Int32,
    ) => void
}

export const Commands = codegenNativeCommands<NativeCommands>({
    supportedCommands: [
        'backspace',
        'blur',
        'focus',
        'openCustomKeyboard',
        'closeCustomKeyboard',
        'openSystemKeyboard',
        'replaceRange',
        'setSelectedRange',
        'setText',
        'flushText',
        'updateTextBlocks',
    ],
})

export default codegenNativeComponent<NativeProps>(
    'IsocordChatInput',
) as ComponentType
