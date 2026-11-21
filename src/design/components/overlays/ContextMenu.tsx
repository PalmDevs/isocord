import { Fragment } from 'react'
import { Pressable, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Icon } from '../../icons/Icon'
import { dismissKeyboard } from '../keyboard'
import { Text } from '../Text'
import { AnchoredPopover } from './Popover'
import { useAnchor, usePopoverClose } from './popoverHooks'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { IconName } from '../../icons/Icon'
import type { PopoverAlign } from './Popover'

/** ContextMenuConstants: CONTEXT_MENU_LONG_PRESS_DURATION_MS, _MIN_WIDTH, _ITEM_BASE_HEIGHT, _DIVIDER_HEIGHT. */
const LONG_PRESS_MS = 300
const MIN_WIDTH = 220
const ITEM_HEIGHT = 42
const DIVIDER_HEIGHT = 4

export interface ContextMenuItemDef {
    label: string
    /** Runs after the menu has closed. */
    action?: () => void
    /** Runs immediately when tapped, before the menu begins closing. */
    onPress?: () => void
    /** Shown before the label. */
    icon?: IconName
    /** Shown at the end of the row, e.g. a checkmark for a selected option. */
    trailingIndicator?: ReactNode
    variant?: 'default' | 'destructive'
    /** End a section: a thick divider goes under this item. */
    divider?: boolean
    accessibilityRole?: 'menuitem' | 'button' | 'radio' | 'checkbox'
    accessibilityState?: { checked?: boolean; selected?: boolean }
}

export interface ContextMenuProps {
    items: ContextMenuItemDef[]
    /** Heading row above the items. */
    title?: string
    /**
     * What the menu belongs to. Pass a function to attach the gesture yourself: it gets `open`, for
     * when the content is already a Pressable and a wrapper would never see its long press.
     */
    children: ReactNode | ((api: { open: () => void }) => ReactNode)
    /** Open on long press. Defaults to true. */
    triggerOnLongPress?: boolean
    /** Also open on a plain tap. */
    triggerOnTap?: boolean
    enabled?: boolean
    align?: PopoverAlign
    onOpen?: () => void
    onClose?: () => void
    style?: StyleProp<ViewStyle>
}

/** Wraps content so that long-pressing it opens a floating menu of actions, on a dimmed screen. */
export function ContextMenu({
    items,
    title,
    children,
    triggerOnLongPress = true,
    triggerOnTap = false,
    enabled = true,
    align,
    onOpen,
    onClose,
    style,
}: ContextMenuProps) {
    const { ref, anchor, open, clear } = useAnchor()
    const show = () => {
        dismissKeyboard()
        open(onOpen)
    }
    const active = enabled && (triggerOnLongPress || triggerOnTap)
    return (
        <>
            <Pressable
                ref={ref}
                collapsable={false}
                disabled={!active}
                delayLongPress={LONG_PRESS_MS}
                onLongPress={enabled && triggerOnLongPress ? show : undefined}
                onPress={enabled && triggerOnTap ? show : undefined}
                style={style}
            >
                {typeof children === 'function'
                    ? children({ open: show })
                    : children}
            </Pressable>
            {anchor && (
                <AnchoredPopover
                    dim
                    anchor={anchor}
                    align={align}
                    minWidth={MIN_WIDTH}
                    onClose={() => {
                        clear()
                        onClose?.()
                    }}
                >
                    <ContextMenuPanel items={items} title={title} />
                </AnchoredPopover>
            )}
        </>
    )
}

/**
 * The floating panel of a ContextMenu: optional title, then the items. Discord's ContextMenuPopout:
 * the title and each section end with a ContextMenuDivider, other items with a hairline border.
 */
export function ContextMenuPanel({
    items,
    title,
}: Pick<ContextMenuProps, 'items' | 'title'>) {
    return (
        <View accessibilityRole="list" style={styles.panel}>
            {title != null && (
                <>
                    <View style={styles.titleRow}>
                        <Text
                            accessibilityRole="header"
                            variant="text-md/bold"
                            color="MOBILE_TEXT_HEADING_PRIMARY"
                        >
                            {title}
                        </Text>
                    </View>
                    <View style={styles.divider} />
                </>
            )}
            {items.map((item, index) => {
                const last = index === items.length - 1
                return (
                    <Fragment key={item.label}>
                        <ContextMenuItem
                            item={item}
                            first={index === 0 && title == null}
                            last={last}
                        />
                        {item.divider && !last && (
                            <View style={styles.divider} />
                        )}
                    </Fragment>
                )
            })}
        </View>
    )
}

/** Discord's ContextMenuItem: icon, label, then the trailing indicator pushed to the end. */
function ContextMenuItem({
    item,
    first,
    last,
}: {
    item: ContextMenuItemDef
    first: boolean
    last: boolean
}) {
    const close = usePopoverClose()
    const destructive = item.variant === 'destructive'
    const color = destructive ? 'TEXT_FEEDBACK_CRITICAL' : 'TEXT_STRONG'
    return (
        <Pressable
            accessibilityRole={item.accessibilityRole ?? 'menuitem'}
            accessibilityLabel={item.label}
            accessibilityState={item.accessibilityState}
            onPress={() => {
                item.onPress?.()
                close(item.action)
            }}
            style={({ pressed }) => [
                styles.item(pressed),
                !last && !item.divider && styles.border,
                first && styles.roundedTop,
                last && styles.roundedBottom,
            ]}
        >
            {item.icon && <Icon name={item.icon} size="sm" color={color} />}
            <Text
                variant="text-md/medium"
                color={color}
                lineClamp={1}
                style={styles.label}
            >
                {item.label}
            </Text>
            {item.trailingIndicator != null && (
                <View style={styles.trailing}>{item.trailingIndicator}</View>
            )}
        </Pressable>
    )
}

const styles = StyleSheet.create(theme => ({
    panel: {
        minWidth: MIN_WIDTH,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.BORDER_SUBTLE,
        backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGHEST,
        boxShadow: theme.shadows.SHADOW_HIGH,
    },
    titleRow: { padding: theme.space.PX_12 },
    divider: {
        borderBottomWidth: DIVIDER_HEIGHT,
        borderBottomColor: theme.colors.BORDER_SUBTLE,
    },
    border: {
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.BORDER_SUBTLE,
    },
    roundedTop: {
        borderTopLeftRadius: theme.radii.lg,
        borderTopRightRadius: theme.radii.lg,
    },
    roundedBottom: {
        borderBottomLeftRadius: theme.radii.lg,
        borderBottomRightRadius: theme.radii.lg,
    },
    item: (pressed: boolean) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        minHeight: ITEM_HEIGHT,
        padding: theme.space.PX_12,
        backgroundColor: pressed
            ? theme.colors.BACKGROUND_MOD_SUBTLE
            : undefined,
    }),
    label: { flexShrink: 1 },
    trailing: { marginLeft: 'auto' },
}))
