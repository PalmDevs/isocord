import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { KeyboardStickyView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { FILTERS, filtersFor } from './catalog'
import type { SearchContext } from '../types'
import type { FilterKind } from './catalog'
import type { SearchInput } from './useSearchInput'

/** The most rows of chips the bar has. */
const MAX_ROWS = 2
/** A chip's width before it is measured: its label at about this many dp a character, plus icon and padding. */
const ESTIMATED_CHAR_WIDTH = 8
const ESTIMATED_CHIP_CHROME = 48

/**
 * Lays chips out as a horizontal masonry: each goes, in bar order, to the row that is shortest so far.
 * Measured widths replace the estimates once the chips have been laid out.
 */
function masonryRows(
    kinds: FilterKind[],
    widths: Partial<Record<FilterKind, number>>,
    gap: number,
): FilterKind[][] {
    const count = Math.min(MAX_ROWS, kinds.length)
    const rows: FilterKind[][] = Array.from({ length: count }, () => [])
    const lengths = Array.from({ length: count }, () => 0)
    for (const kind of kinds) {
        const shortest = lengths.indexOf(Math.min(...lengths))
        rows[shortest]?.push(kind)
        lengths[shortest] =
            (lengths[shortest] ?? 0) +
            gap +
            (widths[kind] ??
                t(`search.filter.${kind}`).length * ESTIMATED_CHAR_WIDTH +
                    ESTIMATED_CHIP_CHROME)
    }
    return rows
}

/**
 * The search filters, up to three rows of chips that scroll sideways together and ride on the keyboard. A toggle filter turns on and off in place; the
 * others open their picker over the tabs. Departs from the reference, whose filter button opens a context menu:
 * that hides the keyboard and waits for both animations.
 */
export function FilterBar({
    context,
    search,
}: {
    context: SearchContext
    search: SearchInput
}) {
    const insets = useSafeAreaInsets()
    const { theme } = useUnistyles()
    const [widths, setWidths] = useState<Partial<Record<FilterKind, number>>>(
        {},
    )
    const rows = masonryRows(filtersFor(context), widths, theme.space.PX_8)
    return (
        // The bar keeps the navigation bar's inset below it while the keyboard is closed; the keyboard covers it.
        <KeyboardStickyView offset={{ opened: insets.bottom }}>
            <View
                accessibilityRole="toolbar"
                accessibilityLabel={t('search.filters')}
                style={styles.bar}
            >
                <Text
                    accessibilityRole="header"
                    variant="text-sm/bold"
                    color="TEXT_MUTED"
                    style={styles.header}
                >
                    {t('search.filters.header')}
                </Text>
                <ScrollView
                    horizontal
                    keyboardShouldPersistTaps="always"
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                >
                    {rows.map(row => (
                        <View key={row[0]} style={styles.row}>
                            {row.map(kind => (
                                <FilterChip
                                    key={kind}
                                    kind={kind}
                                    active={
                                        search.picking === kind ||
                                        search.filters.some(
                                            filter => filter.kind === kind,
                                        )
                                    }
                                    onPress={() =>
                                        FILTERS[kind].input === 'toggle'
                                            ? search.toggle(kind)
                                            : search.openPicker(kind)
                                    }
                                    onWidth={width =>
                                        setWidths(current =>
                                            current[kind] === width
                                                ? current
                                                : { ...current, [kind]: width },
                                        )
                                    }
                                />
                            ))}
                        </View>
                    ))}
                </ScrollView>
            </View>
        </KeyboardStickyView>
    )
}

function FilterChip({
    kind,
    active,
    onPress,
    onWidth,
}: {
    kind: FilterKind
    active: boolean
    onPress: () => void
    onWidth: (width: number) => void
}) {
    const toggle = FILTERS[kind].input === 'toggle'
    return (
        <RipplePressable
            accessibilityRole={toggle ? 'switch' : 'button'}
            accessibilityState={
                toggle ? { checked: active } : { selected: active }
            }
            accessibilityHint={t(`search.filter.${kind}.hint`)}
            onPress={onPress}
            onLayout={event => onWidth(event.nativeEvent.layout.width)}
            style={styles.chip(active)}
        >
            <Icon
                name={FILTERS[kind].icon}
                size="xs"
                color={
                    active
                        ? 'CONTROL_PRIMARY_TEXT_DEFAULT'
                        : 'CONTROL_SECONDARY_TEXT_DEFAULT'
                }
            />
            <Text
                variant="text-sm/medium"
                color={
                    active
                        ? 'CONTROL_PRIMARY_TEXT_DEFAULT'
                        : 'CONTROL_SECONDARY_TEXT_DEFAULT'
                }
            >
                {t(`search.filter.${kind}`)}
            </Text>
        </RipplePressable>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    bar: {
        paddingBottom: runtime.insets.bottom,
        borderTopWidth: 1,
        borderTopColor: theme.colors.BORDER_SUBTLE,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOW,
    },
    header: {
        paddingHorizontal: theme.space.PX_12,
        paddingTop: theme.space.PX_12,
    },
    // The rows stack; each lays its chips out in a line.
    chips: {
        flexDirection: 'column',
        gap: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_12,
        paddingVertical: theme.space.PX_8,
    },
    row: { flexDirection: 'row', gap: theme.space.PX_8 },
    chip: (active: boolean) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
        height: theme.space.PX_32,
        paddingHorizontal: theme.space.PX_12,
        borderRadius: theme.radii.round,
        borderWidth: 1,
        borderColor: active
            ? theme.colors.CONTROL_PRIMARY_BORDER_DEFAULT
            : theme.colors.CONTROL_SECONDARY_BORDER_DEFAULT,
        backgroundColor: active
            ? theme.colors.CONTROL_PRIMARY_BACKGROUND_DEFAULT
            : theme.colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
    }),
}))
