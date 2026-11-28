import { Slider } from '../../../design/components/inputs/Slider'
import { Icon } from '../../../design/icons/Icon'
import {
    amplitudeToPerceptual,
    perceptualToAmplitude,
} from './perceptualVolume'

/**
 * VolumeSlider: a perceptual slider between a muted and a full speaker. Takes and reports amplitudes.
 * `max` is the slider's perceptual end, `unity` the amplitude at 0 dB.
 */
export function VolumeSlider({
    value,
    max,
    unity,
    onValueChange,
}: {
    value: number
    max: number
    unity: number
    onValueChange: (amplitude: number) => void
}) {
    return (
        <Slider
            value={amplitudeToPerceptual(value, unity)}
            minimumValue={0}
            maximumValue={max}
            onValueChange={perceptual =>
                onValueChange(perceptualToAmplitude(perceptual, unity))
            }
            startIcon={<Icon name="VoiceXIcon" />}
            endIcon={<Icon name="VoiceNormalIcon" />}
        />
    )
}
