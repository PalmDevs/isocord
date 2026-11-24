import { FlashList } from '@shopify/flash-list'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native-unistyles'
import { ActivityIndicator } from '../../../../design/components/ActivityIndicator'
import { Text } from '../../../../design/components/Text'
import { TableRow } from '../../../../design/components/table/TableRow'
import { t } from '../../../../i18n'
import type { ReactNode, RefObject } from 'react'

export interface PickerRow {
    key: string
    label: ReactNode
    subLabel?: string
    icon?: ReactNode
    trailing?: ReactNode
    accessibilityLabel?: string
    disabled?: boolean
    onPress: () => void
}

/**
 * The rows of a filter's picker, in one card. Enter picks the first row that can be picked.
 * Taps keep the keyboard up.
 */
export function PickerList({
    rows,
    submitRef,
    loading = false,
}: {
    rows: PickerRow[]
    submitRef: RefObject<(() => void) | null>
    loading?: boolean
}) {
    const first = rows.find(row => !row.disabled)
    useEffect(() => {
        submitRef.current = first?.onPress ?? null
        return () => {
            submitRef.current = null
        }
    }, [submitRef, first])

    return (
        <FlashList
            data={rows}
            keyExtractor={row => row.key}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.content}
            ListEmptyComponent={
                loading ? (
                    <ActivityIndicator style={styles.empty} />
                ) : (
                    <Text color="TEXT_MUTED" style={styles.empty}>
                        {t('search.filter.noResults')}
                    </Text>
                )
            }
            renderItem={({ item: row, index }) => (
                <TableRow
                    start={index === 0}
                    end={index === rows.length - 1}
                    label={row.label}
                    subLabel={row.subLabel}
                    subLabelLineClamp={1}
                    labelLineClamp={1}
                    icon={row.icon}
                    trailing={row.trailing}
                    disabled={row.disabled}
                    accessibilityLabel={row.accessibilityLabel}
                    onPress={row.onPress}
                />
            )}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: theme.space.PX_16,
    },
    empty: { padding: theme.space.PX_24, textAlign: 'center' },
}))
