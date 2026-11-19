import { Children, Fragment } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Text } from '../Text'
import { TableRowGroupContext } from './tableRowGroupContext'
import type { ReactElement, ReactNode } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import type { TextVariant } from '../../tokens'

/** Hairline between two rows, inset to line up with the label (past the icon when the rows have one). */
export function TableRowDivider({
    adjustSpacingForIcon = false,
}: {
    adjustSpacingForIcon?: boolean
}) {
    return (
        <View style={styles.divider(adjustSpacingForIcon)}>
            <View style={styles.line} />
        </View>
    )
}

export function TableRowGroupTitle({
    title,
    lineClamp,
    style,
}: {
    title: ReactNode
    lineClamp?: number
    style?: StyleProp<TextStyle>
}) {
    return (
        <Text
            accessibilityRole="header"
            variant="text-md/medium"
            color="TEXT_SUBTLE"
            lineClamp={lineClamp}
            style={[styles.title, style]}
        >
            {title}
        </Text>
    )
}

export interface TableRowGroupProps {
    title?: ReactNode
    description?: ReactNode
    helperText?: ReactNode
    /** Inset the dividers past the leading icon slot. */
    hasIcons?: boolean
    /** Square off the bottom corners, for a trailing-text strip attached underneath. */
    hasTrailingText?: boolean
    accessibilityRole?: 'none' | 'list' | 'radiogroup'
    accessibilityLabel?: string
    children?: ReactNode
}

/** Rounded container that stacks TableRows with dividers, with an optional title above and helper text below. */
export function TableRowGroup({
    title,
    description,
    helperText,
    hasIcons = false,
    hasTrailingText = false,
    accessibilityRole = 'none',
    accessibilityLabel,
    children,
}: TableRowGroupProps) {
    const { theme } = useUnistyles()
    // toArray drops null/false children, so a conditionally-rendered row never leaves a stray divider.
    const rows = Children.toArray(children).map((child, index) => (
        // toArray gives every element a stable key.
        <Fragment key={(child as ReactElement).key}>
            {index > 0 && <TableRowDivider adjustSpacingForIcon={hasIcons} />}
            {child}
        </Fragment>
    ))

    return (
        <TableRowGroupContext.Provider value>
            <View style={styles.container}>
                {title != null && <TableRowGroupTitle title={title} />}
                {description != null && (
                    <Text
                        variant="text-sm/normal"
                        color="TEXT_SUBTLE"
                        style={styles.description}
                    >
                        {description}
                    </Text>
                )}
                <View
                    accessibilityRole={accessibilityRole}
                    accessibilityLabel={accessibilityLabel}
                    style={[
                        styles.content,
                        hasTrailingText && styles.contentWithTrailingText,
                    ]}
                >
                    {rows}
                </View>
                {helperText != null && (
                    <Text
                        variant={
                            theme.modules.mobile
                                .TABLE_ROW_GROUP_HELPER_TEXT_STYLE as TextVariant
                        }
                        color="TEXT_MUTED"
                        style={styles.helperText}
                    >
                        {helperText}
                    </Text>
                )}
            </View>
        </TableRowGroupContext.Provider>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { flexShrink: 0 },
    content: {
        borderRadius: theme.modules.mobile.TABLE_ROW_BORDER_RADIUS,
        overflow: 'hidden',
        flexGrow: 1,
        flexShrink: 0,
        padding: 0,
    },
    contentWithTrailingText: {
        borderBottomLeftRadius: theme.radii.none,
        borderBottomRightRadius: theme.radii.none,
    },
    title: { marginBottom: theme.space.PX_8 },
    description: { marginBottom: theme.space.PX_8 },
    helperText: { marginTop: theme.space.PX_8 },
    divider: (adjustSpacingForIcon: boolean) => ({
        height: 1,
        marginTop: -1,
        paddingStart: adjustSpacingForIcon
            ? theme.modules.mobile.TABLE_ROW_DIVIDER_PADDING
            : theme.space.PX_12,
    }),
    line: { height: 1, backgroundColor: theme.colors.BORDER_SUBTLE },
}))
