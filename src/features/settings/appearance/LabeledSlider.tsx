import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Slider } from '../../../design/components/inputs/Slider'
import { Stack } from '../../../design/components/layout/Stack'
import { Text } from '../../../design/components/Text'

/** A slider under its label and value, like SliderSetting's title row. Reports each drag frame and the release. */
export function LabeledSlider({
    label,
    valueLabel,
    value,
    maximumValue,
    onChange,
    onCommit,
}: {
    label: string
    valueLabel: string
    value: number
    /** Defaults to the Slider's 1. */
    maximumValue?: number
    onChange: (value: number) => void
    onCommit: (value: number) => void
}) {
    return (
        <View>
            <Stack
                direction="horizontal"
                justify="space-between"
                style={styles.header}
            >
                <Text variant="text-md/semibold">{label}</Text>
                <Text variant="text-sm/medium" color="TEXT_MUTED">
                    {valueLabel}
                </Text>
            </Stack>
            <Slider
                value={value}
                maximumValue={maximumValue}
                onValueChange={onChange}
                onSlidingComplete={onCommit}
            />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // Tucked into the slider's touch area, which is taller than its track.
    header: { marginBottom: -theme.space.PX_8 },
}))
