import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { colorHsl, hslColor } from '../../../design/colors'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { Stack } from '../../../design/components/layout/Stack'
import { t } from '../../../i18n'
import { LabeledSlider } from './LabeledSlider'

const MAX_HUE = 360
const PERCENT = 100
const FULL_SATURATION = 1

/**
 * Returns a stop's HSL. Black and white read as saturation 0, which would leave only greys.
 * They get full saturation instead: still black or white, so the reseed check stays settled.
 */
function stopHsl(color: string): [number, number, number] {
    const [hue, saturation, lightness] = colorHsl(color)
    const blackOrWhite = lightness === 0 || lightness === 1
    return [hue, blackOrWhite ? FULL_SATURATION : saturation, lightness]
}

/** A colour stop: its swatch with a hue and a lightness slider, and a remove button. Isocord's own, the mobile client has no builder. */
export function ColorStopEditor({
    index,
    color,
    removable,
    onChange,
    onCommit,
    onRemove,
}: {
    index: number
    color: string
    removable: boolean
    /** Fires on every drag frame. */
    onChange: (color: string) => void
    /** Fires when the finger lifts. */
    onCommit: (color: string) => void
    onRemove: () => void
}) {
    const { theme } = useUnistyles()
    // Kept as HSL, since hex loses the hue of black and white and rounds the sliders.
    const [[hue, saturation, lightness], setHsl] = useState(() =>
        stopHsl(color),
    )
    // The stop now shows another colour, such as after a removal above it.
    if (hslColor(hue, saturation, lightness) !== color) setHsl(stopHsl(color))
    const withHue = (value: number) => {
        setHsl([value, saturation, lightness])
        return hslColor(value, saturation, lightness)
    }
    const withLightness = (value: number) => {
        setHsl([hue, saturation, value])
        return hslColor(hue, saturation, value)
    }
    return (
        <Stack
            direction="horizontal"
            spacing={theme.space.PX_16}
            align="center"
        >
            <View
                accessibilityLabel={t('settings.theme.custom.color', {
                    number: index + 1,
                })}
                style={[styles.swatch, { backgroundColor: color }]}
            />
            <View style={styles.sliders}>
                <LabeledSlider
                    label={t('settings.theme.custom.hue')}
                    valueLabel={`${Math.round(hue)}°`}
                    value={hue}
                    maximumValue={MAX_HUE}
                    onChange={value => onChange(withHue(value))}
                    onCommit={value => onCommit(withHue(value))}
                />
                <LabeledSlider
                    label={t('settings.theme.custom.lightness')}
                    valueLabel={`${Math.round(lightness * PERCENT)}%`}
                    value={lightness}
                    onChange={value => onChange(withLightness(value))}
                    onCommit={value => onCommit(withLightness(value))}
                />
            </View>
            {removable && (
                <IconButton
                    icon="TrashIcon"
                    variant="destructive"
                    accessibilityLabel={t('settings.theme.custom.removeColor')}
                    onPress={onRemove}
                />
            )}
        </Stack>
    )
}

const styles = StyleSheet.create(theme => ({
    swatch: {
        width: theme.space.PX_32,
        height: theme.space.PX_32,
        borderRadius: theme.radii.round,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.BORDER_STRONG,
    },
    sliders: { flex: 1 },
}))
