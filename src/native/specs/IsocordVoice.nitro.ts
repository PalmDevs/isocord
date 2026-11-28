import type { HybridObject } from 'react-native-nitro-modules'

/** Values the voice engine owns (HybridIsocordVoice.kt). */
export interface VoiceConstants {
    /** Headless task that keeps JS timers, and so the gateway, running in the background during a call. */
    callTaskKey: string
    /** Volume at unity, as an amplitude (media-engine `DEFAULT_VOLUME`). */
    defaultVolume: number
    /** Highest input, output and per-user volume, as an amplitude. */
    maxVolume: number
    /** Default `InputMode.threshold`, dBFS (MediaEngineStore `modeOptions.threshold`). */
    defaultThreshold: number
    /** Lowest `inputLevel`, dBFS. Digital silence reports this. */
    inputLevelFloor: number
    /** JSON `StreamTables`: Go Live presets and what each quality needs (StreamPresets.kt). */
    streamPresets: string
}

/**
 * Voice, video and Go Live media (HybridIsocordVoice.kt). JS owns the gateway side (ops 4 and 18 to 22), Kotlin owns
 * media, DAVE, Telecom, call audio and the call notification. JSON payloads are typed in `voiceTypes.ts`.
 * All methods are fire-and-forget; results arrive on `onVoiceEvent`.
 */
export interface IsocordVoice extends HybridObject<{ android: 'kotlin' }> {
    getConstants(): VoiceConstants
    /**
     * Starts or updates the call: its Telecom call (or its own audio with `telecom: false`), its notification and
     * the background keep-alive. JSON `CallDetails`.
     */
    beginCall(details: string): void
    /** Closes every connection and ends the Telecom call or releases the call's audio. */
    endCall(): void
    /** Opens a voice server connection, replacing one of the same context. JSON `ConnectRequest`. */
    connect(request: string): void
    /** Closes one connection. `RtcContext`. */
    disconnect(context: string): void
    setSelfMute(muted: boolean): void
    setSelfDeaf(deafened: boolean): void
    /** From our voice state's `mute`/`suppress` and `deaf`: enforced like the self flags. */
    setServerMute(muted: boolean): void
    setServerDeaf(deafened: boolean): void
    /** Camera on or off. Asks for the CAMERA permission itself, an `error` event on refusal. */
    setVideo(on: boolean): void
    /** The next camera (VoicePanelHeader). A `camera` event with `picked` follows, for JS to remember. */
    switchCamera(): void
    /**
     * The camera to capture with, JSON `CameraDevice`, or `null` for the default (front). A running camera moves
     * to it without renegotiating. One that is absent falls back to the default.
     */
    setCamera(camera: string): void
    /** Emits `cameras` now and whenever a camera comes or goes (a USB camera) while on, for the camera pickers. */
    setCameraReporting(on: boolean): void
    /**
     * What to receive on one connection, `RtcContext` and JSON `SinkWants`. Native maps users to SSRCs and
     * sends Media Sink Wants (op 15) when it changes. Call it once `connected`: a connection starts at
     * `any: 100`, and a reconnect keeps the last call's wants.
     */
    setSinkWants(context: string, wants: string): void
    /** Asks for screen capture consent, for the next own stream `connect`. Answers with `screenConsent`. */
    requestScreen(): void
    /** An `AudioEndpoint` id from the `endpoints` event. */
    setEndpoint(id: string): void
    /**
     * The remembered devices, JSON `PreferredDevices`. The input applies at once. The output is picked when it
     * appears in a call: at its start or when it connects. Absent devices leave the system's choice.
     */
    setPreferredDevices(devices: string): void
    /** Emits `audioDevices` now and on every device change while on, for the device pickers. */
    setAudioDeviceReporting(on: boolean): void
    /** Voice activity or push to talk, sensitivity and processing. JSON `InputMode`. Applies mid-call. */
    setInputMode(mode: string): void
    /** The push to talk button. Ignored in voice activity. Sending stops after the reference's release delay. */
    setPushToTalk(down: boolean): void
    /** Mic gain after processing. An amplitude from 0 to `maxVolume`, `defaultVolume` is unity (`inputVolume`). */
    setInputVolume(volume: number): void
    /** Scales all remote playback, both contexts. Same range as `setInputVolume` (`outputVolume`). */
    setOutputVolume(volume: number): void
    /** One remote user's playback in one `RtcContext`. Same range (`localVolumes`). */
    setLocalVolume(context: string, userId: string, volume: number): void
    /** Silences one remote user in one `RtcContext` (`localMutes`). */
    setLocalMute(context: string, userId: string, muted: boolean): void
    /**
     * Emits `inputLevel` about 10 times a second while on, for the sensitivity meter. Works outside a call: it
     * records the mic just for the meter. Needs RECORD_AUDIO.
     */
    setInputLevelReporting(on: boolean): void
    /**
     * Our own stream's latest preview, a base64 JPEG without the `data:` prefix, or undefined without one. JS uploads it
     * to `/streams/{key}/preview`.
     */
    captureStreamPreview(): Promise<string | undefined>
    /** Registers a listener for JSON `VoiceEvent` payloads. Returns the unsubscribe function. */
    onVoiceEvent(listener: (payload: string) => void): () => void
}
