import { useRef, useState } from 'react'
import { TextInput as NativeTextInput, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Icon } from '../../icons/Icon'
import { RipplePressable } from '../buttons/RipplePressable'
import { Text } from '../Text'
import { Input } from './Input'
import { InputFieldContainer } from './InputFieldContainer'
import { INPUT_HEIGHTS } from './inputHeights'
import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
    TextInputProps as NativeTextInputProps,
    StyleProp,
    ViewStyle,
} from 'react-native'
import type { IconName } from '../../icons/Icon'
import type { InputSize } from './inputHeights'

export type { InputSize }
export type TextInputRef = ComponentRef<typeof NativeTextInput>

export interface TextInputProps
    extends Omit<NativeTextInputProps, 'style' | 'ref'> {
    label?: string
    /** Rendered after the label, such as a "Forgot?" link. */
    labelTrailing?: ReactNode
    required?: boolean
    description?: string
    errorMessage?: string
    size?: InputSize
    round?: boolean
    leadingIcon?: IconName
    leadingText?: string
    trailingText?: string
    /** Shows a clear button while the field has text. */
    clearable?: boolean
    /** Raw node rendered inside the field before the text. */
    leading?: ReactNode
    /** Raw node rendered inside the field after the text, such as a show-password toggle. */
    trailing?: ReactNode
    containerStyle?: StyleProp<ViewStyle>
    ref?: Ref<TextInputRef>
}

export function TextInput({
    label,
    labelTrailing,
    required,
    description,
    errorMessage,
    size = 'lg',
    round = false,
    leadingIcon,
    leadingText,
    trailingText,
    clearable = false,
    leading,
    trailing,
    containerStyle,
    editable = true,
    value,
    defaultValue,
    onChangeText,
    onFocus,
    onBlur,
    ref,
    ...props
}: TextInputProps) {
    const [focused, setFocused] = useState(false)
    const [typed, setTyped] = useState(defaultValue ?? '')
    const innerRef = useRef<TextInputRef>(null)
    const { theme } = useUnistyles()
    const brand = theme.colors.TEXT_BRAND
    // Void TextInput: 50% brand tint for the selection on Android.
    const selection =
        brand.startsWith('#') && brand.length === 7 ? `${brand}80` : brand
    const hasValue = (value ?? typed).length > 0

    const setRef = (instance: TextInputRef | null) => {
        innerRef.current = instance
        if (typeof ref === 'function') ref(instance)
        else if (ref) ref.current = instance
    }
    const clear = () => {
        setTyped('')
        onChangeText?.('')
    }

    return (
        <Input
            label={label}
            labelTrailing={labelTrailing}
            required={required}
            description={description}
            errorMessage={errorMessage}
            containerStyle={containerStyle}
        >
            <InputFieldContainer
                size={size}
                round={round}
                status={errorMessage === undefined ? 'default' : 'error'}
                isFocused={focused}
                disabled={!editable}
            >
                {leading}
                {leadingIcon !== undefined && (
                    <View style={styles.attachment(size, 'start')}>
                        <Icon
                            name={leadingIcon}
                            size="xs"
                            color="INPUT_ICON_DEFAULT"
                        />
                    </View>
                )}
                {leadingText !== undefined && (
                    <Text
                        color="INPUT_PLACEHOLDER_TEXT_DEFAULT"
                        style={styles.attachment(size, 'start')}
                    >
                        {leadingText}
                    </Text>
                )}
                <NativeTextInput
                    {...props}
                    ref={setRef}
                    // Always controlled (by the caller, or by `typed`), so clearing is a state change rather than a
                    // native clear() that an uncontrolled field with a defaultValue can undo.
                    value={value ?? typed}
                    editable={editable}
                    cursorColor={brand}
                    selectionHandleColor={brand}
                    selectionColor={selection}
                    placeholderTextColor={
                        theme.colors.INPUT_PLACEHOLDER_TEXT_DEFAULT
                    }
                    onChangeText={text => {
                        setTyped(text)
                        onChangeText?.(text)
                    }}
                    onFocus={event => {
                        setFocused(true)
                        onFocus?.(event)
                    }}
                    onBlur={event => {
                        setFocused(false)
                        onBlur?.(event)
                    }}
                    style={styles.input(
                        size,
                        leadingIcon !== undefined ||
                            leadingText !== undefined ||
                            leading !== undefined,
                    )}
                />
                {trailingText !== undefined && (
                    <Text
                        color="INPUT_PLACEHOLDER_TEXT_DEFAULT"
                        style={styles.attachment(size, 'end')}
                    >
                        {trailingText}
                    </Text>
                )}
                {clearable && hasValue && editable && (
                    <RipplePressable
                        borderless
                        radius={16}
                        accessibilityRole="button"
                        accessibilityLabel="Clear"
                        hitSlop={4}
                        onPress={clear}
                        style={styles.attachment(size, 'end')}
                    >
                        <Icon name="CircleXIcon" size="xs" />
                    </RipplePressable>
                )}
                {trailing}
            </InputFieldContainer>
        </Input>
    )
}

const styles = StyleSheet.create(theme => {
    const pad = (size: InputSize) =>
        size === 'lg'
            ? theme.space.PX_16
            : size === 'md'
              ? theme.space.PX_12
              : theme.space.PX_8
    return {
        attachment: (size: InputSize, side: 'start' | 'end') => ({
            justifyContent: 'center',
            ...(side === 'start'
                ? { paddingStart: pad(size), paddingEnd: theme.space.PX_8 }
                : { paddingEnd: pad(size), paddingStart: theme.space.PX_8 }),
        }),
        input: (size: InputSize, hasLeading: boolean) => ({
            ...theme.text[size === 'sm' ? 'text-xs/normal' : 'text-md/normal'],
            lineHeight: undefined,
            flexGrow: 1,
            flexShrink: 1,
            minHeight:
                INPUT_HEIGHTS[size] -
                theme.modules.mobile.INPUT_FIELD_BORDER_WIDTH * 2,
            color: theme.colors.TEXT_DEFAULT,
            paddingStart: hasLeading ? 0 : pad(size),
            paddingEnd: pad(size),
            paddingVertical:
                size === 'lg'
                    ? theme.space.PX_10
                    : size === 'md'
                      ? theme.space.PX_8
                      : theme.space.PX_4,
        }),
    }
})
