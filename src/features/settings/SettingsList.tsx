import { useNavigation } from '@react-navigation/native'
import { useEffect } from 'react'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { SearchField } from '../../design/components/inputs/SearchField'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { SETTING_RENDERER_CONFIG } from './config'
import { isBlocked, useSettingSearchStore } from './search'
import { HighlightableRow, RadioSetting } from './settingRows'
import { clearSelected, useSettingContext } from './settingRowUtils'
import { SearchResults } from './settingSearchResults'
import type { ReactNode } from 'react'
import type { SettingContext, SettingSection } from './config'

/** SettingListRenderer's SettingsList: one TableRowGroup per section, blocked rows left out. */
function SettingsList({
    sections,
    context,
}: {
    sections: SettingSection[]
    context: SettingContext
}) {
    return sections.map(section => {
        const keys = section.settings.filter(key => !isBlocked(key, context))
        const first = keys[0]
        if (!first) return null
        const id = section.settings.join()
        const firstNode = SETTING_RENDERER_CONFIG[first]
        if (firstNode.type === 'radio')
            return (
                <RadioSetting
                    key={id}
                    setting={first}
                    node={firstNode}
                    context={context}
                    helperText={section.subLabel}
                />
            )
        return (
            <TableRowGroup
                key={id}
                title={section.label}
                helperText={section.subLabel}
                hasIcons={keys.some(key => SETTING_RENDERER_CONFIG[key].icon)}
            >
                {keys.map(key => (
                    <HighlightableRow
                        key={key}
                        setting={key}
                        context={context}
                    />
                ))}
            </TableRowGroup>
        )
    })
}
/** A back button and a title over a scrolling form. */
export function SettingsScaffold({
    title,
    trailing,
    children,
}: {
    title: string
    trailing?: ReactNode
    children: ReactNode
}) {
    const navigation = useNavigation()
    return (
        <View style={styles.container}>
            <NavigatorHeader
                title={title}
                onBack={() => navigation.goBack()}
                trailing={trailing}
            />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
            >
                {children}
            </ScrollView>
        </View>
    )
}

/** A settings screen: header with a back button over a SettingsList (SettingLayout). */
export function SettingsScreen({
    title,
    sections,
    trailing,
}: {
    title: string
    sections: SettingSection[]
    /** The header's trailing button. */
    trailing?: ReactNode
}) {
    const context = useSettingContext()
    // useAutoScrollToSearchResultSetting: leaving the screen drops the selected search result.
    useEffect(() => clearSelected, [])
    return (
        <SettingsScaffold title={title} trailing={trailing}>
            <SettingsList sections={sections} context={context} />
        </SettingsScaffold>
    )
}

/** SearchableSettingsList: a SettingSearchBar over the list, replaced by the results while there is a query. */
export function SearchableSettingsScreen({
    title,
    sections,
}: {
    title: string
    sections: SettingSection[]
}) {
    const context = useSettingContext()
    const query = useSettingSearchStore(state => state.query)
    const trimmed = query.trim()
    // The query stays while a result's screen is open, and goes with the settings.
    useEffect(
        () => () =>
            useSettingSearchStore.setState({ query: '', selected: null }),
        [],
    )
    return (
        <SettingsScaffold title={title}>
            <SearchField
                size="md"
                value={query}
                onChangeText={text =>
                    useSettingSearchStore.setState({ query: text })
                }
            />
            {trimmed ? (
                <SearchResults query={trimmed} context={context} />
            ) : (
                <SettingsList sections={sections} context={context} />
            )}
        </SettingsScaffold>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
    content: {
        padding: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_32,
        gap: theme.space.PX_24,
    },
}))
