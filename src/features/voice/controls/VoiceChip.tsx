import { StyleSheet } from 'react-native-unistyles'
import { Button } from '../../../design/components/buttons/Button'
import type { IconName } from '../../../design/icons/Icon'

/**
 * One of the wide buttons under the call's main row. They share the row's width equally, so a row of one to four
 * chips needs no layout of its own. `on` marks a chip whose feature is running.
 */
export function VoiceChip({
    icon,
    label,
    on = false,
    disabled,
    onPress,
    onLongPress,
}: {
    icon: IconName
    label: string
    on?: boolean
    disabled?: boolean
    /** Left out for a chip shown disabled, such as the pre-join card's. */
    onPress?: () => void
    onLongPress?: () => void
}) {
    return (
        <Button
            icon={icon}
            accessibilityLabel={label}
            variant={on ? 'primary' : 'secondary'}
            disabled={disabled}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.chip}
        />
    )
}

const styles = StyleSheet.create({
    chip: { flex: 1 },
})
