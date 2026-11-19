import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from './Text'
import type { ReactNode } from 'react'
import type { TextVariant } from '../tokens'

export type TagSize = 'xs' | 'sm' | 'md'
export type TagVariant = 'default' | 'filter'
export type TagLayout = 'default' | 'inline'

export interface TagItem {
    id: string
    label: string
    /** Leading graphic, for example an Icon or Avatar sized for the tag. */
    icon?: ReactNode
    /** Trailing graphic after the label, such as a role icon. */
    trailing?: ReactNode
}

export interface TagGroupProps {
    label?: string
    items: TagItem[]
    /** Defaults to md, or sm when layout is inline. */
    size?: TagSize
    variant?: TagVariant
    /** Inline keeps one line and clips the overflow. */
    layout?: TagLayout
}

const TEXT_VARIANTS: Record<TagSize, TextVariant> = {
    xs: 'text-xs/medium',
    sm: 'text-sm/medium',
    md: 'text-md/medium',
}

export function TagGroup({
    label,
    items,
    size,
    variant = 'default',
    layout = 'default',
}: TagGroupProps) {
    const inline = layout === 'inline'
    const resolved = size ?? (inline ? 'sm' : 'md')
    return (
        <View
            accessibilityRole="list"
            accessibilityLabel={label}
            style={[styles.group, inline && styles.inline]}
        >
            {items.map(item => (
                <View
                    key={item.id}
                    style={[
                        styles.tag(resolved, variant),
                        inline && styles.tagInline,
                    ]}
                >
                    {item.icon}
                    <Text
                        color="CONTROL_SECONDARY_TEXT_DEFAULT"
                        variant={TEXT_VARIANTS[resolved]}
                        lineClamp={1}
                        style={styles.label}
                    >
                        {item.label}
                    </Text>
                    {item.trailing}
                </View>
            ))}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    group: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.space.PX_8,
    },
    inline: { flexWrap: 'nowrap', flexShrink: 1, overflow: 'hidden' },
    tag: (size: TagSize, variant: TagVariant) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: size === 'md' ? theme.space.PX_8 : theme.space.PX_4,
        minHeight: size === 'xs' ? 24 : size === 'sm' ? 30 : 40,
        paddingVertical: size === 'xs' ? 0 : theme.space.PX_4,
        paddingHorizontal: size === 'md' ? theme.space.PX_12 : theme.space.PX_8,
        borderWidth: 1,
        borderRadius:
            variant === 'filter'
                ? theme.radii.round
                : size === 'md'
                  ? theme.radii.sm
                  : theme.radii.xs,
        borderColor: theme.colors.CONTROL_SECONDARY_BORDER_DEFAULT,
        backgroundColor: theme.colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
    }),
    tagInline: { flexShrink: 1, minWidth: 0 },
    label: { flexShrink: 1 },
}))
