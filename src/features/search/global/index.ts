import { searchHistoryStore } from './SearchHistoryStore'
import { GlobalSearchScreen } from './SearchScreen'
import type { Feature } from '../../../core/feature'

/** The search of the Messages tab: the "search" screen of the reference's MainNavigator, with the DMS context. */
export const globalSearchFeature: Feature = {
    name: 'globalSearch',
    stores: [searchHistoryStore],
    screens: { globalSearch: GlobalSearchScreen },
}
