import { useNavigation } from '@react-navigation/native'
import * as Clipboard from 'expo-clipboard'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { dismissKeyboard } from '../../design/components/keyboard'
import { showToast } from '../../design/components/overlays/toastStore'
import { Skeleton } from '../../design/components/Skeleton'
import { skeletonWidth } from '../../design/components/skeletonUtils'
import { Text } from '../../design/components/Text'
import { TableRow, TableRowIcon } from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { SETTING_RENDERER_CONFIG } from './config'
import {
    getBreadcrumbs,
    getHighestLevelAncestor,
    getNearestRouteAncestorOrSelf,
    isBlocked,
    isFirstOfGroup,
    searchSettings,
    useSettingSearchStore,
} from './search'
import { trailingText } from './settingRowUtils'
import type { SettingContext, SettingKey } from './config'

// SettingRenderer's SettingSearchResultIcon: the group's first result shows its top-level setting's icon.
function SearchResultIcon({ setting }: { setting: SettingKey | null }) {
    const node = setting && SETTING_RENDERER_CONFIG[setting]
    if (!node?.icon || node.type === 'radio' || node.type === 'swatches')
        return <View style={styles.iconSpacer} />
    return <TableRowIcon name={node.icon} />
}

// SettingSearchResultBreadcrumbs.
function Breadcrumbs({ setting }: { setting: SettingKey }) {
    const breadcrumbs = getBreadcrumbs(setting)
    if (!breadcrumbs.length) return null
    return (
        <Text variant="text-xs/medium" color="TEXT_MUTED">
            {breadcrumbs.join(' → ')}
        </Text>
    )
}

// renderSettingSearchResultItem: a nested setting opens the screen that holds it.
function SearchResult({
    setting,
    iconSetting,
    context,
}: {
    setting: SettingKey
    iconSetting: SettingKey | null
    context: SettingContext
}) {
    const navigation = useNavigation()
    const node = SETTING_RENDERER_CONFIG[setting]
    const data = node.parent
        ? SETTING_RENDERER_CONFIG[getNearestRouteAncestorOrSelf(setting)]
        : node
    const common = {
        label: node.title(),
        icon: <SearchResultIcon setting={iconSetting} />,
        subLabel: <Breadcrumbs setting={setting} />,
    }
    switch (data.type) {
        // RouteSettingSearchResult
        case 'route':
            return (
                <TableRow
                    {...common}
                    arrow
                    onPress={() => {
                        dismissKeyboard()
                        useSettingSearchStore.setState({ selected: setting })
                        navigation.navigate(data.screen)
                    }}
                />
            )
        // PressableSettingSearchResult
        case 'pressable':
            return (
                <TableRow
                    {...common}
                    onPress={() => {
                        dismissKeyboard()
                        data.onPress(context)
                    }}
                />
            )
        // StaticSettingSearchResult: pressing copies its value.
        case 'static': {
            const trailing = data.trailing?.(context)
            return (
                <TableRow
                    {...common}
                    trailing={trailingText(trailing)}
                    onPress={
                        trailing
                            ? () => {
                                  Clipboard.setStringAsync(trailing).catch(
                                      () => {},
                                  )
                                  showToast({
                                      content: t('settings.copied'),
                                      icon: 'CopyIcon',
                                  })
                              }
                            : undefined
                    }
                />
            )
        }
        default:
            return null
    }
}

// SettingSearchResultPlaceholder.
function SearchResultPlaceholder({ index }: { index: number }) {
    const { theme } = useUnistyles()
    return (
        <TableRow
            icon={
                <Skeleton
                    width={theme.modules.mobile.TABLE_ROW_ICON_SIZE}
                    height={theme.modules.mobile.TABLE_ROW_ICON_SIZE}
                    radius={theme.radii.xl}
                    color="BACKGROUND_MOD_MUTED"
                />
            }
            label={
                <Skeleton
                    width={skeletonWidth(index, 10, 90)}
                    height={20}
                    radius={theme.radii.md}
                    color="BACKGROUND_MOD_MUTED"
                />
            }
        />
    )
}

// SettingsSearchEmptyState.
function SearchEmptyState() {
    return (
        <View style={styles.empty} accessibilityLiveRegion="polite">
            <Text
                variant="text-md/semibold"
                color="MOBILE_TEXT_HEADING_PRIMARY"
            >
                {t('settings.search.empty')}
            </Text>
            <Text variant="text-xs/medium" color="TEXT_MUTED">
                {t('settings.search.emptyDescription')}
            </Text>
        </View>
    )
}

/** useSettingSearchResults: results settle 350 ms after the last keystroke; placeholders show meanwhile. */
function useSettingSearchResults(query: string) {
    const [results, setResults] = useState<SettingKey[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [placeholderCount, setPlaceholderCount] = useState(10)
    useEffect(() => {
        if (!query) {
            setResults([])
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        const timer = setTimeout(() => {
            const found = searchSettings(query)
            setResults(found)
            setPlaceholderCount(Math.max(Math.min(found.length, 10), 5))
            setIsLoading(false)
        }, 350)
        return () => clearTimeout(timer)
    }, [query])
    return { results, isLoading, placeholderCount }
}

export function SearchResults({
    query,
    context,
}: {
    query: string
    context: SettingContext
}) {
    const { results, isLoading, placeholderCount } =
        useSettingSearchResults(query)
    if (isLoading)
        return (
            <TableRowGroup hasIcons>
                {Array.from({ length: placeholderCount }, (_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have nothing else to key on
                    <SearchResultPlaceholder key={index} index={index} />
                ))}
            </TableRowGroup>
        )
    const visible = results.filter(setting => !isBlocked(setting, context))
    if (!visible.length) return <SearchEmptyState />
    return (
        <TableRowGroup hasIcons>
            {visible.map((setting, index) => (
                <SearchResult
                    key={setting}
                    setting={setting}
                    iconSetting={
                        isFirstOfGroup(visible, index)
                            ? getHighestLevelAncestor(setting)
                            : null
                    }
                    context={context}
                />
            ))}
        </TableRowGroup>
    )
}

const styles = StyleSheet.create(theme => ({
    iconSpacer: { width: theme.modules.mobile.TABLE_ROW_ICON_SIZE },
    empty: {
        alignItems: 'center',
        gap: theme.space.PX_4,
        paddingVertical: theme.space.PX_24,
    },
}))
