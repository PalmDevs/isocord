import { useState } from 'react'
import { TextInput as NativeTextInput, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Text } from '../Text'
import { Input } from './Input'
import { InputFieldContainer } from './InputFieldContainer'
import { TEXT_AREA_HEIGHT } from './textAreaHeight'
import type { Ref } from 'react'
import type { TextInputProps as NativeTextInputProps } from 'react-native'
import type { SemanticColor } from '../../tokens'
import type { InputProps } from './Input'
import type { TextInputRef } from './TextInput'

export interface TextAreaFieldProps
    extends Omit<NativeTextInputProps, 'style' | 'ref' | 'multiline'>,
        Omit<InputProps, 'children'> {
    ref?: Ref<TextInputRef>
}

/** Multi-line field with a fixed height and a remaining-characters counter when maxLength is set. */
export function TextAreaField({
    label,
    labelTrailing,
    required,
    description,
    errorMessage,
    containerStyle,
    editable = true,
    maxLength,
    defaultValue,
    value,
    onChangeText,
    onFocus,
    onBlur,
    ...props
}: TextAreaFieldProps) {
    const [focused, setFocused] = useState(false)
    const [typed, setTyped] = useState(defaultValue ?? '')
    const { theme } = useUnistyles()
    const remaining =
        maxLength === undefined
            ? undefined
            : maxLength - (value ?? typed).length
    const counterColor: SemanticColor =
        remaining === undefined || maxLength === undefined
            ? 'TEXT_MUTED'
            : remaining <= 0
              ? 'TEXT_FEEDBACK_CRITICAL'
              : remaining < maxLength / 9
                ? 'TEXT_FEEDBACK_WARNING'
                : 'TEXT_MUTED'

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
                height={TEXT_AREA_HEIGHT}
                status={errorMessage === undefined ? 'default' : 'error'}
                isFocused={focused}
                disabled={!editable}
            >
                <NativeTextInput
                    {...props}
                    multiline
                    value={value}
                    defaultValue={defaultValue}
                    editable={editable}
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
                    style={styles.input}
                />
                {remaining !== undefined && (
                    <View style={styles.counter} pointerEvents="none">
                        <Text variant="text-xs/semibold" color={counterColor}>
                            {remaining}
                        </Text>
                    </View>
                )}
            </InputFieldContainer>
        </Input>
    )
}

const styles = StyleSheet.create(theme => ({
    input: {
        ...theme.text['text-md/normal'],
        lineHeight: undefined,
        flex: 1,
        alignSelf: 'stretch',
        textAlignVertical: 'top',
        color: theme.colors.TEXT_DEFAULT,
        paddingHorizontal: theme.space.PX_16,
        paddingVertical: theme.space.PX_10,
    },
    counter: {
        position: 'absolute',
        bottom: theme.space.PX_4,
        right: theme.space.PX_16,
    },
}))
