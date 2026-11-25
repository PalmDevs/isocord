import { useNavigation, useRoute } from '@react-navigation/native'
import { Fragment, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { hslColor } from '../../../design/colors'
import { Button } from '../../../design/components/buttons/Button'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { SegmentedControl } from '../../../design/components/inputs/SegmentedControl'
import { useSegmentedControlState } from '../../../design/components/inputs/useSegmentedControlState'
import { Stack } from '../../../design/components/layout/Stack'
import { TableRowGroupTitle } from '../../../design/components/table/TableRowGroup'
import { Icon } from '../../../design/icons/Icon'
import {
    applyCustomTheme,
    deleteCustomTheme,
    NEW_CUSTOM_THEME,
    newCustomThemeId,
    setPreviewTheme,
    themeStore,
} from '../../../design/tokens'
import { t } from '../../../i18n'
import { SettingsScaffold } from '../SettingsList'
import { ColorStopEditor } from './ColorStopEditor'
import { LabeledSlider } from './LabeledSlider'
import { ThemePreview } from './ThemePreview'
import type { CustomTheme, SystemTheme } from '../../../design/tokens'

/** Our own limits: the reference has no builder on mobile. */
// shortcut: five colours is plenty for a gradient and keeps the list short.
const MIN_COLORS = 1
const MAX_COLORS = 5
const MAX_ANGLE = 360
const MAX_BASE_MIX = 100
const MAX_DIM = 100
const NEW_COLOR_HUE = 220
const NEW_COLOR_SATURATION = 1
const NEW_COLOR_LIGHTNESS = 0.5
const BASES: CustomTheme['base'][] = ['light', 'darker']

/** The builder's params. */
export interface CustomThemeParams {
    /** The device mode its theme is applied to, none for the app's theme. */
    mode?: SystemTheme
    /** The saved custom theme being edited, none for a new one. */
    id?: string
}

/** Returns the saved custom theme, or a new one, as a draft, with the preview slot rebuilt from it. */
function startDraft(id: string | undefined): CustomTheme {
    const custom = (id && themeStore.getState().customs[id]) || NEW_CUSTOM_THEME
    // The slot may still hold a draft left without applying.
    setPreviewTheme(custom)
    return custom
}

/** Apply, with Delete before it for a saved theme. */
function BuilderFooter({
    id,
    onApply,
}: {
    id: string | undefined
    onApply: () => void
}) {
    const { theme } = useUnistyles()
    const navigation = useNavigation()
    return (
        <Stack direction="horizontal" spacing={theme.space.PX_8}>
            {id !== undefined && (
                <IconButton
                    icon="TrashIcon"
                    variant="destructive"
                    size="lg"
                    accessibilityLabel={t('settings.theme.custom.delete')}
                    onPress={() => {
                        deleteCustomTheme(id)
                        navigation.goBack()
                    }}
                />
            )}
            <Button
                size="lg"
                text={t('settings.theme.custom.apply')}
                onPress={onApply}
                grow
                style={styles.apply}
            />
        </Stack>
    )
}

/** The custom theme builder. Edits stay in a draft, shown in the preview, until Apply. */
export function SettingsAppearanceCustomThemeScreen() {
    const { theme } = useUnistyles()
    const navigation = useNavigation()
    const { mode, id } = (useRoute().params ?? {}) as CustomThemeParams
    const [draft, setDraft] = useState(() => startDraft(id))
    const preview = (patch: Partial<CustomTheme>) =>
        setDraft(current => ({ ...current, ...patch }))
    const commit = (patch: Partial<CustomTheme>) => {
        const next = { ...draft, ...patch }
        setDraft(next)
        setPreviewTheme(next)
    }
    const withColor = (index: number, color: string) =>
        draft.colors.map((existing, i) => (i === index ? color : existing))
    const base = useSegmentedControlState({
        items: [
            {
                id: 'light',
                label: t('settings.theme.light'),
                icon: <Icon name="ThemeLightIcon" size="sm" />,
            },
            {
                id: 'darker',
                label: t('settings.theme.dark'),
                icon: <Icon name="ThemeDarkIcon" size="sm" />,
            },
        ],
        defaultIndex: BASES.indexOf(draft.base),
        onSetActiveIndex: index => commit({ base: BASES[index] }),
    })
    return (
        <SettingsScaffold
            title={t('settings.theme.custom')}
            pinned={<ThemePreview draft={draft} />}
            footer={
                <BuilderFooter
                    id={id}
                    onApply={() => {
                        applyCustomTheme(id ?? newCustomThemeId(), draft, mode)
                        navigation.goBack()
                    }}
                />
            }
        >
            <Stack spacing={theme.space.PX_16}>
                <TableRowGroupTitle title={t('settings.theme.custom.colors')} />
                {draft.colors.map((color, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stops have no id; ColorStopEditor reseeds when its colour changes
                    <Fragment key={index}>
                        {index > 0 && <View style={styles.divider} />}
                        <ColorStopEditor
                            index={index}
                            color={color}
                            removable={draft.colors.length > MIN_COLORS}
                            onChange={next =>
                                preview({ colors: withColor(index, next) })
                            }
                            onCommit={next =>
                                commit({ colors: withColor(index, next) })
                            }
                            onRemove={() =>
                                commit({
                                    colors: draft.colors.filter(
                                        (_, i) => i !== index,
                                    ),
                                })
                            }
                        />
                    </Fragment>
                ))}
                <Button
                    icon="PlusSmallIcon"
                    text={t('settings.theme.custom.addColor')}
                    disabled={draft.colors.length >= MAX_COLORS}
                    onPress={() =>
                        commit({
                            colors: [
                                ...draft.colors,
                                hslColor(
                                    NEW_COLOR_HUE,
                                    NEW_COLOR_SATURATION,
                                    NEW_COLOR_LIGHTNESS,
                                ),
                            ],
                        })
                    }
                    grow
                />
            </Stack>
            <LabeledSlider
                label={t('settings.theme.custom.angle')}
                valueLabel={`${Math.round(draft.angle)}°`}
                value={draft.angle}
                maximumValue={MAX_ANGLE}
                onChange={angle => preview({ angle })}
                onCommit={angle => commit({ angle })}
            />
            <LabeledSlider
                label={t('settings.theme.custom.baseMix')}
                valueLabel={`${Math.round(draft.baseMix)}%`}
                value={draft.baseMix}
                maximumValue={MAX_BASE_MIX}
                onChange={baseMix => preview({ baseMix })}
                onCommit={baseMix => commit({ baseMix })}
            />
            <LabeledSlider
                label={t('settings.theme.custom.dim')}
                valueLabel={`${Math.round(draft.dim)}%`}
                value={draft.dim}
                maximumValue={MAX_DIM}
                onChange={dim => preview({ dim })}
                onCommit={dim => commit({ dim })}
            />
            <SegmentedControl state={base} />
        </SettingsScaffold>
    )
}

const styles = StyleSheet.create(theme => ({
    divider: { height: 1, backgroundColor: theme.colors.BORDER_SUBTLE },
    apply: { flex: 1 },
}))
