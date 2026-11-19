import { useNavigation } from '@react-navigation/native'
import { FlashList } from '@shopify/flash-list'
import { useEffect, useState } from 'react'
import { Share, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { getLogs, stringifyLogs, subscribeLogs } from '../../core/log'
import { deviceStorage } from '../../core/storage'
import { IconButton } from '../../design/components/buttons/IconButton'
import { SearchField } from '../../design/components/inputs/SearchField'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { openActionSheet } from '../../design/components/sheets/sheetStore'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { showToast } from '../toasts'
import { DebugLogsOptionsSheet } from './DebugLogsOptionsSheet'
import type { LogEntry, LogLevel } from '../../core/log'
import type { SemanticColor } from '../../design/tokens'
import type { SortOrder } from './DebugLogsOptionsSheet'

// UserSettingsDebugLogs keeps both in Storage.
const SORT_ORDER_KEY = 'debug-log-sort-order'
const QUERY_KEY = 'debug-log-query'
const FILTER_DELAY_MS = 300
/** New entries come in bursts (startup, READY); the list catches up at most this often. */
const REFRESH_DELAY_MS = 500
/** How close to the newest end (px) the list must be to follow new entries. */
const FOLLOW_THRESHOLD = 48
/** Characters shared: about 400 KB as UTF-16, well under the 1 MB binder limit for the share Intent. */
const SHARE_MAX_CHARS = 200_000

/** The reference colours every category with TEXT_BRAND; here warnings and errors stand out. */
const CATEGORY_COLORS: Record<LogLevel, SemanticColor> = {
    debug: 'TEXT_BRAND',
    info: 'TEXT_BRAND',
    warn: 'TEXT_FEEDBACK_WARNING',
    error: 'TEXT_FEEDBACK_CRITICAL',
}

function toRegex(query: string): RegExp | null {
    try {
        return new RegExp(query, 'i')
    } catch {
        return null
    }
}

function LogRow({ entry }: { entry: LogEntry }) {
    return (
        <View style={styles.log}>
            <Text
                variant="text-xs/normal"
                color="TEXT_MUTED"
                style={styles.code}
            >
                {new Date(entry.time).toISOString()}
            </Text>
            <Text variant="text-sm/normal" style={styles.code} selectable>
                <Text
                    variant="text-sm/normal"
                    color={CATEGORY_COLORS[entry.level]}
                    style={styles.code}
                >
                    {`[${entry.category}]: `}
                </Text>
                {entry.message}
            </Text>
        </View>
    )
}

/**
 * UserSettingsDebugLogs: the app's logs, filtered by a regex, shared as text. Departures from the reference: the list
 * follows new entries instead of being a snapshot with pull to refresh; the options are an IconButton beside the field
 * rather than inside it; the Logs row opens this screen directly, as Isocord has no other log screens.
 */
export function DebugLogsScreen() {
    const navigation = useNavigation()
    const [sortOrder, setSortOrder] = useState<SortOrder>(
        () =>
            (deviceStorage.getString(SORT_ORDER_KEY) as
                | SortOrder
                | undefined) ?? 'oldest',
    )
    const [logs, setLogs] = useState(() => getLogs(sortOrder === 'newest'))
    const [query, setQuery] = useState(
        () => deviceStorage.getString(QUERY_KEY) ?? '',
    )
    const [filter, setFilter] = useState(query)

    // As the reference: an empty query applies at once; an invalid pattern keeps the last filter and isn't saved.
    useEffect(() => {
        const apply = () => {
            setFilter(query)
            deviceStorage.set(QUERY_KEY, query)
        }
        if (query === '') return apply()
        const timeout = setTimeout(() => {
            if (toRegex(query)) apply()
        }, FILTER_DELAY_MS)
        return () => clearTimeout(timeout)
    }, [query])

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | undefined
        const unsubscribe = subscribeLogs(() => {
            timeout ??= setTimeout(() => {
                timeout = undefined
                setLogs(getLogs(sortOrder === 'newest'))
            }, REFRESH_DELAY_MS)
        })
        return () => {
            unsubscribe()
            clearTimeout(timeout)
        }
    }, [sortOrder])

    const changeSortOrder = (next: SortOrder) => {
        setSortOrder(next)
        deviceStorage.set(SORT_ORDER_KEY, next)
        setLogs(getLogs(next === 'newest'))
    }

    const regex = filter ? toRegex(filter) : null
    const visible = regex
        ? logs.filter(
              entry => regex.test(entry.category) || regex.test(entry.message),
          )
        : logs

    return (
        <View style={styles.wrap}>
            <NavigatorHeader
                title={t('debugLogs.title')}
                onBack={() => navigation.goBack()}
            />
            <View style={styles.searchWrap}>
                <SearchField
                    size="md"
                    placeholder={t('debugLogs.filter')}
                    value={query}
                    onChangeText={setQuery}
                    containerStyle={styles.searchField}
                />
                <IconButton
                    icon="FiltersHorizontalIcon"
                    variant="secondary"
                    size="md"
                    accessibilityLabel={t('debugLogs.options')}
                    style={styles.button}
                    onPress={() =>
                        openActionSheet(
                            'debug-logs-options',
                            <DebugLogsOptionsSheet
                                sortOrder={sortOrder}
                                onSortOrderChanged={changeSortOrder}
                            />,
                        )
                    }
                />
                <IconButton
                    icon="ShareIcon"
                    variant="secondary"
                    size="md"
                    accessibilityLabel={t('debugLogs.share')}
                    style={styles.button}
                    onPress={() =>
                        void Share.share(
                            { message: stringifyLogs(SHARE_MAX_CHARS) },
                            { dialogTitle: t('debugLogs.title') },
                        ).catch(() =>
                            showToast({
                                content: t('error.generic'),
                                variant: 'critical',
                            }),
                        )
                    }
                />
            </View>
            <FlashList
                data={visible}
                renderItem={({ item }) => <LogRow entry={item} />}
                contentContainerStyle={styles.list}
                // At the newest end, the list follows new entries; elsewhere it stays where it is.
                maintainVisibleContentPosition={
                    sortOrder === 'newest'
                        ? { autoscrollToTopThreshold: FOLLOW_THRESHOLD }
                        : { autoscrollToBottomThreshold: FOLLOW_THRESHOLD }
                }
            />
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    wrap: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOW },
    searchWrap: {
        padding: theme.space.PX_16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchField: { flex: 1 },
    button: { marginLeft: theme.space.PX_8 },
    list: {
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_16,
    },
    log: { paddingBottom: theme.space.PX_16 },
    // Fonts.CODE_BOLD in the reference.
    code: { fontFamily: theme.text.code.fontFamily },
}))
