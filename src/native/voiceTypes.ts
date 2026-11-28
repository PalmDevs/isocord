/**
 * JSON payloads of IsocordVoice. Kotlin decodes and encodes them with `@Serializable` types in
 * `me.palmdevs.isocord.voice` (VoiceEvent.kt and others), read by HybridIsocordVoice.kt. Change both sides together.
 */

/** `default` is the voice channel or call. `stream` is the Go Live stream we watch or own. */
export type RtcContext = 'default' | 'stream'

/** `beginCall`: what the call notification and Telecom show. Strings already translated. */
export interface CallDetails {
    /**
     * `false` runs the call without Telecom, so other apps can record while it lasts. Native then
     * manages the audio mode, focus and output itself. Defaults to true. Read when the call begins:
     * a change mid-call is ignored until the next call.
     */
    telecom?: boolean
    /** The channel name. */
    title: string
    /** The guild name, or empty in a DM call. */
    subtitle: string
    /** Notification button labels. */
    strings: {
        /** The notification channel's name in system settings. */
        channel: string
        disconnect: string
        mute: string
        unmute: string
        deafen: string
        undeafen: string
    }
}

/** `connect`: one voice server, from VOICE_SERVER_UPDATE or STREAM_SERVER_UPDATE plus our voice state. */
export interface ConnectRequest {
    context: RtcContext
    /** Host without scheme, as the gateway sends it. */
    endpoint: string
    token: string
    /** Guild id, else the DM channel id, or a stream's `rtc_server_id`. */
    serverId: string
    /** The voice channel, or the stream's RTC channel. */
    channelId: string
    userId: string
    sessionId: string
    /** A stream we own: sends the screen from the last `requestScreen` consent. */
    owner: boolean
    /**
     * The channel's `video_quality_mode`: 1 auto, 2 full. Full never scales our video down for bandwidth.
     * Omit it for auto.
     */
    videoQualityMode?: number
    /** Own stream: a `StreamTables` resolution, 0 for source. Omit it for 720. */
    streamResolution?: number
    /** Own stream: a `StreamTables` frame rate. Omit it for 30. */
    streamFramerate?: number
    /** Own stream: also sends other apps' audio (Android 10+). Defaults to true. */
    soundshare?: boolean
}

/** `getConstants().streamPresets`: the reference's Go Live tables (`getApplicationStreamPresetValues`). */
export interface StreamTables {
    /** Preset id to the settings it allows, best first. */
    presets: Record<string, { resolution: number; fps: number }[]>
    /** What each resolution and frame rate needs: Nitro quality, a boost tier, or a preset. */
    requirements: {
        resolution: number
        fps: number
        quality?: string
        guildPremiumTier?: number
        preset?: number
    }[]
}

/**
 * `setSinkWants`: which video to receive, as Media Sink Wants (docs.discord.food). Qualities run from 0 to 100.
 * 0 turns a stream off and nothing is sent for it. A user who sends two layers gets the better one at a
 * quality above 50, else the lower.
 */
export interface SinkWants {
    /** Quality for users not in `users`. Defaults to 100. */
    any?: number
    /** User id to quality. */
    users?: Record<string, number>
    /** User id to the pixels their video covers on screen. Lets Go Live senders scale down. */
    pixelCounts?: Record<string, number>
}

/**
 * `setInputMode`. Names and defaults follow MediaEngineStore `modeOptions` and its processing toggles.
 * Fields left out keep the reference's mobile defaults.
 */
export interface InputMode {
    /** `pushToTalk` sends while the button is held. Required where the channel lacks USE_VAD. */
    mode: 'voiceActivity' | 'pushToTalk'
    /**
     * Voice activity from RNNoise's voice probability instead of `threshold`, like the reference's Krisp VAD.
     * Falls back to `defaultThreshold` when RNNoise cannot run. Default off.
     */
    autoThreshold: boolean
    /** Fixed sensitivity, dBFS. Defaults to the `defaultThreshold` constant. */
    threshold: number
    /**
     * `standard` is the platform's or WebRTC's NS (`noiseSuppression`). `enhanced` is RNNoise in place of Krisp
     * (`noiseCancellation`), and the default. It steps down to standard on a slow device: see `noiseSuppressionTier`.
     */
    noiseSuppression: 'off' | 'standard' | 'enhanced'
    /** The platform's AEC where the device has one, else WebRTC's. Default on. */
    echoCancellation: boolean
    /** WebRTC's AGC: Android has no platform AGC. Default on. */
    autoGainControl: boolean
    /** We have PRIORITY_SPEAKER: push to talk sends the priority speaking flag. Default off. */
    prioritySpeaker: boolean
}

/** An audio output: a Telecom endpoint, or an Android output device in a call without Telecom. */
export interface AudioEndpoint {
    /** Opaque. Pass it back to `setEndpoint`. */
    id: string
    name: string
    kind:
        | 'earpiece'
        | 'speaker'
        | 'wired'
        | 'bluetooth'
        | 'streaming'
        | 'unknown'
    /** The device's address, such as a Bluetooth MAC. Telecom endpoints have none. */
    address?: string
    /** A Bluetooth LE headset. */
    lowEnergy?: boolean
}

/** A microphone, from `audioDevices`. */
export interface AudioInputDevice {
    /** Opaque, valid while the device stays connected. */
    id: string
    name: string
    /** `microphone` is the phone's own: several built-in mics show as one. */
    kind: 'microphone' | 'wired' | 'bluetooth'
    address?: string
    lowEnergy?: boolean
}

/**
 * A device's identity across calls. Built-in devices match by kind, others by name, and by address when both
 * sides know it (Telecom endpoints have no address).
 */
export interface AudioDeviceKey {
    kind: AudioEndpoint['kind'] | AudioInputDevice['kind']
    name: string
    address?: string
}

/** `setPreferredDevices`. A missing device leaves the system's choice. */
export interface PreferredDevices {
    input?: AudioDeviceKey
    output?: AudioDeviceKey
}

/**
 * A camera, and its identity across calls (Cameras.kt). `id` is the Camera2 id, which a USB camera may change
 * when plugged in again. `name` is its model where Camera2 reports one, else empty.
 */
export interface CameraDevice {
    id: string
    facing: 'front' | 'back' | 'external'
    name: string
}

/** `onVoiceEvent` payloads, discriminated by `type`. */
export type VoiceEvent =
    | {
          type: 'state'
          context: RtcContext
          /**
           * `reconnecting` while native recovers the media path itself: after a network change or a
           * failed peer it restarts ICE, then reconnects the voice gateway. `disconnected` comes only
           * when that fails, and JS then rejoins with op 4.
           */
          state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
          /** Voice gateway close code that ended the connection, when it ended on its own. */
          code?: number
      }
    /** Op 5 for others, voice activity for ourselves. */
    | {
          type: 'speaking'
          context: RtcContext
          userId: string
          speaking: boolean
      }
    | { type: 'video'; context: RtcContext; userId: string; active: boolean }
    | { type: 'clientConnect'; context: RtcContext; userIds: string[] }
    | { type: 'clientDisconnect'; context: RtcContext; userId: string }
    /** DAVE protocol version in use. 0 is not end-to-end encrypted. */
    | { type: 'secureFrames'; context: RtcContext; version: number }
    /**
     * Our camera stopped on its own: another app took it, it failed or it froze. Native already sent
     * Video (op 12) inactive and an `error` event with kind `camera`. JS clears `selfVideo` and sends
     * op 4 with `self_video: false`. `setVideo(true)` turns it on again.
     */
    | {
          type: 'cameraStopped'
          reason: 'disconnected' | 'error' | 'freeze'
      }
    /**
     * The camera capture runs on, null once it stops. `picked` is set when native picked the camera itself (the
     * switch button): JS remembers it.
     */
    | {
          type: 'camera'
          camera: CameraDevice | null
          picked: CameraDevice | null
      }
    /** While `setCameraReporting` is on: every camera, again whenever one comes or goes. */
    | { type: 'cameras'; cameras: CameraDevice[] }
    | { type: 'screenConsent'; granted: boolean }
    /** Our screen capture stopped outside the app, such as the system's "Stop sharing" chip. */
    | { type: 'streamEnded' }
    /** Our stream's screen is off or the captured app is hidden. JS sends op 22 with `paused`. */
    | { type: 'streamPaused'; paused: boolean }
    /** From the call notification, a headset, a watch or the system. JS applies it like a tap. */
    | { type: 'callAction'; action: 'disconnect' }
    | { type: 'callAction'; action: 'mute' | 'deafen'; on: boolean }
    | { type: 'endpoints'; available: AudioEndpoint[]; current: string | null }
    /**
     * While `setAudioDeviceReporting` is on. `outputs` are the phone's, for picking outside a call. `input` and
     * `output` are the remembered devices' ids while they are connected, else null.
     */
    | {
          type: 'audioDevices'
          inputs: AudioInputDevice[]
          outputs: AudioEndpoint[]
          input: string | null
          output: string | null
      }
    /** Our mic level in dBFS, while `setInputLevelReporting` is on. Never below `inputLevelFloor`. */
    | { type: 'inputLevel'; level: number }
    /**
     * Enhanced noise suppression stepped down to standard for the rest of the call. `slow`: RNNoise used more
     * than its time budget. `sampleRate`: WebRTC processes capture at a rate RNNoise cannot take.
     */
    | {
          type: 'noiseSuppressionTier'
          tier: 'standard'
          reason: 'slow' | 'sampleRate'
      }
    /**
     * Our mic stopped delivering sound. `busy`: another app or the privacy toggle has it. `permission`:
     * RECORD_AUDIO is missing. An `error` event with kind `microphone` comes too, except for `busy` silence.
     * Unmuting starts the recorder again.
     */
    | {
          type: 'microphoneStopped'
          reason: 'busy' | 'permission' | 'error'
          message: string
      }
    /** Sound came back after `microphoneStopped`. */
    | { type: 'microphoneResumed' }
    /** The default network changed under a connection. The voice connection reconnects on its own. */
    | { type: 'networkChanged'; context: RtcContext }
    | {
          type: 'error'
          kind: 'microphone' | 'camera' | 'screen' | 'connection'
          message: string
      }
