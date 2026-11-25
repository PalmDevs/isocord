import { useNavigation } from '@react-navigation/native'
import { Children, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { TableRowGroupTitle } from '../../../design/components/table/TableRowGroup'
import {
    gradientBackground,
    gradientPresets,
    themes,
} from '../../../design/tokens'
import { t } from '../../../i18n'
import { BASE_THEMES, themeName } from './themeNames'
import type { ReactNode } from 'react'
import type {
    CustomThemes,
    SystemTheme,
    ThemeChoice,
} from '../../../design/tokens'
import type { CustomThemeParams } from './CustomThemeScreen'

/** ThemeIconSizes.SIZE_48. */
const SWATCH_SIZE = 48
const RING_WIDTH = 2
/** Wide enough for a two-line theme name under the swatch. */
const CELL_WIDTH = 64
const NAME_LINES = 2

function Swatch({
    name,
    selected,
    onPress,
    background,
}: {
    name: string | undefined
    selected: boolean
    onPress: () => void
    background: { backgroundColor: string } | { backgroundImage: string }
}) {
    return (
        <RipplePressable
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ selected }}
            onPress={onPress}
            style={styles.cell}
        >
            <View style={[styles.ring, selected && styles.selectedRing]}>
                <View style={[styles.swatch, background]} />
            </View>
            <Text
                variant="text-xs/medium"
                color={selected ? 'TEXT_DEFAULT' : 'TEXT_MUTED'}
                numberOfLines={NAME_LINES}
                style={styles.name}
            >
                {name}
            </Text>
        </RipplePressable>
    )
}

/** A titled grid of swatches, spread over each row. */
function SwatchGrid({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) {
    const { theme } = useUnistyles()
    const [width, setWidth] = useState(0)
    const columns = Math.max(
        1,
        Math.floor(
            (width + theme.space.PX_8) / (CELL_WIDTH + theme.space.PX_8),
        ),
    )
    // Empty cells after the last swatch, so the last row lines up with the others.
    const fillers = (columns - (Children.count(children) % columns)) % columns
    return (
        <View>
            <TableRowGroupTitle title={title} />
            <View
                style={styles.grid}
                accessibilityRole="radiogroup"
                onLayout={event => setWidth(event.nativeEvent.layout.width)}
            >
                {children}
                {Array.from({ length: fillers }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: empty cells, all alike
                    <View key={i} style={styles.filler} />
                ))}
            </View>
        </View>
    )
}

/**
 * SettingsAppearanceThemeCarousel's themes as wrapping grids of named round swatches: the base themes and the
 * gradient presets, then the saved custom themes and Add. A custom swatch opens the builder instead of applying.
 * Departure: grids, not a carousel, names, and any number of custom themes.
 */
export function ThemeSwatches({
    title,
    value,
    customs,
    mode,
    onChange,
}: {
    title: string
    value: ThemeChoice
    customs: CustomThemes
    /** The device mode these swatches pick for, passed on to the builder. */
    mode?: SystemTheme
    onChange: (choice: ThemeChoice) => void
}) {
    const navigation = useNavigation()
    const openBuilder = (id?: string) =>
        navigation.navigate('settingsAppearanceCustomTheme', {
            mode,
            id,
        } satisfies CustomThemeParams)
    return (
        <View style={styles.sections}>
            <SwatchGrid title={title}>
                {BASE_THEMES.map(({ id }) => (
                    <Swatch
                        key={id}
                        name={themeName(id, customs)}
                        selected={value === id}
                        onPress={() => onChange(id)}
                        background={{
                            backgroundColor:
                                themes[id].colors.BACKGROUND_BASE_LOWER,
                        }}
                    />
                ))}
                {gradientPresets.map(preset => (
                    <Swatch
                        key={preset.id}
                        name={themeName(preset.id, customs)}
                        selected={value === preset.id}
                        onPress={() => onChange(preset.id)}
                        background={{
                            backgroundImage: gradientBackground(preset),
                        }}
                    />
                ))}
            </SwatchGrid>
            <SwatchGrid title={t('settings.theme.custom.section')}>
                {Object.entries(customs).map(([id, custom]) => (
                    <Swatch
                        key={id}
                        name={themeName(id, customs)}
                        selected={value === id}
                        onPress={() => openBuilder(id)}
                        background={{
                            backgroundImage: gradientBackground(custom),
                        }}
                    />
                ))}
                <IconButton
                    icon="PlusLargeIcon"
                    label={t('settings.theme.custom.add')}
                    variant="secondary"
                    size="lg"
                    onPress={() => openBuilder()}
                    style={styles.add}
                />
            </SwatchGrid>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // SettingsList's gap between sections.
    sections: { gap: theme.space.PX_24 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        // The least room between two swatches: the column count above counts it.
        columnGap: theme.space.PX_8,
        rowGap: theme.space.PX_8,
    },
    cell: {
        width: CELL_WIDTH,
        alignItems: 'center',
        gap: theme.space.PX_4,
        borderRadius: theme.radii.md,
        overflow: 'hidden',
    },
    filler: { width: CELL_WIDTH },
    // Its button lines up with the swatches inside their rings.
    add: {
        width: CELL_WIDTH,
        alignSelf: 'flex-start',
        paddingTop: theme.space.PX_4 + RING_WIDTH,
    },
    ring: {
        // SettingsAppearanceConstants.THEME_ITEM_PADDING: the gap between a swatch and its ring.
        padding: theme.space.PX_4,
        borderRadius: theme.radii.round,
        borderWidth: RING_WIDTH,
        borderColor: 'transparent',
    },
    selectedRing: {
        borderColor: theme.colors.MOBILE_LEGACY_BUTTON_SECONDARY_BORDER_DEFAULT,
    },
    swatch: {
        width: SWATCH_SIZE,
        height: SWATCH_SIZE,
        borderRadius: theme.radii.round,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.BORDER_STRONG,
    },
    name: { textAlign: 'center' },
}))
