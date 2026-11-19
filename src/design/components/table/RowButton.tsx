import { isValidElement } from 'react'
import { StyleSheet } from 'react-native-unistyles'
import { RipplePressable } from '../buttons/RipplePressable'
import { TableRowIcon, TableRowInner } from './TableRow'
import type { ReactNode } from 'react'
import type { PressableProps } from 'react-native'
import type { IconName } from '../../icons/Icon'
import type { TableRowProps } from './TableRow'

export interface RowButtonProps
    extends Pick<
            TableRowProps,
            | 'label'
            | 'subLabel'
            | 'trailing'
            | 'labelLineClamp'
            | 'subLabelLineClamp'
            | 'height'
        >,
        Pick<
            PressableProps,
            'accessibilityLabel' | 'accessibilityHint' | 'testID'
        > {
    /** An icon name is wrapped in a TableRowIcon; an element is rendered as given. */
    icon?: IconName | ReactNode
    /** Show the disclosure chevron. Defaults to true. */
    arrow?: boolean
    onPress?: () => void
    disabled?: boolean
    /** `primary` uses the default icon colour, `secondary` the muted one. */
    variant?: 'primary' | 'secondary'
}

/** A standalone TableRow in its own raised card, for single actions that are not part of a list. */
export function RowButton({
    icon,
    arrow = true,
    onPress,
    disabled = false,
    variant = 'secondary',
    accessibilityLabel,
    accessibilityHint,
    testID,
    ...row
}: RowButtonProps) {
    const iconNode =
        typeof icon === 'string' ? (
            <TableRowIcon
                name={icon as IconName}
                variant={variant === 'primary' ? 'default' : 'secondary'}
            />
        ) : isValidElement(icon) ? (
            icon
        ) : null

    return (
        // The Android ripple is the press state (PressableBase's themed ripple).
        <RipplePressable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            testID={testID}
            disabled={disabled}
            onPress={onPress}
            style={styles.card}
        >
            <TableRowInner
                {...row}
                icon={iconNode}
                arrow={arrow}
                disabled={disabled}
            />
        </RipplePressable>
    )
}

const styles = StyleSheet.create(theme => ({
    card: {
        backgroundColor: theme.colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
        borderColor: theme.colors.CONTROL_SECONDARY_BORDER_DEFAULT,
        borderWidth: 1,
        borderRadius: theme.modules.mobile.TABLE_ROW_BORDER_RADIUS,
        boxShadow: theme.shadows.SHADOW_LOW,
        overflow: 'hidden',
    },
}))
