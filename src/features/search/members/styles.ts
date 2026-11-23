import { StyleSheet } from 'react-native-unistyles'
import { SEARCH_LIST_SECTION_TOP_PADDING } from '../messages/constants'

/** The bottom padding of the member lists' content, below the last row. */
export function contentEndPadding(
    theme: { space: { PX_24: number } },
    insetBottom: number,
) {
    return insetBottom + theme.space.PX_24
}

export const styles = StyleSheet.create((theme, runtime) => ({
    // The list of UsersFastList has 16 dp on its sides.
    content: {
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: contentEndPadding(theme, runtime.insets.bottom),
    },
    // membersContentContainer: the search results start SEARCH_LIST_SECTION_TOP_PADDING below the tabs.
    searchContent: {
        paddingTop: SEARCH_LIST_SECTION_TOP_PADDING,
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_24,
    },
    empty: { padding: theme.space.PX_24, textAlign: 'center' },
}))
