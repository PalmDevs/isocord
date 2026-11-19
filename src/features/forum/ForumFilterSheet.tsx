import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import {
    MIN_TAGS_TO_MATCH,
    TagSetting,
    ThreadSortBy,
} from '../../core/discord/forum'
import { useSessionStore } from '../../core/react'
import { Button } from '../../design/components/buttons/Button'
import { SegmentedControl } from '../../design/components/inputs/SegmentedControl'
import { useSegmentedControlState } from '../../design/components/inputs/useSegmentedControlState'
import {
    ActionSheet,
    BottomSheetTitleHeader,
} from '../../design/components/sheets/Sheet'
import { openActionSheet } from '../../design/components/sheets/sheetStore'
import {
    TableRadioGroup,
    TableRadioRow,
} from '../../design/components/table/TableControlRows'
import { TableRowGroupTitle } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { ForumTagChips } from './ForumTagChips'
import { useForumQuery } from './useForumQuery'

/** The dimming of the match control while it has nothing to match. */
const DISABLED_OPACITY = 0.4
const MATCH_SETTINGS = [TagSetting.MATCH_SOME, TagSetting.MATCH_ALL]

/** ForumDisplaySettingsActionSheet's Tag Matching: a segmented control of Match Some and Match All. */
function TagMatchControl({
    value,
    enabled,
    onChange,
}: {
    value: TagSetting
    /** Matching needs MIN_TAGS_TO_MATCH tags; until then the control is shown dimmed. */
    enabled: boolean
    onChange: (setting: TagSetting) => void
}) {
    const state = useSegmentedControlState({
        items: [
            { id: TagSetting.MATCH_SOME, label: t('forum.filter.matchSome') },
            { id: TagSetting.MATCH_ALL, label: t('forum.filter.matchAll') },
        ],
        defaultIndex: MATCH_SETTINGS.indexOf(value),
        onSetActiveIndex: index => {
            const setting = MATCH_SETTINGS[index]
            if (setting) onChange(setting)
        },
    })
    return (
        <View
            style={!enabled && styles.disabled}
            pointerEvents={enabled ? 'auto' : 'none'}
            accessibilityState={{ disabled: !enabled }}
        >
            <SegmentedControl state={state} />
        </View>
    )
}

/**
 * ForumDisplaySettingsActionSheet and ForumTagFilterActionSheet in one: the sort, the tags and how they match
 * (dimmed until two tags are chosen). Changes apply at once, as the reference's sort does (its tag filter applies on close), so the
 * list updates under the sheet.
 */
function ForumFilterSheet({ channelId }: { channelId: string }) {
    const { query, update, reset, activeCount } = useForumQuery(channelId)
    const availableTags = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.available_tags,
    )
    const toggleTag = (id: string) =>
        update({
            tagIds: query.tagIds.includes(id)
                ? query.tagIds.filter(other => other !== id)
                : [...query.tagIds, id],
        })
    return (
        <ActionSheet
            scrollable
            header={
                <BottomSheetTitleHeader
                    title={t('forum.filter.title')}
                    leading={
                        activeCount > 0 ? (
                            <Button
                                variant="tertiary"
                                size="sm"
                                text={t('forum.filter.reset')}
                                onPress={reset}
                            />
                        ) : undefined
                    }
                />
            }
        >
            <TableRadioGroup
                title={t('forum.filter.sortBy')}
                value={query.sortBy}
                onChange={sortBy => update({ sortBy: sortBy as ThreadSortBy })}
            >
                <TableRadioRow
                    value={ThreadSortBy.LAST_MESSAGE_TIME}
                    label={t('forum.filter.recentlyActive')}
                />
                <TableRadioRow
                    value={ThreadSortBy.CREATION_TIME}
                    label={t('forum.filter.datePosted')}
                />
            </TableRadioGroup>
            {availableTags && availableTags.length > 0 && (
                <View style={styles.tags}>
                    <TableRowGroupTitle
                        title={t('forum.filter.tags')}
                        style={styles.tagsTitle}
                    />
                    <ForumTagChips
                        tags={availableTags}
                        selectedIds={query.tagIds}
                        onToggle={toggleTag}
                    />
                    <TagMatchControl
                        value={query.tagSetting}
                        enabled={query.tagIds.length >= MIN_TAGS_TO_MATCH}
                        onChange={tagSetting => update({ tagSetting })}
                    />
                </View>
            )}
        </ActionSheet>
    )
}

/** Opens the sort and filter sheet of a forum. */
export function openForumFilterSheet(channelId: string): void {
    openActionSheet(
        `forum-filter-${channelId}`,
        <ForumFilterSheet channelId={channelId} />,
    )
}

// The sheet body already pads the sides and spaces its sections, so the tags add only their inner gap.
const styles = StyleSheet.create(theme => ({
    tags: { gap: theme.space.PX_12 },
    // The group's gap stands in for TableRowGroupTitle's own bottom margin.
    tagsTitle: { marginBottom: 0 },
    disabled: { opacity: DISABLED_OPACITY },
}))
