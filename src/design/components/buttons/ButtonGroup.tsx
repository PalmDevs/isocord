import { StyleSheet } from 'react-native-unistyles'
import { Stack } from '../layout/Stack'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { StackProps } from '../layout/Stack'

export interface ButtonGroupProps
    extends Omit<StackProps, 'spacing' | 'children' | 'style'> {
    /** `sm` buttons sit 12 apart, `md` and `lg` 8. */
    size?: 'sm' | 'md' | 'lg'
    children?: ReactNode
    style?: StyleProp<ViewStyle>
}

/** Vertical stack of buttons with 16 of padding above and below (ButtonGroup). */
export function ButtonGroup({
    size = 'md',
    children,
    style,
    ...props
}: ButtonGroupProps) {
    return (
        <Stack
            {...props}
            spacing={size === 'sm' ? 12 : 8}
            style={[styles.container, style]}
        >
            {children}
        </Stack>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { paddingVertical: theme.space.PX_16 },
}))
