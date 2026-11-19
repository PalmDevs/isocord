import { Children, isValidElement } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Avatar } from '../avatars/Avatar'
import { Text } from '../Text'
import type { ReactNode } from 'react'
import type { SemanticColor, TextVariant } from '../../tokens'
import type { AvatarUser } from '../avatars/avatarUrl'

export interface PileProps {
    /** One size for every item, or one per child. */
    size: number | number[]
    /** Clear space left between an item and the one overlapping it. */
    gap?: number
    /** Fraction of the item's width that stays visible beside the next one (0 to 1). */
    depthX?: number
    /** Same as `depthX`, vertically. Leave unset for a flat row. */
    depthY?: number
    /** Cutout shape; the reference clips the lower item, here a ring of `cutoutColor` is drawn on the upper one. */
    shape?: 'circle' | 'rounded-rect'
    /** Colour of the surface behind the pile, used for the cutout ring. */
    cutoutColor?: SemanticColor
    'aria-label'?: string
    children?: ReactNode
}

/** Overlapping row of avatars or guild icons (Pile). */
export function Pile({
    size,
    gap = 2,
    depthX,
    depthY,
    shape = 'circle',
    cutoutColor = 'BACKGROUND_BASE_LOW',
    children,
    ...props
}: PileProps) {
    const items = Children.toArray(children).filter(isValidElement)
    if (Array.isArray(size) && size.length !== items.length) {
        throw new Error(
            'Pile: size array must have the same number of elements as children',
        )
    }
    const sizeAt = (index: number) =>
        Array.isArray(size) ? (size[index] ?? 0) : size

    return (
        <View style={styles.pile} accessible aria-label={props['aria-label']}>
            {items.map((item, index) => {
                const itemSize = sizeAt(index)
                const previous = index > 0 ? sizeAt(index - 1) : 0
                const marginLeft =
                    index === 0
                        ? 0
                        : depthX == null
                          ? -previous
                          : -previous * depthX + gap
                const marginTop =
                    index === 0 || depthY == null
                        ? 0
                        : index * (previous - previous * depthY + gap)
                return (
                    <View
                        key={item.key}
                        style={styles.item(itemSize, marginLeft, marginTop)}
                    >
                        {index > 0 ? (
                            <View
                                style={styles.ring(
                                    itemSize,
                                    gap,
                                    shape,
                                    cutoutColor,
                                )}
                            >
                                {item}
                            </View>
                        ) : (
                            item
                        )}
                    </View>
                )
            })}
        </View>
    )
}

export interface AvatarPileProps extends Omit<PileProps, 'children' | 'size'> {
    users: AvatarUser[]
    size?: number
    /** Total number of users, when more than the first `max` are shown. */
    totalCount?: number
    max?: number
}

const OVERFLOW_VARIANTS: [number, TextVariant][] = [
    [64, 'text-lg/semibold'],
    [48, 'text-md/semibold'],
    [40, 'text-md/semibold'],
    [30, 'text-sm/semibold'],
    [24, 'text-xs/semibold'],
    [16, 'text-xxs/semibold'],
]

/** Grey "+N" bubble that closes a pile (PileOverflow). */
export function PileOverflow({
    size,
    value,
    borderRadius = size / 2,
}: {
    size: number
    value: number
    borderRadius?: number
}) {
    const variant =
        OVERFLOW_VARIANTS.find(([step]) => size >= step)?.[1] ??
        'text-xxs/semibold'
    return (
        <View style={styles.overflow(size, borderRadius)}>
            <Text variant={variant} lineClamp={1} maxFontSizeMultiplier={2}>
                +{value}
            </Text>
        </View>
    )
}

/** Pile of user avatars, collapsing the rest into a "+N" bubble (AvatarPile). */
export function AvatarPile({
    users,
    size = 24,
    totalCount = users.length,
    max = 3,
    ...props
}: AvatarPileProps) {
    const shown = users.slice(0, max)
    const hidden = totalCount - shown.length
    return (
        <Pile
            {...props}
            size={size}
            depthX={0.4}
            gap={Math.max(2, Math.round(size / 12))}
        >
            {shown.map(user => (
                <Avatar key={user.id} user={user} size={size} />
            ))}
            {hidden > 0 && (
                <PileOverflow key="overflow" size={size} value={hidden} />
            )}
        </Pile>
    )
}

const styles = StyleSheet.create(theme => ({
    pile: { flexDirection: 'row' },
    item: (size: number, marginLeft: number, marginTop: number) => ({
        height: size,
        marginLeft,
        marginTop,
    }),
    ring: (
        size: number,
        gap: number,
        shape: 'circle' | 'rounded-rect',
        color: SemanticColor,
    ) => ({
        // Grows outward by `gap` so the ring bites into the item beneath it.
        margin: -gap,
        padding: gap,
        alignSelf: 'flex-start',
        borderRadius: shape === 'circle' ? theme.radii.round : size / 3 + gap,
        backgroundColor: theme.colors[color],
    }),
    overflow: (size: number, borderRadius: number) => ({
        minWidth: size,
        height: size,
        borderRadius,
        paddingHorizontal: size >= 32 ? 8 : 4,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        backgroundColor: theme.colors.BACKGROUND_MOD_STRONG,
    }),
}))
