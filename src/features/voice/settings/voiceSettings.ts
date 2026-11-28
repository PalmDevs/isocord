import { createStore } from 'zustand/vanilla'
import { StreamPreset } from '../../../core/discord/streams'
import { deviceStorage, readJson, writeJson } from '../../../core/storage'
import native from '../../../native/IsocordVoice'
import type {
    AudioDeviceKey,
    CameraDevice,
    InputMode,
} from '../../../native/voiceTypes'

/**
 * MediaEngineStore's settings and ApplicationStreamingSettingsStore, kept on the device like the reference's.
 * Native keeps them only per process, so `registerVoiceSettings` sends them again at every start.
 */
export interface VoiceSettings {
    inputMode: InputMode['mode']
    autoThreshold: boolean
    /** dBFS, from `inputLevelFloor` to 0. */
    threshold: number
    noiseSuppression: InputMode['noiseSuppression']
    echoCancellation: boolean
    autoGainControl: boolean
    /** Amplitudes, `defaultVolume` is unity. */
    inputVolume: number
    outputVolume: number
    /** Stored only: there is no soundboard yet. */
    soundboardVolume: number
    /** UserSettings.DisableStreamPreviews: our stream posts no preview. */
    disableStreamPreviews: boolean
    /** Isocord's own: false runs the next call outside Android Telecom. */
    telecom: boolean
    /** ApplicationStreamingSettingsStore `preset`, a `StreamPreset`. */
    streamPreset: number
    /** ApplicationStreamingSettingsStore `soundshareEnabled`. */
    soundshare: boolean
    /** Isocord's own: the devices picked last, chosen again when present. Null follows the system. */
    inputDevice: AudioDeviceKey | null
    outputDevice: AudioDeviceKey | null
    /** Isocord's own: the camera picked last, used when video starts. Null or absent picks the front camera. */
    camera: CameraDevice | null
    /** MobileVoiceOverlayStore `enabled`: the call bubble over other apps. */
    mobileOverlay: boolean
}

const STORAGE_KEY = 'voiceSettings'

/** Returns Kotlin's voice constants. Isocord only runs on Android, where the module always exists. */
export function voiceConstants() {
    if (!native) throw new Error('IsocordVoice is missing')
    return native.getConstants()
}

/** MediaEngineStore's mobile defaults. */
function defaults(): VoiceSettings {
    const { defaultThreshold, defaultVolume } = voiceConstants()
    return {
        inputMode: 'voiceActivity',
        // `autoThreshold: isPlatformEmbedded || false`: off on mobile.
        autoThreshold: false,
        threshold: defaultThreshold,
        // `noiseCancellation: true`: Krisp, our enhanced tier.
        noiseSuppression: 'enhanced',
        echoCancellation: true,
        autoGainControl: true,
        inputVolume: defaultVolume,
        outputVolume: defaultVolume,
        soundboardVolume: defaultVolume,
        disableStreamPreviews: false,
        telecom: true,
        streamPreset: StreamPreset.MOBILE_DEFAULT,
        soundshare: true,
        inputDevice: null,
        outputDevice: null,
        camera: null,
        mobileOverlay: false,
    }
}

export const voiceSettingsStore = createStore<VoiceSettings>(() => ({
    ...defaults(),
    ...readJson<Partial<VoiceSettings>>(deviceStorage, STORAGE_KEY),
}))

voiceSettingsStore.subscribe(state =>
    writeJson(deviceStorage, STORAGE_KEY, state),
)

export function setVoiceSetting<Key extends keyof VoiceSettings>(
    key: Key,
    value: VoiceSettings[Key],
): void {
    voiceSettingsStore.setState({ [key]: value })
}
