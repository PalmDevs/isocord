import * as Device from 'expo-device'
import { Platform } from 'react-native'

/** What the super properties say about the phone: `device`, `device_model_name` and `os_version`. */
export interface DeviceProfile {
    /** Build.DEVICE */
    device: string
    /** Build.MODEL */
    model: string
    /** Build.VERSION.SDK_INT, as a string */
    osVersion: string
}

/**
 * Common phones a new account can claim. `device` and `model` are exact pairs from Google Play's supported
 * devices list (Build.DEVICE and Build.MODEL, international variants). `sdk` spans the Android versions each
 * one shipped with or was updated to, capped at Android 16 (36).
 */
const DEVICES: Array<{ device: string; model: string; sdk: [number, number] }> =
    [
        { device: 'oriole', model: 'Pixel 6', sdk: [31, 36] },
        { device: 'raven', model: 'Pixel 6 Pro', sdk: [31, 36] },
        { device: 'bluejay', model: 'Pixel 6a', sdk: [31, 36] },
        { device: 'panther', model: 'Pixel 7', sdk: [33, 36] },
        { device: 'cheetah', model: 'Pixel 7 Pro', sdk: [33, 36] },
        { device: 'lynx', model: 'Pixel 7a', sdk: [33, 36] },
        { device: 'shiba', model: 'Pixel 8', sdk: [34, 36] },
        { device: 'husky', model: 'Pixel 8 Pro', sdk: [34, 36] },
        { device: 'akita', model: 'Pixel 8a', sdk: [34, 36] },
        { device: 'tokay', model: 'Pixel 9', sdk: [34, 36] },
        { device: 'caiman', model: 'Pixel 9 Pro', sdk: [34, 36] },
        { device: 'komodo', model: 'Pixel 9 Pro XL', sdk: [34, 36] },
        { device: 'tegu', model: 'Pixel 9a', sdk: [35, 36] },
        { device: 'o1s', model: 'SM-G991B', sdk: [30, 35] },
        { device: 't2s', model: 'SM-G996B', sdk: [30, 35] },
        { device: 'p3s', model: 'SM-G998B', sdk: [30, 35] },
        { device: 'r9q', model: 'SM-G990B', sdk: [31, 35] },
        { device: 'r0s', model: 'SM-S901B', sdk: [31, 36] },
        { device: 'g0s', model: 'SM-S906B', sdk: [31, 36] },
        { device: 'b0s', model: 'SM-S908B', sdk: [31, 36] },
        { device: 'dm1q', model: 'SM-S911B', sdk: [33, 36] },
        { device: 'dm2q', model: 'SM-S916B', sdk: [33, 36] },
        { device: 'dm3q', model: 'SM-S918B', sdk: [33, 36] },
        { device: 'e1s', model: 'SM-S921B', sdk: [34, 36] },
        { device: 'e2s', model: 'SM-S926B', sdk: [34, 36] },
        { device: 'e3q', model: 'SM-S928B', sdk: [34, 36] },
        { device: 'pa1q', model: 'SM-S931B', sdk: [35, 36] },
        { device: 'pa3q', model: 'SM-S938B', sdk: [35, 36] },
        { device: 'a52q', model: 'SM-A525F', sdk: [30, 34] },
        { device: 'a53x', model: 'SM-A536B', sdk: [31, 35] },
        { device: 'a54x', model: 'SM-A546B', sdk: [33, 36] },
        { device: 'a55x', model: 'SM-A556B', sdk: [34, 36] },
        { device: 'a34x', model: 'SM-A346B', sdk: [33, 36] },
        { device: 'a35x', model: 'SM-A356B', sdk: [34, 36] },
        { device: 'a15', model: 'SM-A155F', sdk: [34, 36] },
        { device: 'a16', model: 'SM-A165F', sdk: [34, 36] },
        { device: 'garnet', model: '23122PCD1G', sdk: [33, 35] },
        { device: 'peridot', model: '24069PC21G', sdk: [34, 36] },
        { device: 'tapas', model: '23021RAAEG', sdk: [33, 34] },
        { device: 'OP594DL1', model: 'CPH2449', sdk: [33, 36] },
        { device: 'OP595DL1', model: 'CPH2581', sdk: [34, 36] },
    ]

/** The phone Isocord actually runs on. */
export function realDeviceProfile(): DeviceProfile {
    return {
        device: Device.designName ?? '',
        model: Device.modelName ?? '',
        osVersion: String(Platform.Version),
    }
}

/**
 * A random phone for a new account. Its Android version is the real one moved into the phone's range, so
 * it stays close to what the real TLS handshake (from the real Android) suggests.
 */
export function randomDeviceProfile(): DeviceProfile {
    const pick = DEVICES[Math.floor(Math.random() * DEVICES.length)]!
    const [min, max] = pick.sdk
    const sdk = Math.min(Math.max(Number(Platform.Version), min), max)
    return { device: pick.device, model: pick.model, osVersion: String(sdk) }
}
