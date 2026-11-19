import { useNavigation, useRoute } from '@react-navigation/native'
import { useEffect, useState } from 'react'
import type { NavigationState } from '@react-navigation/native'

const isSelected = (state: NavigationState | undefined, key: string) =>
    state?.routes[state.index]?.key === key

/**
 * Returns whether this tab is the selected one. Unlike useIsFocused, it stays true while a screen of the root stack
 * covers the tabs, so the tab's chat panel stays open behind it.
 *
 * Follows the navigator's `state` event, which carries the state as rendered. useNavigationState missed tab changes
 * made by a nested navigate (`navigate('main', { screen })`): it re-reads the stored state before that state commits.
 */
export function useTabSelected(): boolean {
    const navigation = useNavigation()
    const { key } = useRoute()
    const [selected, setSelected] = useState(() =>
        isSelected(navigation.getState(), key),
    )
    useEffect(
        () =>
            navigation.addListener('state', event =>
                setSelected(isSelected(event.data.state, key)),
            ),
        [navigation, key],
    )
    return selected
}
