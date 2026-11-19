import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { TagEmoji } from './ForumPostTags'
import type { ForumTag } from '../../core/discord/forum'

/**
 * The tags to filter by as a wrapped group of pills, sized and coloured like the message search filter chips
 * (`FilterBar`): secondary, and primary when selected (the weight stays). A departure from the reference's checkbox rows (ForumTagFilterActionSheet).
 */
export function ForumTagChips({
    tags,
    selectedIds,
    onToggle,
}: {
    tags: ForumTag[]
    selectedIds: string[]
    onToggle: (id: string) => void
}) {
    return (
        <View style={styles.group}>
            {tags.map(tag => {
                const selected = selectedIds.includes(tag.id)
                return (
                    <RipplePressable
                        key={tag.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={t('forum.filter.tagLabel', {
                            tagName: tag.name,
                        })}
                        onPress={() => onToggle(tag.id)}
                        style={[styles.chip, selected && styles.selected]}
                    >
                        <TagEmoji tag={tag} />
                        <Text
                            variant="text-sm/medium"
                            color={
                                selected
                                    ? 'CONTROL_PRIMARY_TEXT_DEFAULT'
                                    : 'CONTROL_SECONDARY_TEXT_DEFAULT'
                            }
                            lineClamp={1}
                            style={styles.label}
                        >
                            {tag.name}
                        </Text>
                    </RipplePressable>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    group: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.PX_8 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
        height: theme.space.PX_32,
        paddingHorizontal: theme.space.PX_12,
        overflow: 'hidden',
        borderWidth: 1,
        borderRadius: theme.radii.round,
        borderColor: theme.colors.CONTROL_SECONDARY_BORDER_DEFAULT,
        backgroundColor: theme.colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
    },
    selected: {
        borderColor: theme.colors.CONTROL_PRIMARY_BORDER_DEFAULT,
        backgroundColor: theme.colors.CONTROL_PRIMARY_BACKGROUND_DEFAULT,
    },
    label: { flexShrink: 1 },
}))
