import { View } from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import { Text } from '../../../../design/components/Text'
import { TableRowIcon } from '../../../../design/components/table/TableRow'
import { Icon } from '../../../../design/icons/Icon'
import { t } from '../../../../i18n'
import { FILTERS } from '../catalog'
import { CommandPicker } from './CommandPicker'
import { DatePicker } from './DatePicker'
import { ChannelPicker, RolePicker, UserPicker } from './EntityPickers'
import { PickerList } from './PickerList'
import type { ComponentType, RefObject } from 'react'
import type { SemanticColor } from '../../../../design/tokens'
import type { SearchContext } from '../../types'
import type { FilterInput, FilterKind, SearchFilter } from '../catalog'
import type { SearchInput } from '../useSearchInput'
import type { PickerRow } from './PickerList'

export interface PickerProps {
    kind: FilterKind
    context: SearchContext
    /** The text of the search bar, which searches the picker while it is open. */
    query: string
    onPick: (filter: Omit<SearchFilter, 'id'>) => void
    /** Set to what Enter does. */
    submitRef: RefObject<(() => void) | null>
}

/**
 * The picker of the filter being chosen, over the tabs (which stay mounted under it). It ends at the filter bar,
 * which rides on the keyboard.
 */
export function FilterPicker({
    context,
    search,
    background,
}: {
    context: SearchContext
    search: SearchInput
    /** The screen's own background. */
    background: SemanticColor
}) {
    const insets = useSafeAreaInsets()
    const keyboard = useReanimatedKeyboardAnimation()
    // The filter bar's slot keeps the navigation bar's inset, which the keyboard covers.
    const lift = useAnimatedStyle(() => ({
        bottom: Math.max(0, -keyboard.height.get() - insets.bottom),
    }))
    const kind = search.picking
    if (kind === null) return null
    const Picker = PICKERS[FILTERS[kind].input]
    if (!Picker) return null
    return (
        <Animated.View style={[styles.overlay(background), lift]}>
            <View style={styles.header}>
                <Icon name={FILTERS[kind].icon} size="sm" color="TEXT_MUTED" />
                <Text
                    variant="text-sm/medium"
                    color="TEXT_MUTED"
                    style={styles.hint}
                >
                    {t(`search.filter.${kind}.hint`)}
                </Text>
            </View>
            <Picker
                key={kind}
                kind={kind}
                context={context}
                query={search.text.trim()}
                onPick={search.add}
                submitRef={search.pickerSubmit}
            />
        </Animated.View>
    )
}

/** An option list (has, authorType, embedType, sort). A negatable one has an Exclude button on each row. */
function OptionPicker({ kind, query, onPick, submitRef }: PickerProps) {
    const spec = FILTERS[kind]
    const needle = query.toLowerCase()
    const rows = (spec.options ?? [])
        .map(option => ({ ...option, text: t(option.label) }))
        .filter(option => option.text.toLowerCase().includes(needle))
        .map(
            (option): PickerRow => ({
                key: option.value,
                label: option.text,
                onPress: () =>
                    onPick({ kind, value: option.value, label: option.text }),
                trailing: spec.negatable ? (
                    <RipplePressable
                        accessibilityRole="button"
                        accessibilityLabel={`${t('search.filter.exclude')}, ${option.text}`}
                        onPress={() =>
                            onPick({
                                kind,
                                value: option.value,
                                label: option.text,
                                negated: true,
                            })
                        }
                        style={styles.exclude}
                    >
                        <Text
                            variant="text-sm/medium"
                            color="CONTROL_SECONDARY_TEXT_DEFAULT"
                        >
                            {t('search.filter.exclude')}
                        </Text>
                    </RipplePressable>
                ) : undefined,
            }),
        )
    return <PickerList rows={rows} submitRef={submitRef} />
}

/** A typed value (a message ID, a hostname, a file name). One row adds the text once the filter accepts it. */
function TextPicker({ kind, query, onPick, submitRef }: PickerProps) {
    const accepts = FILTERS[kind].accepts ?? (() => true)
    const valid = query !== '' && accepts(query)
    const rows: PickerRow[] =
        query === ''
            ? []
            : [
                  {
                      key: 'value',
                      label: query,
                      subLabel: valid
                          ? t('search.filter.add')
                          : t('search.filter.invalid'),
                      icon: <TableRowIcon name={FILTERS[kind].icon} />,
                      disabled: !valid,
                      onPress: () =>
                          onPick({ kind, value: query, label: query }),
                  },
              ]
    return <PickerList rows={rows} submitRef={submitRef} />
}

const PICKERS: Partial<Record<FilterInput, ComponentType<PickerProps>>> = {
    user: UserPicker,
    channel: ChannelPicker,
    role: RolePicker,
    options: OptionPicker,
    text: TextPicker,
    date: DatePicker,
    command: CommandPicker,
}

const styles = StyleSheet.create(theme => ({
    overlay: (background: SemanticColor) => ({
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors[background],
    }),
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_16,
        paddingVertical: theme.space.PX_12,
    },
    hint: { flex: 1 },
    exclude: {
        paddingHorizontal: theme.space.PX_12,
        paddingVertical: theme.space.PX_6,
        borderRadius: theme.radii.round,
        borderWidth: 1,
        borderColor: theme.colors.CONTROL_SECONDARY_BORDER_DEFAULT,
        backgroundColor: theme.colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
    },
}))
