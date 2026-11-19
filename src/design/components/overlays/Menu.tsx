import { Children, isValidElement } from 'react'
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

/** Width of a Menu in the reference client. */
const MENU_WIDTH = 220

export interface MenuProps {
    children?: ReactNode
    style?: StyleProp<ViewStyle>
}

/** Panel of MenuItems. Groups (MenuGroup) are separated by a hairline. Shown by MenuPopout. */
export function Menu({ children, style }: MenuProps) {
    const entries = Children.toArray(children)
    return (
        <View accessibilityRole="list" style={[styles.menu, style]}>
            {entries.map((child, index) => (
                // toArray gives every element a stable key.
                <View key={isValidElement(child) ? child.key : index}>
                    {index > 0 &&
                        isValidElement(child) &&
                        child.type === MenuGroup && (
                            <View style={styles.divider} />
                        )}
                    {child}
                </View>
            ))}
        </View>
    )
}

/** Items that belong together, separated from the rest of the menu by a divider. */
export function MenuGroup({ children }: { children?: ReactNode }) {
    return <View>{children}</View>
}

export interface MenuItemProps {
    label: string
    /** A named icon, or an element rendered as given. */
    icon?: IconName | ReactNode
    /** Content at the end of the row: a checkmark, a keyboard hint, etc. */
    trailing?: ReactNode
    variant?: 'default' | 'danger'
    disabled?: boolean
    /** Keep the menu open after the press. */
    keepOpen?: boolean
    /** Runs after the menu has closed. */
    onPress?: () => void
    accessibilityRole?: 'menuitem' | 'radio' | 'checkbox'
    accessibilityState?: { checked?: boolean; selected?: boolean }
}

export function MenuItem({
    label,
    icon,
    trailing,
    variant = 'default',
    disabled = false,
    keepOpen = false,
    onPress,
    accessibilityRole = 'menuitem',
    accessibilityState,
}: MenuItemProps) {
    const close = usePopoverClose()
    const color =
        variant === 'danger' ? 'TEXT_FEEDBACK_CRITICAL' : 'TEXT_STRONG'
    return (
        <Pressable
            accessibilityRole={accessibilityRole}
            accessibilityLabel={label}
            accessibilityState={{ disabled, ...accessibilityState }}
            disabled={disabled}
            onPress={() => (keepOpen ? onPress?.() : close(onPress))}
            style={({ pressed }) => styles.item(pressed, disabled)}
        >
            {typeof icon === 'string' ? (
                <Icon name={icon as IconName} size="sm" color={color} />
            ) : (
                icon
            )}
            <Text
                variant="text-sm/medium"
                color={color}
                lineClamp={1}
                style={styles.label}
            >
                {label}
            </Text>
            {trailing}
        </Pressable>
    )
}

export interface MenuPopoutProps {
    /** Renders the control that opens the menu. `expanded` is true while the menu is open. */
    trigger: (props: { open: () => void; expanded: boolean }) => ReactNode
    /** The menu content: MenuItems and MenuGroups. */
    children?: ReactNode
    align?: PopoverAlign
    onOpen?: () => void
    onClose?: () => void
    /** Style of the wrapper around the trigger. */
    style?: StyleProp<ViewStyle>
}

/** A trigger and the Menu that pops out next to it, below or above depending on the room. */
export function MenuPopout({
    trigger,
    children,
    align,
    onOpen,
    onClose,
    style,
}: MenuPopoutProps) {
    const { ref, anchor, open, clear } = useAnchor()
    return (
        <>
            <View ref={ref} collapsable={false} style={style}>
                {trigger({
                    open: () => {
                        dismissKeyboard()
                        open(onOpen)
                    },
                    expanded: anchor !== null,
                })}
            </View>
            {anchor && (
                <AnchoredPopover
                    anchor={anchor}
                    align={align}
                    minWidth={MENU_WIDTH}
                    onClose={() => {
                        clear()
                        onClose?.()
                    }}
                >
                    <Menu>{children}</Menu>
                </AnchoredPopover>
            )}
        </>
    )
}

const styles = StyleSheet.create(theme => ({
    menu: {
        width: MENU_WIDTH,
        overflow: 'hidden',
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGH,
        boxShadow: theme.shadows.SHADOW_HIGH,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.BORDER_SUBTLE,
    },
    item: (pressed: boolean, disabled: boolean) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_12,
        minHeight: 44,
        paddingHorizontal: theme.space.PX_12,
        opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed
            ? theme.colors.BACKGROUND_MOD_SUBTLE
            : undefined,
    }),
    label: { flex: 1 },
}))
