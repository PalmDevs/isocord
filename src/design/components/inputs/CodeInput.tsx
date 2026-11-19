import { useState } from 'react'
import { TextInput as NativeTextInput, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../Text'
import { Input } from './Input'
import type { InputProps } from './Input'

export interface CodeInputProps extends Omit<InputProps, 'children'> {
    value: string
    onChangeText: (value: string) => void
    /** Number of boxes. */
    length?: number
    /** Digits only (default). Otherwise any characters, uppercased. */
    numeric?: boolean
    autoFocus?: boolean
    disabled?: boolean
    /** Called once the last box is filled. */
    onComplete?: (value: string) => void
}

/** One-time-code entry: a row of boxes driven by a single invisible native input. */
export function CodeInput({
    value,
    onChangeText,
    length = 6,
    numeric = true,
    autoFocus,
    disabled = false,
    onComplete,
    errorMessage,
    ...inputProps
}: CodeInputProps) {
    const [focused, setFocused] = useState(false)
    const hasError = errorMessage !== undefined

    const change = (text: string) => {
        const clean = (
            numeric
                ? text.replace(/\D/g, '')
                : text.replace(/\s/g, '').toUpperCase()
        ).slice(0, length)
        onChangeText(clean)
        if (clean.length === length && value.length < length)
            onComplete?.(clean)
    }

    return (
        <Input {...inputProps} errorMessage={errorMessage}>
            <View style={styles.row}>
                {Array.from({ length }, (_, index) => (
                    <View
                        // biome-ignore lint/suspicious/noArrayIndexKey: boxes are positional
                        key={index}
                        style={styles.box(
                            hasError
                                ? 'error'
                                : focused &&
                                    index === Math.min(value.length, length - 1)
                                  ? 'active'
                                  : 'default',
                        )}
                    >
                        <Text variant="heading-lg/semibold">
                            {value[index] ?? ''}
                        </Text>
                    </View>
                ))}
                <NativeTextInput
                    value={value}
                    onChangeText={change}
                    maxLength={length}
                    autoFocus={autoFocus}
                    editable={!disabled}
                    keyboardType={numeric ? 'number-pad' : 'default'}
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    caretHidden
                    accessibilityLabel={inputProps.label ?? 'Code'}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={styles.hidden}
                />
            </View>
        </Input>
    )
}

const styles = StyleSheet.create(theme => ({
    row: { flexDirection: 'row', gap: theme.space.PX_8 },
    box: (state: 'default' | 'active' | 'error') => ({
        flex: 1,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.modules.mobile.INPUT_FIELD_RADIUS_MD,
        borderWidth:
            state === 'default'
                ? theme.modules.mobile.INPUT_FIELD_BORDER_WIDTH
                : 2,
        borderColor:
            state === 'error'
                ? theme.colors.INPUT_BORDER_ERROR_DEFAULT
                : state === 'active'
                  ? theme.colors.INPUT_BORDER_ACTIVE
                  : theme.colors.INPUT_BORDER_DEFAULT,
        backgroundColor: theme.colors.INPUT_BACKGROUND_DEFAULT,
    }),
    // Covers the boxes so any tap focuses the real input; text is invisible.
    hidden: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        opacity: 0.02,
        color: 'transparent',
    },
}))
