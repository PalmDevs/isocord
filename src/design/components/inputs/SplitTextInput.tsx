import { Pressable } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../Text'
import { TextInput } from './TextInput'
import type { PressableProps } from 'react-native'
import type { TextInputProps } from './TextInput'

export interface SplitTextInputProps
    extends Omit<TextInputProps, 'leadingText' | 'leadingIcon'> {
    leadingPressableProps?: Omit<PressableProps, 'style' | 'children'>
}

/** Text input with a labelled segment on the left, such as a country code or URL prefix. */
export function SplitTextInput({
    leading,
    leadingPressableProps,
    ...props
}: SplitTextInputProps) {
    return (
        <TextInput
            {...props}
            leading={
                leading != null ? (
                    <Pressable
                        {...leadingPressableProps}
                        disabled={leadingPressableProps?.onPress === undefined}
                        style={({ pressed }) => [
                            styles.segment,
                            pressed && styles.pressed,
                        ]}
                    >
                        {typeof leading === 'string' ||
                        typeof leading === 'number' ? (
                            <Text>{leading}</Text>
                        ) : (
                            leading
                        )}
                    </Pressable>
                ) : undefined
            }
        />
    )
}

const styles = StyleSheet.create(theme => ({
    segment: {
        alignSelf: 'stretch',
        justifyContent: 'center',
        paddingHorizontal: theme.space.PX_16,
        marginEnd: theme.space.PX_12,
        borderRightWidth: 1,
        borderRightColor: theme.colors.BORDER_STRONG,
    },
    pressed: { opacity: 0.2 },
}))
