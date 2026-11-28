import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../core/session'
import { readJson, writeJson } from '../../core/storage'
import native from '../../native/IsocordVoice'
import { amplitudeToPerceptual } from './settings/perceptualVolume'
import type { Session } from '../../core/session'
import type { RtcContext } from '../../native/voiceTypes'

/** AudioContextSetting: one user's playback in one context. */
export interface LocalAudio {
    /** An amplitude. Unset is the default volume. */
    volume?: number
    muted?: boolean
}

/** MediaEngineStore's `localVolumes` and `localMutes`, by context and user id. */
export type LocalVolumesState = Record<RtcContext, Record<string, LocalAudio>>

const STORAGE_KEY = 'voice.localAudio'

const EMPTY: LocalVolumesState = { default: {}, stream: {} }

const constants = native?.getConstants()
/** The media engine's unity volume, and its highest. */
export const DEFAULT_VOLUME = constants?.defaultVolume ?? 0
export const MAX_VOLUME = constants?.maxVolume ?? 0
/** snapVolumeToDefault: a volume this close to the default, in perceptual units, is the default. */
const SNAP_DISTANCE = 1

/** snapVolumeToDefault. */
function snapVolumeToDefault(amplitude: number): number {
    const perceptual = (volume: number) =>
        amplitudeToPerceptual(volume, DEFAULT_VOLUME)
    const distance = Math.abs(
        perceptual(amplitude) - perceptual(DEFAULT_VOLUME),
    )
    return distance < SNAP_DISTANCE ? DEFAULT_VOLUME : amplitude
}

/**
 * The per-user volumes and mutes of this account, kept on the device. The reference syncs them in the
 * `audioContextSettings` user setting instead.
 */
export const localVolumesStore = defineStore('localVolumes', session => {
    const store = createStore<LocalVolumesState>(
        () => readJson(session.storage, STORAGE_KEY) ?? EMPTY,
    )
    store.subscribe(state => writeJson(session.storage, STORAGE_KEY, state))
    return store
})

/** Returns a user's entry with `change` applied, or undefined once it holds only defaults. */
function updated(entry: LocalAudio | undefined, change: LocalAudio) {
    const next = { ...entry, ...change }
    // AudioSettingsManager: a user back at the default, unmuted, is dropped.
    const custom =
        (next.volume !== undefined && next.volume !== DEFAULT_VOLUME) ||
        next.muted === true
    return custom ? next : undefined
}

function update(
    session: Session,
    context: RtcContext,
    userId: string,
    change: LocalAudio,
) {
    const store = session.get(localVolumesStore)
    store.setState(state => {
        const { [userId]: entry, ...others } = state[context]
        const next = updated(entry, change)
        return { [context]: next ? { ...others, [userId]: next } : others }
    })
}

/** AudioActionCreators.setLocalVolume: snaps next to the default, then plays and keeps it. */
export function setLocalVolume(
    session: Session,
    context: RtcContext,
    userId: string,
    amplitude: number,
): void {
    const volume = snapVolumeToDefault(amplitude)
    native?.setLocalVolume(context, userId, volume)
    update(session, context, userId, { volume })
}

/** AudioActionCreators.toggleLocalMute. */
export function toggleLocalMute(
    session: Session,
    context: RtcContext,
    userId: string,
): void {
    const store = session.get(localVolumesStore)
    const muted = !store.getState()[context][userId]?.muted
    native?.setLocalMute(context, userId, muted)
    update(session, context, userId, { muted })
}

/** Sends every kept volume and mute of `context` to its new connection. */
export function applyLocalVolumes(session: Session, context: RtcContext): void {
    const entries = session.get(localVolumesStore).getState()[context]
    for (const [userId, audio] of Object.entries(entries)) {
        if (audio.volume !== undefined)
            native?.setLocalVolume(context, userId, audio.volume)
        if (audio.muted) native?.setLocalMute(context, userId, true)
    }
}
