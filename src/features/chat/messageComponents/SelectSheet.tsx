import { Image } from 'expo-image'
import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ComponentType } from '../../../core/discord/components'
import { useSession } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import { FormCheckbox, FormRadio } from '../../../design/components/Forms'
import { TagListInput } from '../../../design/components/inputs/TagListInput'
import {
    ActionSheet,
    ActionSheetRow,
    ActionSheetRowGroup,
    BottomSheetTitleHeader,
} from '../../../design/components/sheets/Sheet'
import {
    hideActionSheet,
    openActionSheet,
} from '../../../design/components/sheets/sheetStore'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { componentInteractionsStore } from './interactionStore'
import { executeComponentInteraction } from './interactions'
import { initialSelection, selectLimits, stringOptions } from './selectOptions'
import { querySelectOptions, sessionLookup } from './selectQueries'
import type { Session } from '../../../core/session'
import type { RichMessage } from '../rows/rich'
import type { ApiComponent } from './apiComponent'
import type { SelectOption } from './selectOptions'

/** StringSelectComponentActionSheet's fastImageEmoji: an option's emoji or avatar. */
const OPTION_ICON_SIZE = 24

interface SelectSheetProps {
    message: RichMessage
    componentId: string
    component: ApiComponent
}

/** handleTapSelectActionComponent: the select's sheet, keyed by its message as in the reference. */
export function openSelectSheet(props: SelectSheetProps): void {
    openActionSheet(
        `select-component-${props.message.id}`,
        <SelectSheet {...props} />,
    )
}

/**
 * The picks of a select sheet (StringSelectComponentActionSheet and useSearchableSelectComponent). One pick sends
 * at once. With max_values over 1, picks toggle up to the limit and Select sends them.
 */
function useSelection(
    session: Session,
    { message, componentId, component }: SelectSheetProps,
) {
    const [selected, setSelected] = useState(() =>
        initialSelection(
            component,
            session.get(componentInteractionsStore).getState().selections[
                message.id
            ]?.[componentId],
            sessionLookup(session, message.channel_id),
        ),
    )
    const { min, max, multi } = selectLimits(component)
    // canSelectBeEmpty in a message: only when min_values is 0.
    const allowEmpty = min === 0
    const submit = (picked: SelectOption[]) => {
        hideActionSheet(`select-component-${message.id}`)
        if (component.custom_id)
            void executeComponentInteraction(session, {
                message,
                componentId,
                componentType: component.type,
                customId: component.custom_id,
                picked,
            })
    }
    const isSelected = (option: SelectOption) =>
        selected.some(pick => pick.value === option.value)
    const toggle = (option: SelectOption) => {
        const picked = isSelected(option)
        if (!multi) submit(picked ? [] : [option])
        else if (picked)
            setSelected(selected.filter(pick => pick.value !== option.value))
        else if (selected.length < max) setSelected([...selected, option])
    }
    // SelectComponentActionSheet's row and button rules.
    const disabledOption = (option: SelectOption) =>
        multi
            ? selected.length >= max && !isSelected(option)
            : isSelected(option) && !allowEmpty
    const submitDisabled =
        selected.length === 0
            ? !allowEmpty
            : selected.length < min || selected.length > max
    return {
        selected,
        setSelected,
        min,
        multi,
        isSelected,
        toggle,
        disabledOption,
        submitDisabled,
        submit: () => submit(selected),
    }
}

function OptionIcon({ option }: { option: SelectOption }) {
    if (option.emojiUrl)
        return (
            <Image
                source={option.emojiUrl}
                style={[styles.icon, option.round && styles.round]}
            />
        )
    return option.emoji ? (
        <Text variant="text-md/normal">{option.emoji}</Text>
    ) : null
}

function SelectSheet(props: SelectSheetProps) {
    const session = useSession()
    const { message, component } = props
    const selection = useSelection(session, props)
    const [query, setQuery] = useState('')
    const searchable = component.type !== ComponentType.STRING_SELECT
    const options = searchable
        ? querySelectOptions(session, message.channel_id, component, query)
        : stringOptions(component)
    const withIcons = options.some(option => option.emoji || option.emojiUrl)
    return (
        <ActionSheet
            scrollable
            keyboardShouldPersistTaps="always"
            header={
                <SelectSheetHeader
                    component={component}
                    selection={selection}
                    searchable={searchable}
                    onQueryChange={setQuery}
                />
            }
        >
            <ActionSheetRowGroup
                accessibilityRole={selection.multi ? undefined : 'radiogroup'}
            >
                {options.map(option => (
                    <ActionSheetRow
                        key={`${option.kind}${option.value}`}
                        label={option.label}
                        subLabel={option.description}
                        icon={
                            withIcons ? (
                                <OptionIcon option={option} />
                            ) : undefined
                        }
                        disabled={selection.disabledOption(option)}
                        onPress={() => selection.toggle(option)}
                        trailing={
                            selection.multi ? (
                                <FormCheckbox
                                    checked={selection.isSelected(option)}
                                />
                            ) : (
                                <FormRadio
                                    selected={selection.isSelected(option)}
                                />
                            )
                        }
                    />
                ))}
            </ActionSheetRowGroup>
        </ActionSheet>
    )
}

/**
 * SelectionHeader: the select's placeholder, "Select at least" for multiple picks with a minimum, and Select. The
 * searchable selects add a search field holding the picks as tags.
 */
function SelectSheetHeader({
    component,
    selection,
    searchable,
    onQueryChange,
}: {
    component: ApiComponent
    selection: ReturnType<typeof useSelection>
    searchable: boolean
    onQueryChange: (query: string) => void
}) {
    const { selected, multi, min } = selection
    return (
        <View style={styles.header}>
            <BottomSheetTitleHeader
                title={
                    component.placeholder ??
                    t('chat.components.selectPlaceholder')
                }
                subtitle={
                    multi && min > 0
                        ? t('chat.components.selectAtLeast', { count: min })
                        : undefined
                }
                trailing={
                    multi ? (
                        <Button
                            size="sm"
                            variant={
                                selection.submitDisabled
                                    ? 'secondary'
                                    : 'primary'
                            }
                            disabled={selection.submitDisabled}
                            onPress={selection.submit}
                            text={t('chat.components.select')}
                        />
                    ) : undefined
                }
            />
            {searchable && (
                <TagListInput
                    tags={selected.map(pick => ({
                        id: `${pick.kind}${pick.value}`,
                        text: pick.label,
                        icon: <OptionIcon option={pick} />,
                    }))}
                    onRemove={index =>
                        selection.setSelected(
                            selected.filter((_, at) => at !== index),
                        )
                    }
                    onChangeText={onQueryChange}
                    icon="MagnifyingGlassIcon"
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    header: { gap: theme.space.PX_12 },
    icon: {
        width: OPTION_ICON_SIZE,
        height: OPTION_ICON_SIZE,
        borderRadius: theme.radii.xs,
    },
    round: { borderRadius: theme.radii.round },
}))
