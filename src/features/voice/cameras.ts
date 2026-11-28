import { useEffect } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { t } from '../../i18n'
import native from '../../native/IsocordVoice'
import { setVoiceSetting } from './settings/voiceSettings'
import type { CameraDevice, VoiceEvent } from '../../native/voiceTypes'

/**
 * The phone's cameras and the one capture runs on. The device's, not an account's, so one store for the
 * process. `cameras` is null until native reports them (`useCameras`).
 */
interface CameraState {
    cameras: readonly CameraDevice[] | null
    current: CameraDevice | null
}

export const cameraStore = createStore<CameraState>(() => ({
    cameras: null,
    current: null,
}))

/** Mounted pickers. Reporting runs while any is. */
let reporters = 0

/** Applies a `camera` or `cameras` event. A camera native picked itself (the switch button) is remembered. */
export function onCameraEvent(
    event: Extract<VoiceEvent, { type: 'camera' | 'cameras' }>,
): void {
    if (event.type === 'cameras') {
        cameraStore.setState({ cameras: event.cameras })
        return
    }
    cameraStore.setState({ current: event.camera })
    if (event.picked) setVoiceSetting('camera', event.picked)
}

/** Returns the phone's cameras while mounted, null until native reports them. */
export function useCameras(): readonly CameraDevice[] | null {
    useEffect(() => {
        if (!native) return undefined
        const voice = native
        reporters += 1
        if (reporters === 1) voice.setCameraReporting(true)
        return () => {
            reporters -= 1
            if (reporters === 0) voice.setCameraReporting(false)
        }
    }, [])
    return useStore(cameraStore, state => state.cameras)
}

/** Whether our camera preview is mirrored: only the front camera's, as the reference's own preview. */
export function useMirrorOwnCamera(): boolean {
    return useStore(
        cameraStore,
        state => (state.current?.facing ?? 'front') === 'front',
    )
}

export function sameCamera(a: CameraDevice | null, b: CameraDevice | null) {
    return a?.id === b?.id && a?.facing === b?.facing
}

/**
 * Isocord's own: the reference names cameras only in "Switch to front/back camera". A USB camera shows its
 * model when Camera2 has one. With `cameras`, a second back lens is numbered.
 */
export function cameraLabel(
    camera: CameraDevice,
    cameras: readonly CameraDevice[] = [],
): string {
    if (camera.facing === 'front') return t('voice.camera.front')
    if (camera.facing === 'external')
        return camera.name || t('voice.camera.external')
    const backs = cameras.filter(device => device.facing === 'back')
    const index = backs.findIndex(device => device.id === camera.id)
    return index > 0
        ? t('voice.camera.backNumbered', { number: index + 1 })
        : t('voice.camera.back')
}
