import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ErrorText } from '../ErrorText'
import { Text } from '../Text'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export interface InputProps {
    label?: string
    /** Rendered after the label, such as a "Forgot?" link. */
    labelTrailing?: ReactNode
    required?: boolean
    description?: string
    errorMessage?: string
    containerStyle?: StyleProp<ViewStyle>
    children: ReactNode
}

/** Label, field slot, description and error message wrapper shared by every text field. */
export function Input({
    label,
    labelTrailing,
    required,
    description,
    errorMessage,
    containerStyle,
    children,
}: InputProps) {
    return (
        <View style={containerStyle}>
            {label !== undefined && (
                <View style={styles.labelRow}>
                    <Text
                        variant="text-sm/semibold"
                        color="TEXT_SUBTLE"
                        accessibilityLabel={
                            required ? `${label}, required` : label
                        }
                    >
                        {label}
                        {required && (
                            <Text
                                variant="text-sm/bold"
                                color="TEXT_FEEDBACK_CRITICAL"
                                aria-hidden
                            >
                                {' *'}
                            </Text>
                        )}
                    </Text>
                    {labelTrailing}
                </View>
            )}
            <View style={styles.field}>{children}</View>
            {description !== undefined && (
                <Text
                    variant="text-xs/medium"
                    color="TEXT_MUTED"
                    style={styles.below}
                >
                    {description}
                </Text>
            )}
            {errorMessage !== undefined && (
                <ErrorText style={styles.below}>{errorMessage}</ErrorText>
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.space.PX_4,
    },
    field: { marginVertical: theme.space.PX_4 },
    below: { marginTop: theme.space.PX_4 },
}))
