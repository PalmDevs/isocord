import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { IconButton } from '../../design/components/buttons/IconButton'
import { TagListInput } from '../../design/components/inputs/TagListInput'
import { t } from '../../i18n'
import { removeSearchTag, searchTags } from './filters/tags'
import type { ReactNode } from 'react'
import type { SearchInput } from './filters/useSearchInput'

export interface SearchBarProps {
    /** The text and filters (useSearchInput). */
    search: SearchInput
    /** Enter pressed: the query is committed (recorded in search history). */
    onSubmit?: (text: string) => void
    placeholder?: string
    autoFocus?: boolean
    onFocus?: () => void
    /** Shows the back chevron on the left of the field (ChannelDetailsSearchBar's back button) and is called by it. */
    onBack?: () => void
}

/** IconButton "sm": the pill is 32 wide around an 18 icon. */
const BACK_PILL_WIDTH = 32
const BACK_ICON_SIZE = 18
/** ChannelDetailsSearchBar's back button: the icon starts 16 from the edge and the field 8 after it. */
const BACK_ICON_INSET = 16
const BACK_ICON_GAP = 8
const BACK_PILL_SLACK = (BACK_PILL_WIDTH - BACK_ICON_SIZE) / 2

/**
 * SearchBar: a tag field of SEARCH_BAR_HEIGHT (the "md" input) with a magnifier and a search key. The tags are the
 * filters. While a filter's picker is open, the text searches the picker and Enter goes to it.
 * Keeps the 16 to its right that the reference's header keeps (SearchScreenSearchBar's headerControlsRight).
 * With `onBack` it shows the back chevron, with the reference's 16 inset built in.
 * Without `onBack` the host provides the left space.
 */
export function SearchBar({
    search,
    onSubmit,
    placeholder,
    autoFocus,
    onFocus,
    onBack,
}: SearchBarProps): ReactNode {
    return (
        <View style={styles.container}>
            {onBack && (
                <IconButton
                    icon="ChevronLargeLeftIcon"
                    variant="icon-only"
                    size="md"
                    accessibilityLabel={t('common.back')}
                    onPress={onBack}
                    style={styles.back}
                />
            )}
            <View style={styles.field}>
                <TagListInput
                    icon="MagnifyingGlassIcon"
                    tags={searchTags(search)}
                    onRemove={index => removeSearchTag(search, index)}
                    value={search.text}
                    onChangeText={search.changeText}
                    autoClearInputOnTagAdd={false}
                    onSubmitEditing={() =>
                        search.picking === null
                            ? onSubmit?.(search.submitText())
                            : search.pickerSubmit.current?.()
                    }
                    placeholder={placeholder ?? t('search.bar.placeholder')}
                    autoFocus={autoFocus}
                    onFocus={onFocus}
                    // A picker keeps the keyboard. A query's results stay under the field while it is up.
                    submitBehavior={
                        search.picking === null ? 'blurAndSubmit' : 'submit'
                    }
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: theme.space.PX_16,
        gap: theme.space.PX_8,
    },
    field: { flex: 1 },
    back: {
        marginLeft: BACK_ICON_INSET - BACK_PILL_SLACK,
        marginRight: BACK_ICON_GAP - BACK_PILL_SLACK,
    },
}))
