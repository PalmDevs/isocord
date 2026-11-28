import { useEffect, useState } from 'react'
import { t } from '../../../i18n'
import native from '../../../native/IsocordVoice'
import type { IconName } from '../../../design/icons/Icon'
import type { MessageKey } from '../../../i18n'
import type {
    AudioDeviceKey,
    AudioEndpoint,
    AudioInputDevice,
    VoiceEvent,
} from '../../../native/voiceTypes'

type DeviceKind = AudioDeviceKey['kind']

export type AudioDevicesEvent = Extract<VoiceEvent, { type: 'audioDevices' }>

/**
 * CallsUtils' audioDeviceToIconMap, with Mana icons for its native images (`voice_bar_*`). Mana has no Bluetooth
 * glyph. The reference draws wired headsets with the speaker glyph, ours with headphones.
 */
const DEVICE_ICONS: Record<DeviceKind, IconName> = {
    earpiece: 'MobilePhoneIcon',
    microphone: 'MobilePhoneIcon',
    speaker: 'VoiceNormalIcon',
    wired: 'HeadphonesIcon',
    bluetooth: 'HeadphonesIcon',
    streaming: 'VoiceNormalIcon',
    unknown: 'VoiceNormalIcon',
}

/** CallsUtils' getAudioDeviceToDisplayText. Kinds it calls INVALID show the device's own name. */
const DEVICE_LABELS: Partial<Record<DeviceKind, MessageKey>> = {
    earpiece: 'voice.devices.phone',
    microphone: 'voice.devices.phone',
    speaker: 'voice.devices.speaker',
    wired: 'voice.devices.wiredHeadset',
    bluetooth: 'voice.devices.bluetooth',
}

export function deviceIcon(device: { kind: DeviceKind }): IconName {
    return DEVICE_ICONS[device.kind]
}

/** Returns the row label: "Bluetooth LE" for a TYPE_BLE_HEADSET, else by kind. */
export function deviceLabel(device: {
    kind: DeviceKind
    name: string
    lowEnergy?: boolean
}): string {
    if (device.lowEnergy) return t('voice.devices.bluetoothLe')
    const key = DEVICE_LABELS[device.kind]
    return key ? t(key) : device.name
}

/** The reference's `subLabel`: the device's own name, when it has one. */
export function deviceSubLabel(device: { name: string }): string | undefined {
    return device.name.length > 0 ? device.name : undefined
}

/** The identity the voice settings remember a device by. */
export function deviceKey(
    device: AudioEndpoint | AudioInputDevice,
): AudioDeviceKey {
    return { kind: device.kind, name: device.name, address: device.address }
}

/** Returns the phone's audio devices while mounted, null until native reports them. */
export function useAudioDevices(): AudioDevicesEvent | null {
    const [devices, setDevices] = useState<AudioDevicesEvent | null>(null)
    useEffect(() => {
        if (!native) return undefined
        const voice = native
        const unsubscribe = voice.onVoiceEvent(payload => {
            const event = JSON.parse(payload) as VoiceEvent
            if (event.type === 'audioDevices') setDevices(event)
        })
        voice.setAudioDeviceReporting(true)
        return () => {
            unsubscribe()
            voice.setAudioDeviceReporting(false)
        }
    }, [])
    return devices
}
