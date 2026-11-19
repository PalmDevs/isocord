import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Stack } from '../layout/Stack'
import { TableRowGroupTitle } from './TableRowGroup'
import type { ReactNode } from 'react'

export interface RowGroupProps {
    title?: ReactNode
    /** Content aligned after the title, such as a small button. */
    trailing?: ReactNode
    children?: ReactNode
}

/** Rounded TableRow-coloured panel for free-form content, with an optional title row above (RowGroup). */
export function RowGroup({ title, trailing, children }: RowGroupProps) {
    const hasHeader = title != null || trailing != null
    return (
        <View style={styles.container}>
            {hasHeader && (
                <Stack direction="horizontal" spacing={4}>
                    {title != null && <TableRowGroupTitle title={title} />}
                    {trailing}
                </Stack>
            )}
            <View style={styles.content}>{children}</View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { overflow: 'hidden' },
    content: {
        backgroundColor: theme.colors.TABLEROW_BACKGROUND_DEFAULT,
        borderRadius: theme.modules.mobile.TABLE_ROW_BORDER_RADIUS,
        padding: theme.modules.mobile.TABLE_ROW_PADDING,
    },
}))
