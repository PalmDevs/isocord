import { useNavigation } from '@react-navigation/native'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession } from '../../../core/react'
import { t } from '../../../i18n'
import { FilterBar } from '../filters/FilterBar'
import { FilterSuggestions } from '../filters/FilterSuggestions'
import { FilterPicker } from '../filters/pickers/FilterPicker'
import { useSearchInput } from '../filters/useSearchInput'
import { SearchPreviewHost } from '../preview'
import { SearchBar } from '../SearchBar'
import { SearchTabsLayout } from '../SearchTabsLayout'
import { PeoplePage } from './PeoplePage'
import { RecentPage } from './RecentPage'
import { searchHistoryStore } from './SearchHistoryStore'
import { SearchQueryContext } from './SearchQueryContext'
import type { SearchContext } from '../types'

const CONTEXT: SearchContext = { type: 'DMS' }
const PAGES = { recent: RecentPage, people: PeoplePage }

/**
 * SearchNavigatorScreen: the DMs search, a root stack screen ("search" route of MainNavigator).
 * Opened from the Messages tab's search field. The search bar with its back chevron sits above the tabs.
 * The query is local to the screen, as SearchQueryStore is deleted when search closes.
 * Departs from the reference's own back arrow: uses the channel details' search bar chevron.
 * The filter bar rides on the keyboard, and a filter's picker covers the tabs while it is open.
 */
export function GlobalSearchScreen() {
    const navigation = useNavigation()
    const session = useSession()
    const search = useSearchInput(CONTEXT)
    const dismiss = () => navigation.goBack()
    const submit = (text: string) =>
        session
            .get(searchHistoryStore)
            .getState()
            .add({ type: 'text', text: text.trim() })

    return (
        <SearchQueryContext value={search.setText}>
            <SearchPreviewHost
                onDismiss={dismiss}
                stackPicker={{
                    open: search.picking !== null,
                    close: search.closePicker,
                }}
            >
                <View style={styles.container}>
                    <SearchBar
                        search={search}
                        onSubmit={submit}
                        placeholder={t('search.bar.placeholderDms')}
                        autoFocus
                        onBack={dismiss}
                    />
                    <View style={styles.tabs}>
                        <SearchTabsLayout
                            context={CONTEXT}
                            query={search.queryText.trim()}
                            filters={search.filters}
                            pages={PAGES}
                            onDismiss={dismiss}
                            overlay={
                                <>
                                    <FilterPicker
                                        context={CONTEXT}
                                        search={search}
                                        background="BACKGROUND_BASE_LOW"
                                    />
                                    <FilterSuggestions
                                        context={CONTEXT}
                                        search={search}
                                    />
                                </>
                            }
                        />
                    </View>
                    <FilterBar context={CONTEXT} search={search} />
                </View>
            </SearchPreviewHost>
        </SearchQueryContext>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: {
        flex: 1,
        // useSearchLayoutInsetTop: the top inset plus 8.
        paddingTop: runtime.insets.top + 8,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOW,
    },
    // The reference's PX_16 left too wide a gap over the tabs; PX_12 as under the channel details' search bar.
    tabs: { flex: 1, marginTop: theme.space.PX_12 },
}))
