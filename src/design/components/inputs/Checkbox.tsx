import { Pressable, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { FormCheckbox } from '../Forms'
import { Text } from '../Text'

export interface CheckboxProps {
    checked: boolean
    onToggle: (checked: boolean) => void
    label: string
    description?: string
    /** Appends a critical-coloured asterisk to the label. */
    required?: boolean
}

/** A pressable checkbox with a label and an optional description underneath. */
export function Checkbox({
    checked,
    onToggle,
    label,
    description,
    required = false,
}: CheckboxProps) {
    const accessibilityLabel = `${label}${required ? ' (required)' : ''}${description != null ? `, ${description}` : ''}`

    return (
        <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ checked }}
            onPress={() => onToggle(!checked)}
            style={styles.container}
        >
            <FormCheckbox checked={checked} />
            <View style={styles.textContainer}>
                <View style={styles.labelContainer}>
                    <Text variant="text-md/medium">
                        {label}
                        {required && (
                            <Text
                                variant="text-md/bold"
                                color="TEXT_FEEDBACK_CRITICAL"
                            >
                                {' *'}
                            </Text>
                        )}
                    </Text>
                </View>
                {description != null && (
                    <Text variant="text-sm/normal" color="TEXT_SUBTLE">
                        {description}
                    </Text>
                )}
            </View>
        </Pressable>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { flexDirection: 'row', gap: theme.space.PX_8 },
    textContainer: { flex: 1 },
    labelContainer: { minHeight: 24, justifyContent: 'center' },
}))
