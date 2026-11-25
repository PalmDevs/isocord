import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { TagEmoji } from './ForumPostTags'
import type { ReactNode } from 'react'
import type { ForumTag } from '../../core/discord/forum'

const DISABLED_OPACITY = 0.4

/**
 * The tags to filter by as a wrapped group of pills, sized and coloured like the message search filter chips
 * (`FilterBar`): secondary, and primary when selected (the weight stays). A departure from the reference's checkbox rows (ForumTagFilterActionSheet).
 */
export function ForumTagChips({
    tags,
    selectedIds = [],
    disabledIds,
    onToggle,
    trailing,
}: {
    tags: ForumTag[]
    selectedIds?: string[]
    disabledIds?: ReadonlySet<string>
    onToggle: (id: string) => void
    /** Optional trailing element in the wrapped row, such as an Add Tag chip. */
    trailing?: ReactNode
}) {
    return (
        <View style={styles.group}>
            {tags.map(tag => {
                const selected = selectedIds.includes(tag.id)
                const disabled = disabledIds?.has(tag.id) ?? false
                return (
                    <RipplePressable
                        key={tag.id}
                        disabled={disabled}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected, disabled }}
                        accessibilityLabel={t('forum.filter.tagLabel', {
                            tagName: tag.name,
                        })}
                        onPress={() => onToggle(tag.id)}
                        style={[
                            styles.chip,
                            selected && styles.selected,
                            disabled && styles.disabled,
                        ]}
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
            {trailing}
        </View>
    )
}

/** Pill button styled like a forum tag chip, used to add a new tag. */
export function ForumTagAddChip({ onPress }: { onPress: () => void }) {
    return (
        <RipplePressable
            accessibilityRole="button"
            accessibilityLabel={t('channelSettings.addTag')}
            onPress={onPress}
            style={styles.chip}
        >
            <Icon
                name="PlusSmallIcon"
                size="xs"
                color="CONTROL_SECONDARY_TEXT_DEFAULT"
            />
            <Text
                variant="text-sm/medium"
                color="CONTROL_SECONDARY_TEXT_DEFAULT"
                lineClamp={1}
                style={styles.label}
            >
                {t('channelSettings.addTag')}
            </Text>
        </RipplePressable>
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
    disabled: { opacity: DISABLED_OPACITY },
    label: { flexShrink: 1 },
}))
