import { isValidElement, useContext } from 'react'
import { Image, Platform, useWindowDimensions, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Icon } from '../../icons/Icon'
import { RipplePressable } from '../buttons/RipplePressable'
import { Text } from '../Text'
import { TableRowDivider } from './TableRowGroup'
import { TableRowGroupContext } from './tableRowGroupContext'
import type { ReactNode } from 'react'
import type { ImageSourcePropType, PressableProps } from 'react-native'
import type { IconName } from '../../icons/Icon'
import type { SemanticColor, TextVariant } from '../../tokens'

export type TableRowVariant = 'default' | 'danger'

export interface TableRowProps
    extends Pick<
        PressableProps,
        | 'accessibilityRole'
        | 'accessibilityState'
        | 'accessibilityLabel'
        | 'accessibilityHint'
        | 'accessible'
        | 'testID'
    > {
    /** A string is styled as the row label; an element is rendered as given. */
    label: ReactNode
    /** A string is styled as the secondary label; an element is rendered as given. */
    subLabel?: ReactNode
    /** Leading slot, 32px wide: a TableRowIcon, an avatar, etc. */
    icon?: ReactNode
    /** Trailing slot: a Switch, a badge, or a TableRowTrailingText. */
    trailing?: ReactNode
    /** Show the disclosure chevron at the end of the row. */
    arrow?: boolean
    /** Makes the row pressable. Omit for a static row. */
    onPress?: () => void
    /** Runs on a long press of a pressable row. */
    onLongPress?: () => void
    /** Dims the row to 50% and blocks presses. */
    disabled?: boolean
    /** Round the top corners. Only used outside a TableRowGroup, which clips its own rows. */
    start?: boolean
    /** Round the bottom corners and drop the trailing divider. Only used outside a TableRowGroup. */
    end?: boolean
    labelLineClamp?: number
    subLabelLineClamp?: number
    variant?: TableRowVariant
    /** Fixed height instead of the 56px minimum. */
    height?: number
}

type TableRowInnerProps = Pick<
    TableRowProps,
    | 'label'
    | 'subLabel'
    | 'icon'
    | 'trailing'
    | 'arrow'
    | 'disabled'
    | 'labelLineClamp'
    | 'subLabelLineClamp'
    | 'variant'
    | 'height'
>

/** The row's content without a card behind it, so RowButton and other containers can reuse the layout. */
export function TableRowInner({
    label,
    subLabel,
    icon,
    trailing,
    arrow,
    disabled = false,
    labelLineClamp,
    subLabelLineClamp,
    variant = 'default',
    height,
}: TableRowInnerProps) {
    const { theme } = useUnistyles()
    const { fontScale } = useWindowDimensions()

    const trailingText =
        isValidElement(trailing) && trailing.type === TableRowTrailingText
            ? trailing
            : null
    // Large font scales stack the trailing text under the label instead of squeezing both on one line.
    const stacked = fontScale > (Platform.OS === 'android' ? 1.2 : 1.5)
    const labelVariant = theme.modules.mobile
        .TABLE_ROW_LABEL_TEXT_STYLE as TextVariant

    return (
        <View style={styles.row(disabled, height)}>
            {icon != null && <View style={styles.iconContainer}>{icon}</View>}
            <View
                style={styles.content(stacked, trailingText != null && arrow)}
            >
                <View style={styles.labels(trailingText != null, stacked)}>
                    {isValidElement(label) ? (
                        label
                    ) : (
                        <Text
                            variant={labelVariant}
                            color={
                                variant === 'danger'
                                    ? 'TEXT_FEEDBACK_CRITICAL'
                                    : 'TEXT_STRONG'
                            }
                            lineClamp={labelLineClamp}
                            style={styles.fontPadding}
                        >
                            {label}
                        </Text>
                    )}
                    {subLabel != null &&
                        (isValidElement(subLabel) ? (
                            subLabel
                        ) : (
                            <Text
                                variant="text-xs/medium"
                                color={
                                    variant === 'danger'
                                        ? 'TEXT_FEEDBACK_CRITICAL'
                                        : 'TEXT_SUBTLE'
                                }
                                lineClamp={subLabelLineClamp}
                                style={styles.fontPadding}
                            >
                                {subLabel}
                            </Text>
                        ))}
                </View>
                {trailingText != null && (
                    <View style={styles.trailingText(stacked)}>
                        {trailingText}
                    </View>
                )}
            </View>
            {trailing != null && trailingText == null && (
                <View style={styles.trailing}>{trailing}</View>
            )}
            {arrow && <TableRowArrow />}
        </View>
    )
}

/** One row of a settings-style list: leading icon, label and sub label, trailing content and an optional arrow. */
export function TableRow({
    label,
    subLabel,
    icon,
    trailing,
    arrow,
    onPress,
    onLongPress,
    disabled = false,
    start,
    end,
    labelLineClamp,
    subLabelLineClamp,
    variant = 'default',
    height,
    ...accessibility
}: TableRowProps) {
    const inGroup = useContext(TableRowGroupContext)

    const body = (
        <TableRowInner
            label={label}
            subLabel={subLabel}
            icon={icon}
            trailing={trailing}
            arrow={arrow}
            disabled={disabled}
            labelLineClamp={labelLineClamp}
            subLabelLineClamp={subLabelLineClamp}
            variant={variant}
            height={height}
        />
    )

    const roundStart = !inGroup && start === true
    const roundEnd = !inGroup && end === true
    const cardStyle = styles.card(roundStart, roundEnd)

    return (
        <>
            {onPress ? (
                // The Android ripple is the press state (PressableBase's themed ripple).
                <RipplePressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                    {...accessibility}
                    disabled={disabled}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    style={cardStyle}
                >
                    {body}
                </RipplePressable>
            ) : (
                <View {...accessibility} style={cardStyle}>
                    {body}
                </View>
            )}
            {!inGroup && !roundEnd && (
                <TableRowDivider adjustSpacingForIcon={icon != null} />
            )}
        </>
    )
}

export type TableRowIconVariant =
    | 'default'
    | 'danger'
    | 'secondary'
    | 'translucent'
    | 'text-status-online'
    | 'text-status-idle'
    | 'text-status-dnd'
    | 'text-status-offline'

const ICON_COLORS: Record<TableRowIconVariant, SemanticColor> = {
    default: 'TABLEROW_ICON_COLOR_DEFAULT',
    danger: 'TEXT_FEEDBACK_CRITICAL',
    secondary: 'INTERACTIVE_TEXT_DEFAULT',
    translucent: 'WHITE',
    'text-status-online': 'TEXT_STATUS_ONLINE',
    'text-status-idle': 'TEXT_STATUS_IDLE',
    'text-status-dnd': 'TEXT_STATUS_DND',
    'text-status-offline': 'TEXT_STATUS_OFFLINE',
}

/** The size of an `md` Icon, for an image drawn in its place. */
const ICON_IMAGE_SIZE = 24

/**
 * Leading icon for a TableRow: a 24px glyph for the default variant, 16px for the tinted ones. `source` draws a
 * one-colour image with no Mana icon instead, tinted the same.
 */
export function TableRowIcon({
    name,
    source,
    variant = 'default',
}: (
    | { name: IconName; source?: undefined }
    | { name?: undefined; source: ImageSourcePropType }
) & {
    variant?: TableRowIconVariant
}) {
    return (
        <View style={styles.icon}>
            {name ? (
                <Icon name={name} color={ICON_COLORS[variant]} />
            ) : (
                <Image
                    source={source}
                    style={styles.iconImage(ICON_COLORS[variant])}
                />
            )}
        </View>
    )
}

/** Disclosure chevron shown at the end of a pressable row. */
export function TableRowArrow() {
    return (
        <Icon
            name="ChevronSmallRightIcon"
            color="INTERACTIVE_TEXT_DEFAULT"
            style={styles.arrow}
        />
    )
}

/** Muted trailing value, e.g. the current setting. Placed in a row's `trailing` slot. */
export function TableRowTrailingText({ text }: { text: string }) {
    return (
        <Text variant="text-sm/medium" color="TEXT_MUTED" lineClamp={1}>
            {text}
        </Text>
    )
}

const styles = StyleSheet.create(theme => ({
    card: (start: boolean, end: boolean) => ({
        backgroundColor: theme.colors.CARD_MUTED_BG,
        borderTopLeftRadius: start
            ? theme.modules.mobile.TABLE_ROW_BORDER_RADIUS
            : 0,
        borderTopRightRadius: start
            ? theme.modules.mobile.TABLE_ROW_BORDER_RADIUS
            : 0,
        borderBottomLeftRadius: end
            ? theme.modules.mobile.TABLE_ROW_BORDER_RADIUS
            : 0,
        borderBottomRightRadius: end
            ? theme.modules.mobile.TABLE_ROW_BORDER_RADIUS
            : 0,
    }),
    row: (disabled: boolean, height?: number) => ({
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.modules.mobile.TABLE_ROW_PADDING,
        minHeight: theme.modules.mobile.TABLE_ROW_HEIGHT,
        height,
        opacity: disabled ? 0.5 : 1,
    }),
    iconContainer: {
        minWidth: theme.modules.mobile.TABLE_ROW_ICON_SIZE,
        marginEnd: theme.modules.mobile.TABLE_ROW_PADDING,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // The 4px before the arrow is ours; the reference puts the trailing text right against it.
    content: (stacked: boolean, beforeArrow?: boolean) => ({
        flexShrink: 1,
        flexGrow: 1,
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'stretch' : 'center',
        justifyContent: 'space-between',
        marginEnd: beforeArrow ? 4 : 0,
    }),
    // The reference sizes the labels with width 100% clamped to 70% and lets both sides shrink.
    // Yoga mis-distributes that: the trailing text overflows the row padding and short labels
    // still reserve 70%. Ours keeps the labels at their own width (up to 70%) and gives the
    // trailing text the rest, so it can't overflow and only truncates when it has to.
    labels: (hasTrailingText: boolean, stacked: boolean) =>
        hasTrailingText && !stacked
            ? { flexShrink: 1, maxWidth: '70%' }
            : { width: '100%', flexShrink: 1 },
    // The reference keeps Android font padding on row labels; Text turns it off by default.
    fontPadding: { includeFontPadding: true },
    trailing: { marginStart: 18 },
    trailingText: (stacked: boolean) =>
        stacked
            ? { flexShrink: 1 }
            : { flex: 1, alignItems: 'flex-end', marginStart: 18 },
    icon: {
        width: theme.modules.mobile.TABLE_ROW_ICON_SIZE,
        height: theme.modules.mobile.TABLE_ROW_ICON_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.lg,
    },
    iconImage: (color: SemanticColor) => ({
        width: ICON_IMAGE_SIZE,
        height: ICON_IMAGE_SIZE,
        tintColor: theme.colors[color],
    }),
    arrow: {
        width: theme.modules.mobile.TABLE_ROW_ARROW_WIDTH,
        height: 24,
        marginStart: theme.modules.mobile.TABLE_ROW_ARROW_MARGIN_START,
        marginEnd: theme.modules.mobile.TABLE_ROW_ARROW_MARGIN_END,
    },
}))
