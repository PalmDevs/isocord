import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { FILTERS } from './catalog'
import { filterWord } from './parse'
import type { Tag } from '../../../design/components/inputs/TagListInput'
import type { FilterKind, SearchFilter } from './catalog'
import type { SearchInput } from './useSearchInput'

/** The key of a filter, as the reference's tags write it: `from:`. */
const filterKey = (kind: FilterKind) => `${filterWord(kind)}:`

/** A tag's text: the filter's key, muted, then its value. A toggle is its key alone. */
function FilterTagText({ filter }: { filter: SearchFilter }) {
    if (filter.label === '')
        return (
            <Text variant="text-sm/medium" color="TEXT_DEFAULT">
                {t(`search.filter.${filter.kind}`)}
            </Text>
        )
    return (
        <View style={styles.row}>
            <Text variant="text-sm/medium" color="TEXT_MUTED">
                {filterKey(filter.kind)}
            </Text>
            <Text
                variant="text-sm/medium"
                color="TEXT_STRONG"
                lineClamp={1}
                style={styles.value}
            >
                {filter.negated ? `-${filter.label}` : filter.label}
            </Text>
        </View>
    )
}

/** The key of the filter being picked, in the brand colour (the reference's prefix tag). */
function PickingTagText({ kind }: { kind: FilterKind }) {
    return (
        <Text variant="text-sm/medium" color="TEXT_BRAND">
            {filterKey(kind)}
        </Text>
    )
}

/**
 * The tags of the search bar: its filters, and the key of the filter being picked (the reference's prefix tag).
 * A tapped filter tag opens its picker to change it, and shows the key in its place meanwhile. A departure: the
 * reference's tags only come off.
 */
export function searchTags(search: SearchInput): Tag[] {
    const tags: Tag[] = search.filters.map(filter =>
        filter.id === search.editing
            ? {
                  id: filter.id,
                  text: <PickingTagText kind={filter.kind} />,
                  label: filterKey(filter.kind),
              }
            : {
                  id: filter.id,
                  label: `${filterKey(filter.kind)} ${filter.negated ? '-' : ''}${filter.label}`,
                  text: <FilterTagText filter={filter} />,
                  onPress:
                      FILTERS[filter.kind].input === 'toggle'
                          ? undefined
                          : () => search.edit(filter.id),
              },
    )
    if (search.picking !== null && search.editing === null)
        tags.push({
            id: 'picking',
            text: <PickingTagText kind={search.picking} />,
            label: filterKey(search.picking),
        })
    return tags
}

/** TagListInput's removal: the picking tag closes the picker, and so does removing the filter being edited. */
export function removeSearchTag(search: SearchInput, index: number) {
    const filter = search.filters[index]
    if (filter?.id === search.editing) search.closePicker()
    if (filter) search.remove(filter.id)
    else search.closePicker()
}

const styles = StyleSheet.create(theme => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.PX_4 },
    value: { flexShrink: 1 },
}))
