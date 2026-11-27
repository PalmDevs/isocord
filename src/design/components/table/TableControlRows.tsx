import {
    createContext,
    isValidElement,
    use,
    useCallback,
    useMemo,
    useState,
} from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { FormCheckbox, FormRadio, FormSwitch } from '../Forms'
import { Text } from '../Text'
import { TableRow } from './TableRow'
import { TableRowGroup } from './TableRowGroup'
import type { ReactNode } from 'react'
import type { TableRowProps } from './TableRow'

/** Plain-text version of a label for screen readers; elements contribute nothing. */
function textOf(node: ReactNode): string {
    return typeof node === 'string' || typeof node === 'number'
        ? String(node)
        : ''
}

type ControlRowProps = Pick<
    TableRowProps,
    'label' | 'subLabel' | 'disabled' | 'accessibilityHint' | 'icon'
>

function describe({ label, subLabel }: ControlRowProps) {
    return `${textOf(label)}, ${textOf(subLabel)}`
}

export interface TableSwitchRowProps extends ControlRowProps {
    value: boolean
    onValueChange?: (value: boolean) => void
    /** Rendered next to the label, e.g. a badge. */
    trailing?: ReactNode
    variant?: TableRowProps['variant']
    start?: TableRowProps['start']
    end?: TableRowProps['end']
}

/** A row that toggles a FormSwitch; the whole row is the switch for touch and screen readers. */
export function TableSwitchRow({
    value,
    onValueChange,
    label,
    subLabel,
    icon,
    trailing,
    disabled = false,
    accessibilityHint,
    variant,
    start,
    end,
}: TableSwitchRowProps) {
    const toggle = () => onValueChange?.(!value)
    const labelWithTrailing =
        trailing != null ? (
            <View style={styles.labelWithTrailing}>
                {isValidElement(label) ? (
                    label
                ) : (
                    <Text
                        variant="text-md/semibold"
                        color={
                            variant === 'danger'
                                ? 'TEXT_FEEDBACK_CRITICAL'
                                : 'MOBILE_TEXT_HEADING_PRIMARY'
                        }
                    >
                        {label}
                    </Text>
                )}
                {trailing}
            </View>
        ) : (
            label
        )

    return (
        <TableRow
            label={labelWithTrailing}
            subLabel={subLabel}
            icon={icon}
            variant={variant}
            disabled={disabled}
            start={start}
            end={end}
            accessible
            accessibilityRole="switch"
            accessibilityState={{ disabled, checked: value }}
            accessibilityLabel={describe({ label, subLabel })}
            accessibilityHint={accessibilityHint}
            onPress={toggle}
            trailing={
                <FormSwitch
                    aria-hidden
                    value={value}
                    onValueChange={toggle}
                    disabled={disabled}
                />
            }
        />
    )
}

export interface TableCheckboxRowProps
    extends ControlRowProps,
        Pick<TableRowProps, 'icon' | 'start' | 'end' | 'subLabelLineClamp'> {
    checked: boolean
    onPress: (checked: boolean) => void
}

/** A row with a FormCheckbox at the end. `onPress` receives the next checked state. */
export function TableCheckboxRow({
    checked,
    onPress,
    label,
    subLabel,
    disabled = false,
    accessibilityHint,
    icon,
    start,
    end,
    subLabelLineClamp,
}: TableCheckboxRowProps) {
    return (
        <TableRow
            label={label}
            subLabel={subLabel}
            icon={icon}
            start={start}
            end={end}
            subLabelLineClamp={subLabelLineClamp}
            disabled={disabled}
            accessible
            accessibilityRole="checkbox"
            accessibilityState={{ disabled, checked }}
            accessibilityLabel={describe({ label, subLabel })}
            accessibilityHint={accessibilityHint}
            onPress={() => onPress(!checked)}
            trailing={<FormCheckbox checked={checked} />}
        />
    )
}

interface TableRadioGroupContextValue {
    selectedValue: string | null
    onSelect: (value: string) => void
}

const TableRadioGroupContext = createContext<TableRadioGroupContextValue>({
    selectedValue: null,
    onSelect: () => {},
})

export interface TableRadioGroupProps {
    /** Controlled selection. Omit to let the group keep its own. */
    value?: string | null
    defaultValue?: string | null
    onChange?: (value: string) => void
    title?: ReactNode
    description?: ReactNode
    helperText?: ReactNode
    hasIcons?: boolean
    accessibilityLabel?: string
    children?: ReactNode
}

/** A TableRowGroup of TableRadioRows that share one selected value. */
export function TableRadioGroup({
    value,
    defaultValue = null,
    onChange,
    children,
    ...group
}: TableRadioGroupProps) {
    const [internal, setInternal] = useState(defaultValue)
    const controlled = value !== undefined
    const selectedValue = controlled ? value : internal

    const onSelect = useCallback(
        (next: string) => {
            if (!controlled) setInternal(next)
            onChange?.(next)
        },
        [controlled, onChange],
    )
    // Context value keeps its identity so consumers skip re-renders.
    const context = useMemo(
        () => ({ selectedValue, onSelect }),
        [selectedValue, onSelect],
    )

    return (
        <TableRadioGroupContext value={context}>
            <TableRowGroup accessibilityRole="radiogroup" {...group}>
                {children}
            </TableRowGroup>
        </TableRadioGroupContext>
    )
}

export interface TableRadioRowProps
    extends ControlRowProps,
        Pick<TableRowProps, 'icon'> {
    value: string
    /** Selection state and handler for use outside a TableRadioGroup. */
    legacyCompat_selected?: boolean
    legacyCompat_onPress?: () => void
}

/** A row with a FormRadio at the end; reads and sets the selection of the surrounding TableRadioGroup. */
export function TableRadioRow({
    value,
    label,
    subLabel,
    disabled = false,
    accessibilityHint,
    icon,
    legacyCompat_selected,
    legacyCompat_onPress,
}: TableRadioRowProps) {
    const { selectedValue, onSelect } = use(TableRadioGroupContext)
    const selected = legacyCompat_selected ?? selectedValue === value

    return (
        <TableRow
            label={label}
            subLabel={subLabel}
            icon={icon}
            disabled={disabled}
            accessible
            accessibilityRole="radio"
            accessibilityState={{ disabled, selected }}
            accessibilityLabel={describe({ label, subLabel })}
            accessibilityHint={accessibilityHint}
            onPress={() => {
                legacyCompat_onPress?.()
                onSelect(value)
            }}
            trailing={<FormRadio selected={selected} />}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    labelWithTrailing: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
    },
}))
