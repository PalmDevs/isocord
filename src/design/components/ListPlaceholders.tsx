import { StyleSheet } from 'react-native-unistyles'
import ListPlaceholdersView from '../../native/ListPlaceholdersViewNativeComponent'
import type { ReactNode } from 'react'
import type { ViewProps } from 'react-native'
import type { NativeProps } from '../../native/ListPlaceholdersViewNativeComponent'

/** The look of the placeholder rows. Sizes are dp. */
export type ListPlaceholderConfig = Omit<NativeProps, keyof ViewProps>

/**
 * FastestList's placeholderConfig: static rows drawn natively behind the list, wherever no row is mounted yet. Wraps
 * the list.
 */
export function ListPlaceholders({
    config,
    children,
}: {
    config: ListPlaceholderConfig
    children: ReactNode
}) {
    return (
        <ListPlaceholdersView style={styles.fill} {...config}>
            {children}
        </ListPlaceholdersView>
    )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
