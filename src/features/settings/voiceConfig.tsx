import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useStore } from 'zustand'
import { showSimpleActionSheet } from '../../design/components/sheets/showSimpleActionSheet'
import { t } from '../../i18n'
import { showAudioInputSheet } from '../voice/devices/AudioInputSheet'
import { showAudioOutputSheet } from '../voice/devices/AudioOutputSheet'
import { deviceLabel } from '../voice/devices/audioDevices'
import { setMobileOverlay } from '../voice/overlay/overlayLifecycle'
import { cameraSetting } from '../voice/settings/CameraSetting'
import { VoiceSensitivity } from '../voice/settings/VoiceSensitivity'
import {
    setVoiceSetting,
    voiceConstants,
    voiceSettingsStore,
} from '../voice/settings/voiceSettings'
import type { InputMode } from '../../native/voiceTypes'
import type { VoiceSettings } from '../voice/settings/voiceSettings'
import type { SettingContext, SettingNode } from './config'

export type VoiceSettingKey =
    | 'VOICE'
    | 'INPUT_MODE'
    | 'AUTO_VOICE_SENSITIVITY'
    | 'VOICE_SENSITIVITY'
    | 'INPUT_VOLUME'
    | 'OUTPUT_VOLUME'
    | 'SOUNDBOARD_VOLUME'
    | 'NOISE_SUPPRESSION'
    | 'ECHO_CANCELLATION'
    | 'AUTOMATIC_GAIN_CONTROL'
    | 'DISABLE_STREAM_PREVIEWS'
    | 'ANDROID_CALL_INTEGRATION'
    | 'ANDROID_MOBILE_OVERLAY'
    | 'AUDIO_INPUT'
    | 'AUDIO_OUTPUT'
    | 'CAMERA'

const inputModeLabel = ({ voice }: SettingContext) =>
    voice.inputMode === 'pushToTalk'
        ? t('voice.pushToTalk')
        : t('voice.settings.voiceActivity')

const microphoneTerms = () => [t('voice.settings.microphone')]

const voiceActivity = ({ voice }: SettingContext) =>
    voice.inputMode === 'voiceActivity'

const setMode = (mode: InputMode['mode']) => setVoiceSetting('inputMode', mode)

/** A device-wide toggle of the voice settings. */
const voiceToggle = (
    key: 'echoCancellation' | 'autoGainControl' | 'disableStreamPreviews',
    title: () => string,
    description?: () => string,
): SettingNode => ({
    type: 'toggle',
    parent: 'VOICE',
    title,
    description,
    value: ({ voice }) => voice[key],
    onValueChange: (_context, value) => setVoiceSetting(key, value),
})

/** A volume slider of the voice settings. `max` is its perceptual end. */
const voiceVolume = (
    key: 'inputVolume' | 'outputVolume' | 'soundboardVolume',
    max: () => number,
    searchTerms?: () => string[],
): SettingNode => ({
    type: 'volume',
    parent: 'VOICE',
    title: () => t('voice.settings.volume'),
    searchTerms,
    maximum: max,
    unity: () => voiceConstants().defaultVolume,
    value: ({ voice }) => voice[key],
    onValueChange: (_context, value) => setVoiceSetting(key, value),
})

// VoiceSensitivitySetting's useVoiceSensitivitySettingDescription.
function useVoiceSensitivityDescription() {
    const auto = useStore(voiceSettingsStore, state => state.autoThreshold)
    const threshold = useStore(voiceSettingsStore, state => state.threshold)
    return (
        <View style={styles.sensitivity}>
            <VoiceSensitivity
                auto={auto}
                threshold={threshold}
                onThresholdChange={value => setVoiceSetting('threshold', value)}
            />
        </View>
    )
}

/** The Voice screen's settings (SettingsVoiceScreen), device-wide as MediaEngineStore keeps them. */
export const VOICE_SETTINGS: Record<VoiceSettingKey, SettingNode> = {
    // VoiceSetting
    VOICE: {
        type: 'route',
        title: () => t('voice.settings.title'),
        icon: 'MicrophoneIcon',
        screen: 'settingsVoice',
        trailing: inputModeLabel,
        searchTerms: microphoneTerms,
    },
    // Isocord's own: the reference's mobile client has no input picker. Shows the remembered mic.
    AUDIO_INPUT: {
        type: 'pressable',
        parent: 'VOICE',
        title: () => t('voice.settings.microphone'),
        trailing: ({ voice }) =>
            voice.inputDevice
                ? t('voice.devices.preferred', {
                      device: deviceLabel(voice.inputDevice),
                  })
                : t('voice.devices.default'),
        onPress: showAudioInputSheet,
    },
    // VoicePanelVoiceControls' AudioRouteButton, which the reference lists in the panel's settings drawer. Ours
    // has no drawer: the gear opens this screen.
    AUDIO_OUTPUT: {
        type: 'pressable',
        parent: 'VOICE',
        title: () => t('voice.output.change'),
        searchTerms: () => [
            t('voice.settings.speakers'),
            t('voice.settings.headphones'),
        ],
        trailing: ({ voice }) =>
            voice.outputDevice
                ? t('voice.devices.preferred', {
                      device: deviceLabel(voice.outputDevice),
                  })
                : undefined,
        onPress: showAudioOutputSheet,
    },
    CAMERA: cameraSetting,
    // InputModeSetting: handleInputModePress opens an action sheet.
    INPUT_MODE: {
        type: 'pressable',
        parent: 'VOICE',
        title: () => t('voice.settings.inputMode'),
        trailing: inputModeLabel,
        searchTerms: microphoneTerms,
        onPress: () =>
            showSimpleActionSheet({
                key: 'InputMode',
                header: { title: t('voice.settings.inputMode') },
                options: [
                    {
                        label: t('voice.pushToTalk'),
                        onPress: () => setMode('pushToTalk'),
                    },
                    {
                        label: t('voice.settings.voiceActivity'),
                        onPress: () => setMode('voiceActivity'),
                    },
                ],
            }),
    },
    // AutoVoiceSensitivitySetting. Hidden in push to talk, as UserSettingsVoiceInputOptions does.
    AUTO_VOICE_SENSITIVITY: {
        type: 'toggle',
        parent: 'VOICE',
        title: () => t('voice.settings.autoSensitivity'),
        searchTerms: microphoneTerms,
        predicate: voiceActivity,
        value: ({ voice }) => voice.autoThreshold,
        onValueChange: (_context, value) =>
            setVoiceSetting('autoThreshold', value),
    },
    // VoiceSensitivitySetting
    VOICE_SENSITIVITY: {
        type: 'static',
        parent: 'VOICE',
        title: () => t('voice.settings.inputSensitivity'),
        searchTerms: microphoneTerms,
        predicate: voiceActivity,
        useDescription: useVoiceSensitivityDescription,
    },
    // Isocord's own: the reference's mobile settings have no input volume. Its desktop ones do (`inputVolume`).
    INPUT_VOLUME: voiceVolume(
        'inputVolume',
        () => voiceConstants().maxVolume,
        microphoneTerms,
    ),
    // OutputVolumeSetting: `maximum: 200`, the native maximum.
    OUTPUT_VOLUME: voiceVolume(
        'outputVolume',
        () => voiceConstants().maxVolume,
        () => [t('voice.settings.speakers'), t('voice.settings.headphones')],
    ),
    // SoundboardVolumeSetting: `maximum: 100`, unity. Stored only until a soundboard exists.
    SOUNDBOARD_VOLUME: {
        ...voiceVolume(
            'soundboardVolume',
            () => voiceConstants().defaultVolume,
        ),
        title: () => t('voice.settings.soundboardVolume'),
    },
    // NoiseSuppressionKrispSetting. Enhanced is RNNoise, not Krisp, so it takes Discord's "Advanced".
    NOISE_SUPPRESSION: {
        type: 'radio',
        parent: 'VOICE',
        title: () => t('voice.settings.noiseSuppression'),
        searchTerms: () => [t('voice.settings.krisp')],
        options: () => [
            {
                value: 'enhanced',
                label: t('voice.settings.noiseSuppressionEnhanced'),
            },
            {
                value: 'standard',
                label: t('voice.settings.noiseSuppressionStandard'),
            },
            { value: 'off', label: t('voice.settings.noiseSuppressionOff') },
        ],
        value: ({ voice }) => voice.noiseSuppression,
        onValueChange: (_context, value) =>
            setVoiceSetting(
                'noiseSuppression',
                value as VoiceSettings['noiseSuppression'],
            ),
    },
    // EchoCancellationSetting
    ECHO_CANCELLATION: voiceToggle('echoCancellation', () =>
        t('voice.settings.echoCancellation'),
    ),
    // AutomaticGainControlSetting
    AUTOMATIC_GAIN_CONTROL: voiceToggle(
        'autoGainControl',
        () => t('voice.settings.automaticGainControl'),
        () => t('voice.settings.automaticGainControl.description'),
    ),
    // DisableStreamPreviewsSetting. The reference syncs it to the account. Isocord keeps it on the device.
    DISABLE_STREAM_PREVIEWS: voiceToggle(
        'disableStreamPreviews',
        () => t('voice.settings.hideStreamPreviews'),
        () => t('voice.settings.hideStreamPreviews.description'),
    ),
    // AndroidMobileOverlaySetting: turning it on asks to draw over other apps, a refusal turns it back off.
    ANDROID_MOBILE_OVERLAY: {
        type: 'toggle',
        parent: 'VOICE',
        title: () => t('voice.settings.mobileOverlay'),
        description: () => t('voice.settings.mobileOverlay.description'),
        value: ({ voice }) => voice.mobileOverlay,
        onValueChange: (_context, value) => setMobileOverlay(value),
    },
    // Isocord's own, with its own copy: Discord has no such setting. Off runs calls outside Android Telecom.
    ANDROID_CALL_INTEGRATION: {
        type: 'toggle',
        parent: 'VOICE',
        title: () => t('voice.settings.callIntegration'),
        description: () => t('voice.settings.callIntegration.description'),
        value: ({ voice }) => voice.telecom,
        onValueChange: (_context, value) => setVoiceSetting('telecom', value),
    },
}

const styles = StyleSheet.create(theme => ({
    // VoiceSensitivitySetting's `slider` style.
    sensitivity: { marginTop: theme.space.PX_8 },
}))
