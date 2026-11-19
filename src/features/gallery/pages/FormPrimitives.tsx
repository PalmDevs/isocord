import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import {
    FormCheckbox,
    FormRadio,
    FormSwitch,
} from '../../../design/components/Forms'
import { Checkbox } from '../../../design/components/inputs/Checkbox'
import { Slider } from '../../../design/components/inputs/Slider'
import { Icon } from '../../../design/icons/Icon'
import { PageSection } from '../GalleryPage'

export function FormPrimitivesPage() {
    const [on, setOn] = useState(true)
    const [checked, setChecked] = useState(true)
    const [required, setRequired] = useState(false)
    const [volume, setVolume] = useState(0.4)
    const [steps, setSteps] = useState(3)
    return (
        <>
            <PageSection title="FormSwitch (off, on, disabled off, disabled on)">
                <View style={styles.row}>
                    <FormSwitch
                        value={on}
                        onValueChange={setOn}
                        accessibilityLabel="Demo switch"
                    />
                    <FormSwitch
                        value={!on}
                        onValueChange={() => setOn(v => !v)}
                    />
                    <FormSwitch value={false} disabled />
                    <FormSwitch value disabled />
                </View>
            </PageSection>
            <PageSection title="FormCheckbox and FormRadio (unchecked, checked)">
                <View style={styles.row}>
                    <FormCheckbox checked={false} />
                    <FormCheckbox checked />
                    <FormRadio selected={false} />
                    <FormRadio selected />
                </View>
            </PageSection>
            <PageSection title="Checkbox">
                <Checkbox
                    checked={checked}
                    onToggle={setChecked}
                    label="Remember this device"
                />
                <Checkbox
                    checked={required}
                    onToggle={setRequired}
                    label="I accept the terms"
                    description="You must accept to continue."
                    required
                />
            </PageSection>
            <PageSection title="Slider (continuous, stepped with icons, disabled)">
                <Slider value={volume} onValueChange={setVolume} />
                <Slider
                    value={steps}
                    minimumValue={0}
                    maximumValue={5}
                    step={1}
                    onValueChange={setSteps}
                    startIcon={<Icon name="MicrophoneSlashIcon" size="sm" />}
                    endIcon={<Icon name="MicrophoneIcon" size="sm" />}
                />
                <Slider value={0.7} disabled />
            </PageSection>
        </>
    )
}

const styles = StyleSheet.create(theme => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.PX_16 },
}))
