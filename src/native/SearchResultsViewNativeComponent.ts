import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native'

export interface NativeProps extends ViewProps {
    /**
     * JSON array of search rows, top to bottom. See `SearchRow` in
     * src/features/search/messages/MessageResults.tsx (decoded as SearchRow in SearchRows.kt).
     */
    rows: string
    /** JSON object of `ChatTheme` (src/features/chat/theme.ts). */
    theme: string
    /** Lines of text a result shows before it is cut. */
    lineClamp?: CodegenTypes.Int32
    /** Results take taps only as a whole: links, mentions, spoilers and the author line inside them do nothing. */
    inertContent?: boolean
    /** dp past which a result's body (text, media, embeds) is cut with a fade. 0 for no limit. */
    maxContentHeight?: CodegenTypes.Float
    /** dp above the first row and below the last one. */
    topPadding?: CodegenTypes.Float
    bottomPadding?: CodegenTypes.Float
    /** A link, mention or media was tapped (`isocord://…` or web urls), or a result (`isocord://result/<channel>/<message>`). */
    onLinkPress?: CodegenTypes.DirectEventHandler<{ url: string }>
    /** Results take a long press, reported as `onResultLongPress`. */
    resultLongPress?: boolean
    /** A result was held: its row `key`. Only with `resultLongPress`. */
    onResultLongPress?: CodegenTypes.DirectEventHandler<{ key: string }>
    /** The last row is a loading row and the list is near it: the next page is wanted. */
    onEndReached?: CodegenTypes.DirectEventHandler<null>
    /** The list takes a pull to refresh, reported as `onRefresh`. */
    refreshable?: boolean
    /** The refresh spinner shows. Only with `refreshable`. */
    refreshing?: boolean
    /** The list was pulled down at its top. Only with `refreshable`. */
    onRefresh?: CodegenTypes.DirectEventHandler<null>
    /** The list is being scrolled: the keyboard of the search field can go. */
    onScrollDrag?: CodegenTypes.DirectEventHandler<null>
}

export default codegenNativeComponent<NativeProps>(
    'IsocordSearchResultsView',
) as HostComponent<NativeProps>
