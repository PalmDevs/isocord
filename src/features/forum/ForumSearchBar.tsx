import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Badge } from '../../design/components/Badge'
import { IconButton } from '../../design/components/buttons/IconButton'
import { SearchField } from '../../design/components/inputs/SearchField'
import { t } from '../../i18n'
import { useSettledQuery } from '../search/useSettledQuery'
import { openForumFilterSheet } from './ForumFilterSheet'
import { useForumQuery } from './useForumQuery'

/**
 * ForumChannelSearch and the sort and filter button: a search field and one button for the sheet, badged with the
 * number of active filters. The text applies once typing pauses (`/threads/search` matches it as `name`); a
 * departure from the reference's separate search screen, to keep the list in view. The text is local, so typing
 * leaves the list alone until it settles.
 */
export function ForumSearchBar({ channelId }: { channelId: string }) {
    const { query, update, activeCount } = useForumQuery(channelId)
    const [text, setText] = useState(query.name ?? '')
    const settled = useSettledQuery(text.trim())
    // biome-ignore lint/correctness/useExhaustiveDependencies: only a settled text changes the query
    useEffect(() => {
        if (settled !== (query.name ?? ''))
            update({ name: settled || undefined })
    }, [settled])
    // The query is cleared elsewhere (the empty state's clear button).
    // biome-ignore lint/correctness/useExhaustiveDependencies: only a changed query text is followed
    useEffect(() => {
        if ((query.name ?? '') !== settled) setText(query.name ?? '')
    }, [query.name])
    return (
        <View style={styles.bar}>
            <View style={styles.field}>
                <SearchField
                    placeholder={t('forum.search.placeholder')}
                    value={text}
                    onChangeText={setText}
                />
            </View>
            <View>
                <IconButton
                    size="md"
                    icon="FiltersHorizontalIcon"
                    variant={activeCount > 0 ? 'active' : 'secondary'}
                    accessibilityLabel={t('forum.filter.title')}
                    onPress={() => openForumFilterSheet(channelId)}
                />
                {activeCount > 0 && (
                    <View style={styles.badge} pointerEvents="none">
                        <Badge count={activeCount} />
                    </View>
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        // Inside the list's padding: 12 to every edge, and 12 down to the first card past its half gap.
        paddingHorizontal: theme.space.PX_4,
        paddingTop: theme.space.PX_4,
        paddingBottom: theme.space.PX_8,
    },
    field: { flex: 1 },
    badge: {
        position: 'absolute',
        top: -theme.space.PX_4,
        right: -theme.space.PX_4,
    },
}))
