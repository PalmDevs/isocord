import { useNavigation } from '@react-navigation/native'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, {
    Easing,
    ReduceMotion,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { Button } from '../../design/components/buttons/Button'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Slider } from '../../design/components/inputs/Slider'
import { Card } from '../../design/components/layout/Card'
import { Stack } from '../../design/components/layout/Stack'
import { Text } from '../../design/components/Text'
import {
    TableRadioGroup,
    TableRadioRow,
    TableSwitchRow,
} from '../../design/components/table/TableControlRows'
import { TableRow, TableRowIcon } from '../../design/components/table/TableRow'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { SETTING_RENDERER_CONFIG } from './config'
import { useSettingSearchStore } from './search'
import { clearSelected, trailingText } from './settingRowUtils'
import type { IconName } from '../../design/icons/Icon'
import type { SettingContext, SettingKey, SettingNode } from './config'

type NodeOf<Type extends SettingNode['type']> = Extract<
    SettingNode,
    { type: Type }
>

const iconOf = (node: SettingNode) =>
    node.icon ? (
        <TableRowIcon
            name={node.icon}
            variant={node.variant === 'danger' ? 'danger' : 'default'}
        />
    ) : undefined

/**
 * SettingListItemHighlight: after the screen has opened, the search result's row brightens and fades back,
 * then the selection clears.
 */
function SettingHighlight({ top }: { top?: number }) {
    const opacity = useSharedValue(0)
    useEffect(() => {
        const ease = { duration: 300, easing: Easing.ease }
        opacity.value = withSequence(
            withDelay(500, withTiming(0, { duration: 0 })),
            withTiming(0.2, ease),
            withTiming(
                0,
                { ...ease, reduceMotion: ReduceMotion.System },
                finished => {
                    if (finished) scheduleOnRN(clearSelected)
                },
            ),
        )
    }, [opacity])
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
    return (
        <Animated.View
            pointerEvents="none"
            // Inside a TableRowGroup the group rounds the corners; below a title (a radio group) it rounds its own.
            style={[
                styles.highlight,
                top !== undefined && styles.highlightBelowTitle(top),
                style,
            ]}
        />
    )
}

// SettingRenderer's renderSettingItem.
function SettingRow({
    node,
    context,
}: {
    node: SettingNode
    context: SettingContext
}) {
    const navigation = useNavigation()
    switch (node.type) {
        case 'route':
            return (
                <TableRow
                    label={node.title()}
                    icon={iconOf(node)}
                    trailing={trailingText(node.trailing?.(context))}
                    variant={node.variant}
                    arrow
                    onPress={() => navigation.navigate(node.screen)}
                />
            )
        case 'toggle':
            return (
                <TableSwitchRow
                    label={node.title()}
                    subLabel={node.description?.()}
                    variant={node.variant}
                    value={node.value(context)}
                    disabled={node.disabled?.(context)}
                    onValueChange={value => node.onValueChange(context, value)}
                />
            )
        case 'pressable':
            return (
                <TableRow
                    label={node.title()}
                    icon={iconOf(node)}
                    variant={node.variant}
                    onPress={() => node.onPress(context)}
                />
            )
        case 'static':
            return (
                <TableRow
                    label={node.title()}
                    icon={iconOf(node)}
                    trailing={trailingText(node.trailing?.(context))}
                    variant={node.variant}
                />
            )
        case 'slider':
            return <SliderSetting node={node} />
        case 'radio':
            // Radios are groups of their own; SettingsList renders them.
            return null
    }
}

/**
 * SettingRenderer's SliderSetting: the title and value over the slider, whose end icons step it, and a reset
 * button. The slider keeps its own value; the setting hears of each change.
 */
function SliderSetting({ node }: { node: NodeOf<'slider'> }) {
    const props = node.useProps()
    const {
        minimumValue = 0,
        maximumValue = 1,
        step = 0.1,
        defaultValue = 1,
    } = props
    const [value, setValue] = useState(props.value ?? defaultValue)
    const title = node.title()
    const change = (next: number) => {
        setValue(next)
        props.onValueChange?.(next)
    }
    const stepButton = (icon: IconName | undefined, delta: number) =>
        icon && (
            <RipplePressable
                borderless
                radius={16}
                accessible={false}
                onPress={() =>
                    change(
                        Math.min(
                            Math.max(value + delta, minimumValue),
                            maximumValue,
                        ),
                    )
                }
            >
                <Icon name={icon} />
            </RipplePressable>
        )
    return (
        <Card shadow="none" border="none">
            <Stack>
                <Stack direction="horizontal" justify="space-between">
                    <Text variant="text-md/semibold">{title}</Text>
                    {props.valueLabel != null && (
                        <Text variant="text-sm/medium" color="TEXT_MUTED">
                            {props.valueLabel}
                        </Text>
                    )}
                </Stack>
                <View style={styles.slider}>
                    <Slider
                        value={value}
                        minimumValue={minimumValue}
                        maximumValue={maximumValue}
                        step={step}
                        onValueChange={change}
                        startIcon={stepButton(props.startIcon, -step)}
                        endIcon={stepButton(props.endIcon, step)}
                    />
                </View>
                <Button
                    variant="secondary"
                    text={t('settings.resetToDefault')}
                    disabled={value === defaultValue}
                    onPress={() => change(defaultValue)}
                    grow
                />
            </Stack>
        </Card>
    )
}

/** A row with the search highlight over it while it is the selected result. */
export function HighlightableRow({
    setting,
    context,
}: {
    setting: SettingKey
    context: SettingContext
}) {
    const highlighted = useSettingSearchStore(
        state => state.selected === setting,
    )
    return (
        <View>
            <SettingRow
                node={SETTING_RENDERER_CONFIG[setting]}
                context={context}
            />
            {highlighted && <SettingHighlight />}
        </View>
    )
}

// RadioSetting: a TableRadioGroup titled with the setting.
export function RadioSetting({
    setting,
    node,
    context,
    helperText,
}: {
    setting: SettingKey
    node: NodeOf<'radio'>
    context: SettingContext
    helperText?: string
}) {
    const { theme } = useUnistyles()
    const highlighted = useSettingSearchStore(
        state => state.selected === setting,
    )
    const disabled = node.disabled?.(context)
    return (
        <View>
            <TableRadioGroup
                title={node.title()}
                helperText={helperText}
                value={node.value(context)}
                onChange={value => node.onValueChange(context, value)}
            >
                {node.options().map(option => (
                    <TableRadioRow
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        subLabel={option.subLabel}
                        disabled={disabled}
                    />
                ))}
            </TableRadioGroup>
            {highlighted && (
                // Below the group's title (TableRowGroupTitle: a text-md line and its margin).
                <SettingHighlight
                    top={
                        theme.text['text-md/medium'].lineHeight +
                        theme.space.PX_8
                    }
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    highlight: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.INTERACTIVE_TEXT_HOVER,
    },
    highlightBelowTitle: (top: number) => ({
        top,
        borderRadius: theme.modules.mobile.TABLE_ROW_BORDER_RADIUS,
    }),
    // SettingRenderer's slider style.
    slider: { marginTop: theme.space.PX_16, marginBottom: theme.space.PX_8 },
}))
