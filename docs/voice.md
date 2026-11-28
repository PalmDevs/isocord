# Voice, video and Go Live: production design

Status: draft, 2026-11-26. Built on the voice spike (branch `worktree-voice-spike`).

## 1. Scope and phases

| Phase | Ships |
|---|---|
| 0. Prototype | The spike grown into the real structure (sections 3 to 6), driven by a minimal UI. Tested on the emulator, then on a real phone |
| 1. Guild voice | Voice states, voice channel rows with participants, join/leave/move, mute, deafen, speaking indicators, Telecom call and its notification, audio routing, reconnects, noise suppression |
| 2. Video | Voice panel grid, camera receive and send, watching Go Live |
| 3. Going live | Screen share with app audio, stream previews, viewer list |
| 4. DM and group calls | CALL_* events, ringing, incoming calls from the background session |
| 5. Extras | Stage channels, per-user volume UI, DAVE verification codes, soundboard (maybe never) |

The engine keeps video from the start so the seam doesn't change later.

## 2. What the spike proved

Against real Discord clients on 2026-11-26:
- DAVE (E2EE) voice both ways, with libdave built from pinned commits (`vendor/dave/build.sh`).
- Camera receive and send (VP8, the emulator has no H264 encoder).
- Watching a Go Live stream with its audio, going live with the screen.
- Mute and deafen that really stop sending and playback.
- Voice gateway resume (op 7) after a socket drop.
- A 5-minute call with the app in the background: no gateway reconnect, voice state kept, playback continued.
- libdave builds for arm64-v8a, armeabi-v7a and x86_64.

Carries over: `VoiceSdp.kt` (offer munging, answer building, PT 96 remap), `DaveSession.kt` + `dave_jni.cpp`,
`LocalVideo.kt`, the voice gateway state machine in `VoiceSpikeSession.kt` (split up, see 3.2), the headless
call task, `GatewaySocket.setInCall`, `AppVisibility.setCall` (reworked, see 3.6).

Thrown away: `SpikeAudio` (beep tone, WAV), `SpikeVideo` (frame dumps), `LoopbackSelfTest`, `SelfTestReceiver`,
the broadcast command channel, `features/voiceSpike`, `VoiceCallService` (replaced by the Telecom service).

## 3. Architecture

### 3.1 Split

```
JS (per Session)                                   Kotlin (per process)
--------------------------------------------       ------------------------------------------------
stores/voiceStates.ts  VOICE_STATE_UPDATE          voice/CallEngine       factory, ADM, EGL, connections
features/voice/        rtc store, streams,   <-->  voice/RtcConnection    one voice gateway + PeerConnection
  join/leave, ops 4/18-22, UI, panel   IsocordVoice voice/VoiceGateway     op 0-31 socket, resume, heartbeat
                                       (Nitro)       voice/Sdp, voice/dave from the spike
                                       IsocordVideoView voice/capture      mic, camera, screen, app audio
                                       (native view) voice/audio           noise suppression, levels, VAD
                                                    voice/telecom          CallsManager, service, notification
```

Rule of thumb: **the main gateway and everything Discord-state is JS; everything media and system-call is
Kotlin.** JS never sees an SDP, an SSRC or a DAVE message. Kotlin never sees a guild, a permission or a user name
(the call notification gets display strings from JS).

Why not all-native: voice states, permissions, channel names and the UI already live in JS stores, and the JS
gateway owns the voice state (Discord drops it when that session goes). Why not more JS: media timing, DAVE and
the background have to run without the JS thread.

### 3.2 Kotlin: `me.palmdevs.isocord.voice`

- **`CallEngine`** (process singleton). One `PeerConnectionFactory`, one `JavaAudioDeviceModule`, one `EglBase`.
  Holds at most one voice `RtcConnection` and one stream `RtcConnection` (watched or own). The spike made a factory
  and ADM per connection, so stream audio and voice audio were two AudioTracks with separate deafen. One ADM
  mixes both and deafens once.
- **`RtcConnection`**. One voice server: `VoiceGateway` + `PeerConnection` + `DaveSession`. Context `DEFAULT` or
  `STREAM` (reference `RTCConnection` / `StreamRTCConnection`). Keeps its own `RtpTransceiver` list (never call
  `getTransceivers()`/`getSenders()` again, see 7.1). Serializes renegotiation with a mutex.
  Receive sections: 4 audio and 2 video recvonly up front. A speaker or camera that finds none free adds a batch
  (4 audio, 2 video) in one renegotiation, kept in our own list. A freed user's sections are reused.
- **`VoiceGateway`**. The socket state machine: HELLO, IDENTIFY/RESUME, heartbeat with `seq_ack`, close codes,
  backoff. From the spike, plus the full reconnect (6.2).
- **`VoiceOpcodes.kt`**. The Kotlin facts file for voice gateway opcodes, close codes, speaking flags and codec ids.
- **`capture/`**. `CameraSource` (Camera2, front/back switch), `ScreenSource` (MediaProjection), `AppAudioSource`
  (AudioPlaybackCapture, phase 3).
- **`audio/`**. Noise suppression (4.2), input level, VAD (4.1).
- **`telecom/`**. `CallService` hosting `CallsManager` (6.4): the call's lifetime, audio endpoints, the CallStyle
  notification, the foreground service. `CallAudio` and its `AudioRoutes` for a call without Telecom (6.5).
- **`VideoViewManager`**. `IsocordVideoView` Fabric view: a `TextureView` fed by webrtc's `EglRenderer` (5.1),
  bound to a track by `{userId, context}`. Tracks live in a registry in `CallEngine`, views attach and detach.

### 3.3 The seam: `IsocordVoice`

A Nitro HybridObject: `src/native/specs/IsocordVoice.nitro.ts`, `HybridIsocordVoice.kt`. Calls come on the JS
thread, and CallEngine queues them on its own dispatcher. Methods (all fire-and-forget; results come back as events):

| Method | Notes |
|---|---|
| `beginCall(json)`, `endCall()` | The Telecom call (or the call's own audio, 6.5), notification and background keep-alive. `{title, subtitle, strings, telecom?}` (`CallDetails`). `telecom: false` runs the call without Telecom, read when the call begins |
| `connect(json)` | `{context, endpoint, token, serverId, channelId, userId, sessionId, owner, videoQualityMode?}` (`ConnectRequest`). Flags persist across connects. Mode 2 (full) never scales our video down |
| `disconnect(context)` | |
| `setSelfMute(bool)`, `setSelfDeaf(bool)` | Local enforcement. JS sends op 4 itself |
| `setServerMute(bool)`, `setServerDeaf(bool)`, `setSuppressed(bool)` | From our voice state; enforced like self flags |
| `setVideo(on)`, `switchCamera()` | Asks CAMERA permission itself, emits `error` on refusal |
| `requestScreen()` | MediaProjection consent; emits `screenConsent(granted)` |
| `setInputMode(json)` | `{mode, autoThreshold, threshold, noiseSuppression, echoCancellation, autoGainControl, prioritySpeaker}` (`InputMode`). Applies mid-call |
| `setPushToTalk(down)` | |
| `setLocalVolume(context, userId, 0..200)`, `setLocalMute(context, userId, bool)` | Per user and context, like `localVolumes` |
| `setInputVolume(0..200)`, `setOutputVolume(0..200)` | Amplitudes, 100 is unity |
| `setInputLevelReporting(on)` | `inputLevel` events for the sensitivity meter, in or outside a call |
| `setEndpoint(id)` | Audio endpoint from `endpoints`: speaker, earpiece, wired, Bluetooth. Telecom's, or an output device without Telecom (6.5) |
| `setPreferredDevices(json)` | `{input?, output?}` (`PreferredDevices`), each `{kind, name, address?}`: the remembered devices (4.3) |
| `setAudioDeviceReporting(on)` | `audioDevices` events (inputs, the phone's outputs, the remembered ones' ids) for the pickers |
| `setCamera(json)` | `CameraDevice` `{id, facing, name}` or `null`: the remembered camera (5.1). A running camera switches to it |
| `setCameraReporting(on)` | `cameras` events (every Camera2 camera, again when a USB camera comes or goes) for the pickers |
| `setSinkWants(context, json)` | `{any?, users?, pixelCounts?}` (`SinkWants`): user id to quality 0 to 100, and on-screen pixels. Native maps users to SSRCs and sends op 15. Call it once `connected` |
| `captureStreamPreview(): Promise<string \| undefined>` | Our stream's latest frame, base64 JPEG, for `/streams/{key}/preview` |

Events (JSON strings to `onVoiceEvent(listener)`, which returns the unsubscribe function, discriminated by `type`, a `@Serializable` sealed class on the Kotlin side):
`state` (connecting, connected, rtc states, disconnected with reason), `speaking` (userId, flags or level),
`video` (userId, streams active), `cameraStopped` (our camera failed, see 5.1), `camera` (the camera capture runs
on, and `picked` after the switch button), `cameras` (while reporting), `clientConnect`/`clientDisconnect`, `ping` (ms, quality), `secureFrames`
(DAVE version, epoch, privacy code), `streamEnded` (consent revoked, capture stopped), `callAction`
(disconnect, mute, deafen, answer, reject from the notification, a headset or a watch), `endpoints` (available
and current), `error`. Audio (4): `inputLevel`, `noiseSuppressionTier`, `microphoneStopped`, `microphoneResumed`,
`audioDevices`.

Constants owned by Kotlin and read through `getConstants()`: the headless task key, the volume default and
maximum, the default sensitivity, the input level floor, stream quality presets,
max video tiles, the speaking hangover. Discord protocol facts (main gateway ops 4, 18-22) stay in
`src/core/gateway/opcodes.ts`.

### 3.4 JS

- **`src/stores/voiceStates.ts`** (core store, not cached: it is live state). Voice states per guild from
  READY_SUPPLEMENTAL `guilds[].voice_states` (user accounts get none in READY, which keeps what is held, as
  CONNECTION_OPEN does), GUILD_CREATE, VOICE_STATE_UPDATE and VOICE_STATE_UPDATE_BATCH. DM call voice states from CALL_CREATE. Indexed by
  channel for the channel list. Reference `VoiceStateStore`, `SortedVoiceStateStore`.
- **`src/features/voice/`**:
  - `rtc.ts` store: selected voice channel, our target flags, connection state, ping, speaking user set, users
    with video, DAVE state. Reference `RTCConnectionStore`, `SelectedChannelStore` (voice part), `MediaEngineStore`
    (flags only).
  - `streams.ts` store: STREAM_CREATE/UPDATE/DELETE/SERVER_UPDATE, the watched stream, our own stream, viewers.
    Reference `ApplicationStreamingStore`, `StreamRTCConnectionStore`.
  - `actions.ts`: `selectVoiceChannel`, `disconnect`, `toggleSelfMute`, `toggleSelfDeaf`, `setVideo`, `goLive`,
    `watchStream`, `stopStream`. Reference `selectVoiceChannel`, `StreamActionCreators`.
  - `callTask.ts`: the headless task from the spike.
  - UI folders: `panel/`, `rows/`, `controls/`, `settings/`, `goLive/`.
- **`src/features/calls/`** (phase 4): `calls.ts` store (CALL_CREATE/UPDATE/DELETE, ringing), ring/stop ring.

### 3.5 Join, move, leave

1. `selectVoiceChannel(guildId, channelId)`: permission and capacity checks (section 5), RECORD_AUDIO permission,
   then op 4 `{guild_id, channel_id, self_mute, self_deaf, self_video}`. Add the Telecom call and start
   `CallService` now, while the app is in front.
2. Our VOICE_STATE_UPDATE (same `session_id`) plus VOICE_SERVER_UPDATE: `connect`. Skip a VOICE_SERVER_UPDATE
   with `endpoint: null` (server allocating) and wait for the next one. A 30 s timeout without our voice state
   gives up (reference `VOICE_CHANNEL_SELECT` handler).
3. Moved by a moderator: our voice state with a new `channel_id`, same session. Reference `setNextChannelId`:
   the voice server follows with a new VOICE_SERVER_UPDATE if it changes.
4. Our voice state with another `session_id` in the same guild: we joined from another device. Disconnect
   locally (reference `RTCConnectionStore` VOICE_STATE_UPDATES, "remote disconnect").
5. `channel_id: null` for our session: kicked or disconnected. Tear down.
6. CHANNEL_DELETE, THREAD_DELETE, GUILD_DELETE, CALL_DELETE of the current channel: tear down.
7. Leave: native `disconnect`, op 4 with `channel_id: null`, end the Telecom call, `setInCall(false)`.
8. Account switch or logout: leave first. `Session` dispose calls it.

### 3.6 Background and notifications

Keeping the call alive (from the spike):
- `GatewaySocket.setInCall(true)` keeps the app socket open in the background.
- The headless JS task keeps JS timers running (RN only runs them in the background while one is active).
- `CallService` in the foreground (6.4).
- The background notification session stays paused: one gateway connection per account, and the app's owns the
  voice state.

**Notifications during a call.** Today `AppVisibility.foreground` means both "the app's session serves
notifications" and "the user sees the app". The spike set it during a background call, so:
- the app's session serves notifications (right), but posts them on the `inApp` channel, which doesn't pop up
  (wrong);
- JS still counts the last open chat as visible, so its messages don't notify at all (wrong).

Fix:
- `AppVisibility` gets two values. `visible` is the activity resumed. `appSessionLive` is `visible || inCall`.
- `SessionNotifier.live` reads `appSessionLive`. `MessageNotifier.post`/`alert` pick the `inApp` channel only
  when `visible`, so a backgrounded call gets normal pop-ups with sound.
- JS clears the visible chat when `AppState` goes to background (`inAppNotifications/store.ts`
  `visibleChannelId`), and sets it back on return.
- No replay problem: the same session keeps serving across the switch, so `Handover` doesn't run.
- The voice channel's own text chat notifies like any channel.

## 4. Audio

All of it lives in `voice/audio/` (`AudioInput` owns the state) and `voice/VoiceActivity.kt`. The native part is
`libisocord_audio.so` (`cpp/audio/`), RNNoise from `vendor/rnnoise/fetch.sh`.

### 4.1 Voice activity and push to talk

Discord clients send audio only while you speak. On a burst start they open the stream and send op 5 SPEAKING
with flag VOICE. After a quiet hangover they send op 5 with 0 and stop sending.

- **Gate.** Nothing is sent between bursts: our DAVE frame encryptor has a gate. A closed gate makes `Encrypt`
  fail, which drops the frame before packetizing (`audio/channel_send.cc`). The encoding stays active while unmuted,
  so the mic stays open for the detector and a burst starts with no `setParameters` round trip.
  `RtcConnection.setSpeaking` opens or closes the gate and sends op 5.
- **Level.** One dBFS level per 10 ms frame (`MicMonitor`). The frame after WebRTC's processing and RNNoise wins
  (the capture hook, 4.2), so a noisy room is measured after suppression. The raw ADM frame stands in when WebRTC
  isn't processing, such as the meter outside a call. Both arrive on the record thread, processed first.
- **Fixed sensitivity.** Level against `threshold`, default -60 dBFS (`modeOptions.threshold`).
- **Automatic sensitivity.** The reference's mobile default is "Advanced Voice Activity": Krisp's voice probability
  against `vadKrispActivationThreshold` 0.5. We use RNNoise's voice probability, which `rnnoise_process_frame`
  returns for every frame, against the same 0.5. It runs whenever `autoThreshold` is on, even when noise
  suppression isn't enhanced (the output is then dropped). libwebrtc's own options don't fit: APM voice detection
  was removed, and AGC2's RNN VAD isn't exposed. Without RNNoise (slow device, other rate) it falls back to the
  -60 dBFS level.
- **Hangover.** A burst starts on one voiced frame and ends after 25 quiet ones (`vadTrailing`). Not done: the
  reference's `vadLeading` (5 frames kept before the burst). Our gate drops frames, so the first syllable may clip.
- **Push to talk.** `setPushToTalk(down)` drives the gate and op 5 instead. Release waits 20 ms (`modeOptions.delay`,
  `pttReleaseDelay`). With `prioritySpeaker` (we have PRIORITY_SPEAKER) op 5 carries VOICE | PRIORITY (4). Switching
  mode closes the gate. Required where the channel lacks USE_VAD (JS decides).
- **JS side** (`voice/settings/`). The settings live in a device store (`voiceSettings.ts`), device-wide like
  MediaEngineStore's. `registerVoiceSettings` sends `setInputMode`, `setInputVolume` and `setOutputVolume` at every
  session start and on each change: native forgets them with the process. `InputMode.mode` is push to talk when the
  setting says so, or in a guild voice channel without USE_VAD (not a stage). The reference keeps voice activity
  there, mutes it and shows "Push to Talk Required". Isocord switches to push to talk and toasts that title.
  `prioritySpeaker` is PRIORITY_SPEAKER in the call's channel. The dock's push to talk button (`PushToTalkButton`,
  the reference's `PTTButton`) replaces the mute button and follows the chat chip. Pressing it while deafened or
  muted undeafens or unmutes first, as the reference's does. A GH manual gesture activates on touch down, so the
  dock, PIP and sheet pans that wait for their slop are cancelled. The reference does the same with a manually
  activated pan and a panel lock. Ours lets go on lift or when the finger leaves the button. Press and release
  play HapticUtils' IMPACT_MEDIUM (`effectTick`, our `IsocordHaptics` with CONTEXT_CLICK). The reference
  vibrates on press only.
- **Settings screen** (Settings > Voice & Video, `settings/voiceConfig.tsx`, SettingsVoiceScreen). The threshold
  slider sits over a live meter (`VoiceSensitivity`). The meter turns `setInputLevelReporting` on while it shows,
  only with RECORD_AUDIO already granted. The automatic meter fills from our own `speaking` events, so only in a
  call. Input volume is ours: the reference's mobile settings have none.
- **Notices.** `microphoneStopped` with `busy` toasts (own copy, no Discord string) until `microphoneResumed`.
  `permission` and `error` toast through their `error` event. `noiseSuppressionTier` with `slow` shows
  `presentNoiseCancellationError`'s toast. `sampleRate` only logs.
- **Meter.** `setInputLevelReporting(true)` emits `inputLevel` (dBFS, peak of 10 frames, about 10 a second, floored
  at -100). Outside a call it creates the media kit and records through `JavaAudioDeviceModule.requestStartRecording`.
  The ADM counts our request and the call's apart, so turning the meter off never closes a call's mic.
- Remote speaking rings: from op 5 only.

### 4.2 Noise suppression

Setting: off / standard / enhanced (`InputMode.noiseSuppression`). Standard is the reference's `noiseSuppression`,
enhanced its `noiseCancellation` (Krisp), which is on by default. Enhanced turns standard NS off and runs RNNoise.

**Hook.** `org.webrtc.ExternalAudioProcessingFactory` (webrtc-sdk) builds the APM with a `CustomProcessing` capture
post-processor. It runs after AEC, NS, AGC2 and the post filter, before the encoder
(`audio_processing_impl.cc`). The AAR exposes it only as a Java interface, `AudioProcessing.process(numBands,
numFrames, ByteBuffer)`, with channel 0 of one 10 ms frame as floats on the 16-bit scale. So there is no vtable to
mirror. `CaptureProcessor` passes the direct buffer to `NativeAudio.process`, which runs RNNoise in place and applies
the input gain. That is one JNI round trip per frame until our own libwebrtc build (8.1) runs it natively.

- The factory is a process singleton: its native APM is one, and `destroy()` frees it without clearing the pointer.
  Each `PeerConnectionFactory` takes a reference to the same APM.
- **Rate.** RNNoise takes 480 samples at 48 kHz. WebRTC processes capture at 48 kHz whenever the ADM runs at 44.1 or
  48 kHz (`InitializeCaptureFrame`, `SuitableProcessRate`). Any other frame size stops RNNoise for the call
  (`sampleRate`).
- **Budget.** `CaptureProcessor` times RNNoise per frame, averaged over 1 s windows, and logs the first average. Above
  30 % of the frame (3 ms) it stops RNNoise for the call (`slow`).
- **Step down.** Either reason turns enhanced into standard for the rest of the call: the track gets WebRTC's NS back
  and JS gets `noiseSuppressionTier`. The next call tries RNNoise again.
- **Build.** `vendor/rnnoise/fetch.sh` pins commit `70f1d256` and the model archive by SHA-256.
  `cpp/audio/CMakeLists.txt` compiles the library sources with configure's defaults (`DISABLE_DEBUG_FLOAT`, int8
  weights) for arm64-v8a, armeabi-v7a (NEON) and x86_64 (SSE4.1). The model makes the library about 3.6 MB per ABI.
- Later tiers: GTCRN or DeepFilterNet3 above RNNoise, measured on the real phone and an ARMv7 one, and a remembered
  per-device tier.

| Model | License | Rate | Size, cost | Notes |
|---|---|---|---|---|
| WebRTC NS | BSD | any | none extra | Classical. Always there |
| RNNoise (Xiph) | BSD-3 | 48 kHz | small, one core | Plain C, runs on any ARMv7. Good on steady noise, weaker on bursts. PESQ-WB 2.33 |
| GTCRN | MIT | 16 kHz | 48 k params, 33 MMAC/s | Very cheap, better than RNNoise (PESQ-WB 2.87). 16 kHz: run on the low band, apply its gain to the high bands |
| DeepFilterNet3 | MIT or Apache-2.0 | 48 kHz | 2.1 M params | Best quality here (PESQ-WB 3.16). Needs a recent CPU, adds about 40 ms. Rust (libDF, tract) |

The reference uses Krisp (closed, not an option).

### 4.3 The rest
- **Processing toggles.** `AudioTrack.setAudioProcessingOptions` (webrtc-sdk) with automatic mode. Senders apply a
  change mid-call, with no new source or track.
  - Echo cancellation: the platform's AEC where the device has one, else WebRTC's.
  - Noise suppression (standard): the platform's NS where present, else WebRTC's. Off in enhanced and off.
  - Automatic gain control: WebRTC's. Android has no platform AGC on this path.
  - High-pass filter: always on, WebRTC's default. The reference has no setting.
  - The meter's own recording applies the platform AEC and NS when it starts. It runs only outside a call: in a
    call the meter reads the call's capture. A recording request held while the call's recording stops leaves the
    record thread running on a cleared buffer, and its next frame aborts the process (webrtc-sdk m150
    `stopRecordingIfNeededImpl`, `AudioRecordJni::StopRecording`). So `beginCall` drops the request, and
    `endCall` takes it again after the peers are disposed.
- **Sample rate.** The call's audio module records and plays at 48 kHz (`setSampleRate`), RNNoise's rate.
  AudioRecord resamples a device that reports 16 or 8 kHz. Another processing rate still steps RNNoise down.
- **Remote speaking** (`rtc/RemoteSpeaking.kt`). Reference: the native engine's `user-speaking` callback. Op 5 only
  maps the SSRC there (RTCConnection `_handleSpeaking`), and Discord sends no op 5 when a burst ends. Ours: op 5
  starts a user's speaking. `getStats` every 200 ms counts received audio packets per SSRC. New packets start or
  keep speaking, 400 ms without any end it. The reference's own timeout is in its native engine, unread.
- **Mute.** Inactive sender encoding (mic closed). **Deafen** mutes ADM playout and implies mute.
  **Server mute/deaf** and **stage suppression** are enforced the same way.
- **Volumes.** Amplitudes from 0 to 200, 100 is unity, as the reference stores them (`perceptualToAmplitude`, 200
  perceptual is about 200). Input volume is a gain after processing, in the capture hook. Output volume and each
  user's volume and local mute (per context, as `localVolumes` are) multiply into the remote track's
  `AudioTrack.setVolume`. A user's track gets it again when they get a receive section.
- **Mic failures.** The ADM's errors emit `error` (kind `microphone`) and `microphoneStopped`: `permission` when
  RECORD_AUDIO is missing, `busy` when the recorder won't enter the recording state, else `error`. Android 10 and
  later silences a client that loses the mic instead, so 2 s of all-zero frames also reports `busy`.
  `microphoneResumed` follows the next frame with sound. Unmuting restarts the send stream, which retries the
  recorder. Whether the reference retries on its own is unchecked: RDX had no instance open.
- **Routing.** In a Telecom call, Telecom's `CallEndpointCompat` endpoints only. No `setCommunicationDevice` or SCO
  calls of our own (Android docs: they break Telecom calls). A call without Telecom routes itself (6.5). Audio goes
  out as `STREAM_VOICE_CALL`.
- **Device pickers** (`voice/devices/`, Voice & Video settings). The reference's output button is
  VoicePanelVoiceControls' AudioRouteButton ("Change Audio Output") in the panel's settings drawer. Ours has no
  drawer and the gear opens Voice & Video, so the row sits in its Output section. Its sheet copies
  VoicePanelAudioOutputActionSheet: "Select Audio Output", a "This Phone" radio group, CallsUtils'
  `getAudioDeviceToDisplayText` labels ("Bluetooth LE" for TYPE_BLE_HEADSET) with the device name under them, and
  a pick closes it. Icons: `VoiceNormalIcon` for the speaker, `MobilePhoneIcon` for the earpiece (its
  `voice_bar_*` images), `HeadphonesIcon` for Bluetooth (no Mana glyph) and wired (the reference reuses the
  speaker glyph). In a call it lists the call's endpoints, outside one the phone's outputs (`audioDevices`).
  Left out: the External Device section (game consoles).
  - The mic picker is ours: the reference has none on mobile. Same sheet, titled "Microphone", Default first.
    `AudioDevices` hands the pick to `JavaAudioDeviceModule.setPreferredInputDevice`. Explicit AudioRecord
    routing outranks the communication device that Telecom or `CallAudio` sets, so a built-in mic stays in use
    beside a Bluetooth headset. A Bluetooth mic needs the headset's SCO link, which runs only while the call
    plays to it: picking one in a call also routes the output there.
  - Remembered devices (ours). The voice settings keep the last pick per direction (`inputDevice`,
    `outputDevice`) as kind, name and address. `setPreferredDevices` sends them. Built-in devices match by kind,
    others by name, and by address when both sides know it (Telecom endpoints have none). The input applies
    whenever it is connected, to the call and to the meter. The output is requested once per call as it
    appears: in the first endpoints, or when it connects. An absent device leaves the system's choice.

## 5. Video and Go Live

### 5.1 Video
- Encoder: hardware first, software VP8. Announce `encode: false` for codecs without an encoder (the server then
  picks a codec everyone can send).
- **Layers** (`VideoLayers.kt`). IDENTIFY announces the camera's layers rid `100` (quality 100) and rid `50`
  (quality 50), Go Live's one layer rid `100` (reference `getVideoStreamParameters`). READY `streams` assigns each
  its SSRC and RTX SSRC. Without it the first layer takes audio SSRC + 1 and + 2 (`_handleReady`). The audio SSRC
  is READY's too. libwebrtc sends with the SSRCs of the local description, so `VoiceSdp.assignSsrcs` writes the
  assigned ones into every offer.
- **One sender per layer.** Discord's answer has no RID header extension and libwebrtc can't set an SSRC on an
  RID encoding, so the low layer is a second sendonly video section on the same track, at half size and a quarter
  of the bitrate. Each layer has one `RtpParameters` encoding, found by its rid. DAVE gets the codec for every
  layer's SSRC. Op 12 lists each layer with `active`, the real `max_resolution` and `max_bitrate`.
- **Incoming op 15** (the server's wants for our SSRCs, `IncomingWants`). An entry applies even at 0, a missing
  one takes `any`, no `any` means 100. 0 makes the layer's encoding inactive: nothing is sent and the camera stays on.
  Other values pick a size from the ladder (`VideoLadder.kt`, reconstructed from `MediaSinkWantsLadder`: 1280x720
  at 100, then one 16:9 step per 10 down) and scale the bitrate cap by its share of the 720p budget
  (cap 2.5 Mbps, floor 150 kbps). The low layer stays within 640x360. Mode full keeps 720p. A Go Live layer scales
  its bitrate and size by the viewer's `pixelCounts` (`getGoliveQuality`, which scales only the bitrate).
- **Outgoing op 15** (`SinkWants`). Starts at `any: 100`. JS sets a quality per user. Native finds the user's SSRCs
  from op 12, and sends only changes. A user with two layers gets the better one above quality 50, else the lower
  one, 0 on the rest (the reference picks by selected participant). Pixel counts go on the chosen SSRC.
- **Camera.** The remembered camera, else front (`Cameras.kt`). Camera2's cameras: front, back (each lens
  Camera2 exposes on its own, numbered), and USB (`LENS_FACING_EXTERNAL`, named by `INFO_VERSION` where set).
  Identity is id, facing and name: a USB camera found by name when its id changed. The panel header's switch takes
  the next camera (VoicePanelHeader: the first that isn't the current one) and JS remembers it. Holding the camera
  chip lists every camera (our own: the reference only flips), and so does Voice & Video's Camera row. A switch
  is `CameraVideoCapturer.switchCamera(handler, id)`: same track, no renegotiation. A USB camera unplugged mid-call
  moves to the default camera on a new capturer (the old one stops itself on the disconnect), not `cameraStopped`.
  Only the front camera's preview is mirrored. `Camera2Capturer` tags every frame with its rotation (sensor,
  display and mirror, computed per frame), so remote viewers see us upright in any orientation the activity
  follows. `CameraEventsHandler` failures (another app took the camera, an error, a freeze) turn video off
  cleanly: op 12 inactive, an `error` event of kind `camera`, then `cameraStopped`. JS clears `selfVideo` and sends
  op 4 with `self_video: false`. Android stops background camera access unless the camera FGS type started in front.
- Channel video limit: `useChannelVideoLimit` (reference) hides the camera button past it.
- **Video view** (`video/VideoView.kt`). A `TextureView` fed by webrtc's `EglRenderer` on its `SurfaceTexture`, as
  `SurfaceEglRenderer` feeds `SurfaceViewRenderer`. Stock webrtc has no TextureView renderer. A SurfaceView recreates
  or resizes its surface on every frame of a size animation and shows black meanwhile. The TextureView keeps its
  buffer at the frame's rotated size and scales it into the view with `setTransform`: `contain` fits it whole,
  `cover` fills and the view's bounds crop. A size animation only changes the transform, so the last frame stays on
  screen, and React's transforms, opacity and clipping apply. `mirror` is the renderer's own flip.
  - The renderer and the track's sink (`CallEngine.attach`) live from the first attach until React drops the view
    (`onDropViewInstance`). React detaches and reattaches a view it moves. The texture and its EGL surface outlive
    the move (`onSurfaceTextureDestroyed` keeps it, `setSurfaceTexture` puts it back): a new texture was blank until
    the track's next frame.
  - A new frame size takes its transform in the draw that latches it (`onSurfaceTextureUpdated` runs before
    TextureView applies the transform). The size used to arrive by a post, so a frame could draw a draw late at
    the old aspect, or a new view's first frame stretched. A view resize applies in `onSizeChanged`, the same draw.
  - Swap interval 0 on each new surface puts the texture's queue in async mode. A TextureView that isn't drawn
    consumes no frames, so a blocking swap held a frame on the render thread. The camera or decoder behind every
    view of that track then stalled: black views and a stream card that never loads.
  - A newly shown view stays empty until its track's next frame. A static screen share may send few.
  - `paused` keeps the last frame and drops new ones (`EglRenderer.pauseVideo`), with the sink still attached. The
    grid's views pause once a focused video has grown over the whole grid, and resume as it shrinks.
  - Views stay mounted through the dock's open, close and drags. The panel body keeps its open size and the card
    clips it, so no view resizes then. Unmounting them for the animation (the old `videoReady` gate) dropped their
    sink wants to 0. The server stopped sending, and remounted views waited for a keyframe: black cameras and a
    stream card that never loaded.
  - Sink wants key a tile and the focused view apart (`shownKey`), whatever their quality. The watched stream's
    tile and its focused view once shared a key, so closing the focus deleted the tile's entry. The stream's wants
    fell to 0 and the next focus stayed black.
  - The focused frame is opaque (panel colour under the tile colour, black for a stream). The tile colour is
    translucent, so the cover-cropped tile and its label showed through around the contained video. Grid cards
    have the same opaque underlay.

### 5.2 Go Live
- Op 18 STREAM_CREATE `{type, guild_id, channel_id, preferred_region}`, then STREAM_CREATE and
  STREAM_SERVER_UPDATE dispatches, then a second `RtcConnection` with context STREAM.
- A streamer ending and restarting sends STREAM_DELETE, then a new STREAM_CREATE and STREAM_SERVER_UPDATE.
  Watchers tear down on the delete and connect again on the new update. A repeated update with the same
  endpoint and token is ignored.
- MediaProjection consent per stream (Android 14+ forbids reusing it). `MediaProjection.Callback.onStop`
  (system "Stop sharing" chip) ends the stream: op 19 STREAM_DELETE.
- Watching: one stream at a time on mobile (reference STREAM_WATCH ends other watches).
- Our own stream's extras live in `voice/stream/`. `OwnStream` holds them for the stream's `RtcConnection`.

**Quality presets** (`StreamPresets.kt`, the Kotlin facts file).
- Copied from the reference: `ApplicationStreamResolutions`, `ApplicationStreamFPS`, `ApplicationStreamPresets`,
  the settings per preset (`getApplicationStreamPresetValues`) and the Nitro and boost requirements
  (`ApplicationStreamSettingRequirements`). JS gets both tables as JSON in `getConstants().streamPresets` and
  decides what the user may pick (`canStreamWithSettings`, `canUseStreamSetting`).
- `connect` takes `streamResolution` and `streamFramerate` for our own stream. Missing or unknown values fall back
  to 720p30 (MediaEngineStore's default).
- A height stands for a landscape box: 4:3 up to 480, 16:9 above (native `Connection.setGoLiveSource`). Capture
  fits the screen into the box turned like the screen, never upscaled. 0 is the source size.
- Bitrate cap 3.5 Mbps (`defaultVideoQualityOptions.desktopBitrate.max`). The reference's `calcMaxBitrateFunc`
  returns null outside experiments. The frame rate caps capture and the encoding. A viewer's pixel count still
  scales the bitrate (5.1), with the bit floor at the stream's frame rate.
- Op 12 announces the preset's box as `max_resolution` (`setDesktopEncodingOptions`), `source` with 0 by 0 for the
  source size, not the capture size. A rotation therefore sends no new op 12.

**Rotation.** `ScreenWatcher` listens to the default display. A new real size calls
`ScreenCapturerAndroid.changeCaptureFormat` with the size for the new orientation, and the layer's encoding
follows. From Android 12 the capturer resizes its virtual display in place. Older versions make a new one,
which their projections allow.

**Paused stream** (op 22). The reference's native engine reports a `video_state` of paused or playing. Its mobile
JS has `setStreamPaused` but no caller. Ours: paused while the screen is not on (`Display.STATE_ON`), or while the
captured app is hidden (`onCapturedContentVisibilityChanged`, Android 14+ single app capture). A static screen
sends no frames, so frame gaps are not a pause. `RtcListener.onStreamPaused` reports changes, and JS sends op 22
`{stream_key, paused}`.

**Previews.** The reference fits the window into 512 by 288 (`min(512 / w, 288 / h)`), asks the engine for a
JPEG 15 s after going live and then every 300 s, and posts it as a data URI to `POST /streams/{key}/preview`
(`VoiceEngineStreamingManager`, `setBroadcastThumbnailCallback`). A failed post retries after 60 s.
- `StreamPreview` is a `VideoSink` on our screen track. It keeps the latest frame scaled to that box as I420, at
  most one refresh per 5 s. A static screen sends no frames, so waiting for the next one could hang.
- `RtcConnection.captureStreamPreview()` encodes it as a JPEG at quality 80. The reference's quality lives in its
  closed native engine, so 80 is ours. JS schedules, encodes the data URI and uploads
  (`voice/goLive/streamPreviewUpload.ts`). The schedule starts when our stream's connection reports `connected`.
  "Hide Stream Previews" skips each upload. The reference syncs it to the account. Isocord keeps it on the device.
- **Stream Settings sheet** (`voice/goLive/GoLiveSheet.tsx`, MobileGoLiveActionSheet). Screen share opens it before
  the consent: Default, Performance and High Quality, and Share App Audio. A mode is locked unless one of its
  settings passes `canStreamWithSettings` for our `premium_type` and the guild's `premium_tier`. The reference asks
  the premium SKUs. Ours is their documented tiers: Nitro for source, Nitro or Classic for 1080p and 60 fps. A locked
  pick toasts the upsell line. The own stream's `connect` carries the preset's best allowed setting and
  `soundshare`. The mode can't change mid-stream: our quality is fixed at connect.

**App audio (soundshare).** API 29+, on unless `connect` says `soundshare: false` (reference
`soundshareEnabled`, on by default).
- The problem: a `PeerConnectionFactory` sends its audio device module's one recording on every audio source.
  The shared module records the microphone, so the stream needs its own factory and module.
- Options looked at:
  - A second `JavaAudioDeviceModule` that records the microphone, its buffers overwritten by an
    `AudioBufferCallback` (the spike harness). Opens a second microphone `AudioRecord`: the privacy indicator
    stays on while muted, and Android may silence one of the two records.
  - A custom native audio device module or audio source. Needs C++ against libwebrtc's ABI, which our vtable
    mirroring already shows is fragile (8.1).
  - Mixing app audio into the microphone (LiveKit's `MixerAudioBufferCallback`). Sends it on the voice
    connection: wrong connection, wrong flag, and mute would cut it.
- Chosen: `StreamMedia`, a second factory and `JavaAudioDeviceModule` for our own stream only, with
  `setAudioRecordEnabled(false)`. That is the webrtc-sdk fork's "recordingless" mode: no `AudioRecord` is opened,
  but the record thread still runs and calls `AudioBufferCallback.onBuffer` for each 10 ms buffer. `AppAudio`
  fills it with a blocking read from an `AudioPlaybackCaptureConfiguration` record, which also paces the thread.
- The playback capture uses the screen capture's own `MediaProjection` (`ScreenCapturerAndroid.getMediaProjection`).
  Android 14 allows one projection per consent.
- Captured usages: media, game, unknown, which is all Android allows. Our own app is excluded. Voice calls are
  never capturable. Apps that disallow capture come through as silence, as expected.
- 48 kHz stereo into the module. Discord's answer has no `stereo=1`, so Opus encodes it as mono. The track's
  processing is off (no AEC, NS, AGC or high-pass filter: it is music, not a voice).
- The audio encoding is active only while app audio runs. The DAVE encryptor's voice gate opens for the stream,
  and its SSRC already has Opus assigned, so DAVE encrypts it like any audio. Op 5 goes out once with the
  SOUNDSHARE flag (2), and with 0 when the capture stops.
- Trade-offs: a second factory and its threads while we stream, and a second video encoder factory. The own
  stream is never rebuilt (its consent was used once), so the module lives as long as the connection. API 28 and
  below use the shared factory and send no app audio. The second module may open a silent playback track,
  since the own stream's peer has receive sections.

### 5.3 DAVE
- Spike code as is: join, epoch transitions, commits, passthrough while transitioning.
- Phase 5: privacy code and per-user verification (reference `SecureFrames*`).

## 6. Calls, reliability and the system

### 6.1 Main gateway
- RESUMED: nothing to do.
- Fresh IDENTIFY (new `session_id`): the old voice state died with the old session. Re-send op 4 for the same
  channel and reconnect through the usual voice state and server pairing (reference
  `GatewayConnectionStore._handleConnectionOpen`, a forced `localVoiceState.update`). Not after a crash or restart.

### 6.2 Voice gateway
- Resume on close unless the code is final (4004, 4006, 4011, 4015) or after 3 fails (spike, verified).
- Full reconnect after a failed resume: for 4006/4009 (session invalid or timed out) send op 4 again for a new
  VOICE_SERVER_UPDATE. For 4015 (server crash) wait for the new VOICE_SERVER_UPDATE the gateway sends.
- VOICE_SERVER_UPDATE mid-call (server migration): close the connection and connect to the new endpoint.
- **Media path recovery** (`ConnectionRecovery.kt`, `NetworkWatcher.kt`). The `webrtc` protocol has no ICE
  restart message (docs.discord.food, Voice Connections: resume or the whole connecting flow). The official native
  engine is closed. Its JS layer shows the rest:
  - `RTCConnection.reconnect`: a media connection that drops after connecting (`RTC_DISCONNECTED`) closes the
    control socket at once and opens it again with a fresh Identify on the same endpoint, token and session. No op 4.
    A new media handshake follows. `_scheduleReconnect` retries it with a backoff, also on `NO_ROUTE`, where op 32
    is sent once.
  - `_handleNetworkOnline`: an expedited heartbeat with a 5 s ack timeout, which resumes a dead socket
    (`RTCControlSocket.expeditedHeartbeat`). `_handleResuming` calls `fastUdpReconnect`.
  - `sfu_update` (op 33) only retargets the UDP protocol's endpoint. It is ignored for `webrtc`.

  Ours, on a peer `failed`, a peer `disconnected` for 3 s, or a new default network (or a new address on it):
  1. `reconnecting` goes to JS. A network change also sends a `networkChanged` event, and JS gives the main
     gateway an expedited heartbeat (GatewaySocketSingleton's online callback, `networkStateChange` 5000 ms), or
     runs its waiting reconnect now.
  2. A network change waits 1 s, so a flapping network starts one recovery. A new network's first addresses don't
     count as a second change.
  3. Full reconnect at once, then once more after 1 s, 15 s each: close the gateway and the peer, Identify again,
     redo the handshake and a fresh DAVE session (the server adds us to the MLS group again). The camera restarts by
     itself. The old path on a dead network is never waited for: libwebrtc takes 10 s or more to call it failed.
  4. Our own Go Live stream can't reconnect, its screen consent was used once. It tries an ICE restart instead: wait
     for a healthy voice gateway (an expedited heartbeat resumes a dead one), `restartIce()`, a new offer and a
     Select Protocol with fresh ICE credentials, 8 s to reach `connected`. Whether the server accepts a second
     Select Protocol is not documented.
  5. `disconnected` with the close code, then JS rejoins with op 4.
  Offline, each step waits up to 30 s for a network. Close codes 4014, 4021 and 4022 (docs.discord.food) skip
  recovery with the other final codes.

### 6.3 Process
- The foreground service keeps the process. If Android kills it anyway, the voice state dies with the socket. On
  the next launch don't auto-rejoin (the reference doesn't).
- Activity recreation (density change, rotation): the engine is process-scoped, views re-attach to tracks.
- Back with nothing left to close moves the task behind (`MainActivity.rootBackCallback`), as Android 12+ does for
  a root activity and the reference gets by turning RN's callback off (`BackPressManager`). React Native's own
  fallback finished the activity: the React tree unmounted, the last `SessionProvider` disposed the session, and
  the voice feature's cleanup left the call.
- The activity can still finish in a call (swiped from recents, killed by the system). The session then stays
  while the gateway holds a call (`releaseSession`), and the next mount picks it up again.

### 6.4 Telecom for every call

Every call, guild voice included, is a Telecom call. The reference does the same: its `TelecomManager.android`
tracks whatever `RTCConnectionStore` is connected to, guild or not.

Reference native side (RDX, Discord 352.0):
- `com.discord.telecom.service.TelecomConnectionService` (raw `ConnectionService`, `MANAGE_OWN_CALLS`).
- One `com.discord.foreground_service.ForegroundService`, types `dataSync|mediaProjection|camera|microphone`.
- `com.discord.notifications.renderer.IncomingCallActivity`, shown on the lock screen (`USE_FULL_SCREEN_INTENT`).
- `com.discord.notifications.actions.NotificationActions` receiver for notification buttons.

Ours, with Jetpack `androidx.core:core-telecom` (`CallsManager`), which wraps `ConnectionService` below
Android 14 and uses foreground service types from 14:
- `CallService`: a `LifecycleService` hosting `CallsManager`. Types `phoneCall|microphone|camera|mediaProjection`,
  camera and mediaProjection added only while they run.
- `addCall` with `CallAttributesCompat`: display name is the channel, address an `isocord:` URI of the channel,
  outgoing for joins, incoming for rings. `setActive` once connected.
- Callbacks `onAnswer`, `onDisconnect`, `onSetActive`, `onSetInactive` come from headsets, watches, Android Auto
  and the system. Each must finish within 5 s. Hold (a cellular call) mutes us and stops playback.
- Notification: `NotificationCompat.CallStyle` within 5 s of `addCall`. `forOngoingCall` with a hang-up action,
  plus mute and deafen actions. Icons change for muted, deafened, streaming. Tap opens the panel. Strings by hash
  from the reference's `VoiceNotificationManager.android`.
- Incoming ring (built, untested): `IncomingCalls` (`telecom/`). The reference's phone path is a push (`CALL_RING`) that
  starts its native `IncomingCallActivity`. Its JS `TelecomManager` reports incoming calls to Telecom on Meta Quest only
  and skips a ring while in a call. Ours has no push, so the gateway rings:
  - `SessionNotifier.onCall` (background session, or the app's forwarded one) reads the users from `ongoing_rings`
    (the reference) or `ringing` (docs.discord.food). Ours in the list rings, unless DND, muted or calls are off.
  - `CallTelecom.ring` adds a `DIRECTION_INCOMING` Telecom call (`onAnswer` from a headset or the system answers).
    No service: the ring's notification is not a foreground one, and the microphone type is refused from the
    background. `RingNotification` posts `CallStyle.forIncomingCall` on the `calls` channel (ringtone, insistent,
    60 s) with a full-screen intent to `CallActivity`. Answer is an activity intent, decline a broadcast.
  - The app in front starts `CallActivity` directly: Android only shows a heads-up for a full-screen intent then.
  - Answer: `CallTelecom.answerRing`, then the app opens on `isocord://call/<channel>` (`Links.call`). It joins and its
    `beginCall` finds the answered call and adopts it (`CallTelecom.begin`), then starts the service. A ring answered
    and not joined within 45 s is dropped.
  - Decline: `POST call/stop-ringing` from Kotlin (`DiscordRest`), as `DismissCallAction` does.
  - Android 14: `USE_FULL_SCREEN_INTENT` is declared. `RingNotification.canUseFullScreenIntent` says whether the
    user allowed it. Without it the ring is a heads-up. `fullScreenIntentSettings` opens the page. Nothing asks yet.
- Audio endpoints: `availableEndpoints`, `currentCallEndpoint`, `requestEndpointChange`.
- A call with `CallDetails.telecom: false` skips all of this (6.5).
- Mute from a headset or the system: `isMuted` flow drives `setSelfMute`.
- Call log: off (guild voice isn't a phone call). Check `CallAttributesCompat` options.
- Android 7 to 7.1 (API 24 to 25, below core-telecom's 26): a plain foreground service of types
  `microphone|camera|mediaProjection`, `AudioManager` routing (`CallAudio`, 6.5), the same notification without
  CallStyle.

### 6.5 Calls without Telecom

A self-managed Telecom call keeps other apps from recording while it lasts. A setting lets the user run calls
without it: JS passes `telecom: false` in `beginCall`, from the "Use Android call integration" setting (Isocord's
own, default on). It applies from the next call. Below API 26 every call runs
this way.
- `CallTelecom.begin` starts `CallService` and `CallAudio` instead of adding a Telecom call.
- Service types `microphone`, plus `camera` and `mediaProjection` while they run, as the reference's
  `ForegroundService`. No `phoneCall`: Android 14 allows it with `MANAGE_OWN_CALLS`, but it stands for a Telecom
  call, and core-telecom is what asks for it. Same CallStyle notification and buttons.
- Audio (`CallAudio`). Reference: `AudioManagerStore.android` turns `setCommunicationModeOn` on while connected and
  off after. Ours: on at `beginCall`, off at `endCall`. `MODE_IN_COMMUNICATION`, then `MODE_NORMAL`.
- Output (`AudioRoutes`), as the reference's `AudioManagerModule`, which picks by API level:
  - API 33+ (`CommunicationRoutes`, reference `DiscordAudioManager2`): `availableCommunicationDevices` and
    `setCommunicationDevice`. Endpoint ids are `AudioDeviceInfo` ids. The current one is `communicationDevice`.
  - Below 33 (`LegacyRoutes`, reference `DiscordAudioManager`): speakerphone and Bluetooth SCO switches. One
    endpoint per kind, its id the kind. SCO is retried 4 times (`setSCORetryCount(4)`), then it falls back.
  - Default: the user's last pick in this process if still there, else Bluetooth, wired, then the speaker. The
    reference starts on the speaker, not the earpiece. A headset that connects takes over while the user has picked
    nothing.
  - Kinds from `audioDeviceTypeToSimpleMapping`. Left out: outputs it files under earpiece (HDMI, dock, line out),
    BLE speaker and broadcast.
- Audio focus. The reference requests none for calls: Telecom holds it. Ours requests `AUDIOFOCUS_GAIN` for voice
  communication. A transient loss (a cellular call, ringing included, or an assistant) holds the call like
  Telecom's `onSetInactive`: no sending, no playback. Regaining focus resumes it and sets the mode again. A lasting
  loss (media, another call app) and ducking leave the call going, since the user chose to share audio.
- An answered ring always rings through Telecom. If the app then begins the call with `telecom: false`, `begin`
  detaches the ring's Telecom call (its callbacks stop reaching the call), disconnects it, and starts `CallAudio`
  once Telecom's teardown is done, since Telecom resets the audio mode as it ends.
- Not available without Telecom: headset and watch buttons, the system mute, hold from Telecom.

## 7. Known pitfalls (from the spike)

1. `PeerConnection.getTransceivers()`/`getSenders()` dispose the wrappers they returned before, including senders
   we hold. Crashed on undeafen once a remote user spoke. Keep the `addTransceiver` results.
2. `self_mute`/`self_deaf` are only flags. The client must stop sending and playing itself.
3. A trackless sender still sends silence. Use an inactive encoding.
4. PT 96 is reserved for Discord's probes; libwebrtc puts VP8 there. Remap in the offer.
5. Renegotiations must be serialized. Op 12 can arrive before the answer on stream connections.
6. A camera FGS type without a granted CAMERA permission crashes the process. "Only this time" grants lapse.
7. Encrypt "missing key" bursts while alone after someone leaves are harmless (MLS group reset to epoch 1).
8. Any app over ours pauses the JS gateway unless in a call. Discord drops the voice state about 2 minutes later.

## 8. Native dependencies

### 8.1 libwebrtc: our own build, in its own repo

Today: the community AAR `io.github.webrtc-sdk:android:150.7871.08`. Our DAVE shim calls libwebrtc's frame
encryptor interfaces through a copied vtable layout (`webrtc_frame_crypto.h`), which breaks silently on any
libwebrtc version change.

Plan: a separate repository, [PalmDevs/isocord-webrtc](https://github.com/PalmDevs/isocord-webrtc), that only
builds and publishes. Isocord fetches its releases.
- The repo: a pinned commit on `branch-heads/7871` (M150), `webrtc/patches/`, `webrtc/args.gn`, and
  `webrtc/build.sh` around `tools_webrtc/android/build_aar.py`. Also libdave (8.2), since the patches link it in.
  Scaffolded, not yet built.
- WebRTC builds against Chromium's own libc++ (`std::__Cr`). libdave must then build inside the GN build, not as
  the NDK-built archive.
- Patches compile the DAVE frame encryptor/decryptor and the noise suppression `CustomProcessing` into
  `libjingle_peerconnection_so.so`. No vtable mirroring, no JNI per frame.
- GN args drop what Discord doesn't use: data channels (`rtc_enable_sctp=false`), protobuf and the RTC event log,
  software H264/H265, examples and tools. M150 no longer has iLBC. Keep Opus, VP8, VP9, H264 (hardware via MediaCodec),
  AV1 decode.
- ABIs: armeabi-v7a, arm64-v8a, x86_64.
- Releases: the repo's GitHub Actions workflow builds on a tag and attaches the AAR and a SHA-256 to a GitHub
  Release. Isocord pins the tag and hash in Gradle, downloads the AAR into the Gradle cache and checks the hash.
  Nobody building Isocord needs the WebRTC toolchain.
- The checkout is large (tens of GB with depot_tools and the NDK). On standard runners free disk first
  (`jlumbroso/free-disk-space`). Expect one to two hours per build. A larger runner or a self-hosted one if it
  doesn't fit.

### 8.2 libdave
- Today `vendor/dave/build.sh`, pinned commits, ABIs armeabi-v7a, arm64-v8a, x86_64.
- `dave/build.sh` in isocord-webrtc, released as `libdave-android.tar.gz` (headers and static libraries per
  ABI). Isocord can fetch it now, in place of `vendor/dave/`.
- Builds into libwebrtc once the DAVE patches land (8.1). The archive and `libisocord_dave.so` go away then.

## 9. Rules from Discord state

- Permissions (`can()`): CONNECT to join, SPEAK to unmute (else join muted, the button disabled), USE_VAD (else
  PTT), STREAM for camera and Go Live, PRIORITY_SPEAKER (flag 4 when PTT-priority), MOVE_MEMBERS bypasses the
  user limit. Moderator actions (MUTE_MEMBERS, DEAFEN_MEMBERS, MOVE_MEMBERS, disconnect) in the participant sheet.
- User limit: `user_limit` vs voice states in the channel (`useIsVoiceChannelFull`). Full: alert, no join.
- AFK channel: the server moves idle users there. How the client treats it (forced mute?) is still to check.
- Region: `rtc_region` is the server's choice. Pass `preferred_region` for streams.
- Video quality mode (`video_quality_mode`): full means don't scale down for bandwidth.

## 10. Edge cases

**Tested** = seen working on the emulator against real clients. **Untested** = implemented in the spike but not
exercised. **Missing** = not built.

### Connection
| Case | Status | Notes |
|---|---|---|
| Join, leave, two-way voice with DAVE | Tested | |
| Voice socket drop, resume (op 7) | Tested | One forced drop, resumed on attempt 1 |
| Resume fails 3 times or final close code | Untested | A non-final code goes to the full reconnect (6.2) first. Then JS re-sends op 4 up to 3 times (not after 4004, 4011) |
| VOICE_SERVER_UPDATE mid-call (migration, 4015) | Missing | |
| VOICE_SERVER_UPDATE with `endpoint: null` | Untested | Spike ignores it, never seen |
| Main gateway fresh IDENTIFY during a call | Missing | Reference tears down; rejoin rule to confirm |
| Main gateway resume during a call | Untested | Should be a no-op |
| Network switch Wi-Fi to mobile | Untested | `NetworkWatcher`, then a full reconnect at once (6.2). Main gateway gets an expedited heartbeat |
| Peer `failed` with the socket alive | Untested | Same recovery. `reconnecting` until it ends |
| Airplane mode, then back | Untested | Recovery waits up to 30 s per step for a network |
| Moved to another channel by a moderator | Untested | |
| Disconnected by a moderator, kicked, banned | Untested | `channel_id: null` for our session tears down |
| Joined from another device (session takeover) | Untested | |
| Channel or guild deleted while in it | Untested | |
| Channel full, missing CONNECT/SPEAK/USE_VAD | Untested | CONNECT, SPEAK and the limit checked. No USE_VAD forces push to talk |
| Account switch or logout in a call | Untested | Leaves on session dispose |
| Two joins in a row (switch channel) | Untested | |
| Streamer ends and restarts while watched | Untested | Likely source of the duplicate STREAM_SERVER_UPDATE seen earlier. Guard written |

### Audio
| Case | Status | Notes |
|---|---|---|
| Mute stops sending, mic closed | Tested | |
| Deafen stops sending and playback | Tested | Measured on the stream connection's playback |
| Unmute/undeafen after a remote user spoke | Tested | Was the getTransceivers crash, fixed |
| Server mute / deaf, stage suppress | Untested | |
| Voice activity, op 5 per burst | Untested | 4.1, encryptor gate. Level measured after processing |
| Push to talk | Untested | 4.1. 20 ms release delay, priority flag 4 |
| Automatic sensitivity | Untested | RNNoise voice probability at 0.5, level fallback |
| Input level meter, in and outside a call | Untested | `inputLevel`. Outside a call it records on its own |
| Remote speaking indicators | Untested | Op 5 starts, received packets per SSRC keep it, 400 ms without ends it |
| Settings meter on while a call ends | Untested | Crashed (SIGABRT in `nativeDataIsRecorded`). The meter's request is now dropped for the call |
| Noise suppression tiers | Untested | 4.2. RNNoise in the capture hook, steps down when slow or not 48 kHz. Built for all three ABIs, never run |
| RNNoise time per frame on the phone and ARMv7 | Untested | Logged once per call: "RNNoise takes N us per frame" |
| EC, NS, AGC toggles mid-call | Untested | 4.3, `setAudioProcessingOptions` |
| Input and output volume | Untested | 4.3 |
| Per-user volume and local mute | Untested | 4.3, per context |
| Speaker / earpiece / wired / Bluetooth routing | Missing | Telecom endpoints. Emulator plays to the host only |
| Cellular call during a voice call (hold) | Missing | Telecom `onSetInactive` |
| Routing without Telecom (6.5) | Untested | `CommunicationRoutes` from API 33, `LegacyRoutes` and SCO retries below |
| Cellular call without Telecom | Untested | Transient focus loss holds, focus gain resumes. Ringing holds too |
| Another app records during a call without Telecom | Untested | The reason for 6.5. Android 10+ silences one of the two recorders |
| Echo on a real phone speaker | Untested | Emulator has no acoustic path. Hardware AEC on |
| Mic taken by another app | Untested | `microphoneStopped` busy: start state mismatch, or 2 s of zeroed frames. `microphoneResumed` after |
| RECORD_AUDIO refused | Untested | `microphoneStopped` permission. Emulator had it granted |

### Video and Go Live
| Case | Status | Notes |
|---|---|---|
| Camera send, receive | Tested | VP8 at 720x1280 |
| H264 negotiation on a real phone | Untested | Emulator has no H264 encoder |
| Front/back switch | Untested | `switchCamera`, no failure event is raised |
| Camera rotation | Untested | Per-frame rotation from Camera2Capturer, no code of ours. Check upright video at the viewer in every orientation |
| Camera in the background | Untested | FGS camera type set, never backgrounded with camera on |
| Camera taken by another app, error, freeze | Untested | `cameraStopped`. Op 12 inactive, JS clears `selfVideo` |
| CAMERA refused / one-time grant lapsed | Tested | Falls back to a microphone-only service |
| Server MEDIA_SINK_WANTS for our video | Untested | 0 makes the layer inactive, other values scale (5.1) |
| Simulcast, server-assigned SSRCs | Untested | Two senders, SSRCs munged into the offer. Whether libwebrtc takes the munged SSRCs is unverified |
| Many video tiles, sink wants per tile | Untested | `sinkWants.ts` sends what the panel shows |
| Video view resized or clipped by an animation | Untested | 5.1 video view. TextureView keeps the last frame and scales it |
| Video view `contain` with bars, `cover` crop, mirror | Cover reported not cropping | 5.1. `setTransform` over a frame-sized buffer. The log's "frame WxH in view WxH, cover" line checks the inputs |
| USB camera plugged in or out mid-call | Untested | 5.1. The pickers update, an unplugged camera falls back to the default |
| More speakers or cameras than receive sections | Untested | Sections grow by 4 audio, 2 video. Guard at 128 per kind |
| `video_quality_mode` full | Untested | `ConnectRequest.videoQualityMode` keeps 720p |
| Go Live send (screen) | Tested | 570x1280, before presets. Preset sizes, frame rates and the 3.5 Mbps cap untested |
| Go Live app audio (soundshare) | Untested | Recordingless second module fed by playback capture (5.2). API 29+ |
| App that disallows capture while streaming | Untested | Expected silence |
| Stream paused (screen off, app hidden) | Untested | `onStreamPaused`, JS sends op 22 |
| Quality presets and Nitro limits | Untested | Native takes `streamResolution`, `streamFramerate`. JS picks from `getConstants().streamPresets` |
| Stop via system "Stop sharing" chip | Untested | `onStop` callback wired to stoplive |
| Consent dialog cancelled | Tested | Came back cancelled once without showing, cause unknown |
| Rotation while streaming | Untested | `ScreenWatcher`, `changeCaptureFormat`. `max_resolution` stays the preset box |
| Stream previews (thumbnail upload) | Untested | Native JPEG from `captureStreamPreview`. Seam and upload not wired yet |
| Watching Go Live with audio | Tested | |
| Streamer ends while watching | Tested | STREAM_DELETE, clean close, in background |
| Watching while backgrounded | Tested | Decoding continued |
| Go Live in a DM call | Missing | |

### Background, system and builds
| Case | Status | Notes |
|---|---|---|
| 5 min in background in a call | Tested | Gateway, voice and stream stayed up |
| 30+ min, Doze, battery saver | Untested | |
| Notifications during a background call | Untested | 3.6 fix in |
| Notification actions (mute, deafen, disconnect) | Untested | |
| Telecom call, CallStyle notification | Untested | 6.4 |
| Headset, watch, Android Auto buttons | Untested | Telecom callbacks |
| Starting a call from the background | Missing | Telecom incoming call path |
| Android 7 to 7.1 without core-telecom | Untested | Plain service fallback, `CallAudio` routing |
| Call without Telecom, service and notification | Untested | 6.5. Microphone type, no phoneCall |
| Ring answered, then joined without Telecom | Untested | 6.5. The ring's Telecom call ends, then `CallAudio` starts |
| Process killed by the system | Missing | |
| Activity recreated in a call | Untested | Engine is per process; views will re-attach |
| Back out to home in a call | Untested | Moves the task behind instead of finishing (6.3) |
| Swiped from recents in a call | Untested | The session stays while in a call (6.3) |
| 16 KB page alignment | Tested | arm64-v8a and x86_64 aligned |
| ARMv7 | Untested | libdave builds and links; nothing run on an ARMv7 device |
| Own libwebrtc build (separate repo) | Missing | 8.1 |
| Call screen, lock screen, screen-off while ringing | Missing | 11.1 |

### DAVE
| Case | Status | Notes |
|---|---|---|
| Join an existing E2EE call | Tested | |
| Member joins and leaves (commits, epochs) | Tested | |
| Downgrade to protocol 0 (a non-DAVE client joins) | Untested | |
| Large calls, commit storms | Untested | |
| Decrypt failures beyond the passthrough window | Untested | |
| Privacy code / verification | Missing | Phase 5 |

### DM and group calls
| Case | Status | Notes |
|---|---|---|
| Start from the DM header | Built, untested | `CallHeaderButton`. Friend or group: join with op 4 (`guild_id` null), then `POST call/ring`, queued until CALL_CREATE (`CALL_ENQUEUE_RING`). A non-friend DM checks `GET call` first |
| Join, hang up | Built, untested | The same button. Op 13 (CALL_CONNECT) when a DM opens lets a running call show as joinable |
| Voice states without a guild | Built | `voiceStates` keeps them under `@me`, from CALL_CREATE (replaces the channel's) and VOICE_STATE_UPDATE. CALL_DELETE clears them |
| Connect | Built | `serverId` is the DM channel id. VOICE_SERVER_UPDATE has no guild |
| Ring, app open or backgrounded | Built, untested | Native, one path: the background session or the forwarded app session sees CALL_CREATE/UPDATE with our id in `ongoing_rings` or `ringing` |
| Answer | Built, untested | Native opens `isocord://call/<channel>`. JS waits for the gateway, sends op 13, joins once the call is known. A stale link never starts a call |
| Decline | Built, untested | Native `POST call/stop-ringing`. A headset or the system declining does the same |
| Ring ends | Built, untested | CALL_UPDATE or CALL_DELETE without us, 60 s timeout, or another call starting |
| Call deleted while we are in it | Built | `leave(session, false)`. An outage (`unavailable`) keeps the call |
| Ring during a call | Ignored | As `TelecomManager.processIncomingRing` |
| Video call from the DM header | Built, untested | `VideoCallHeaderButton`, 1:1 DMs only, hidden in the call (PrivateChannelButtons). ConfirmStartCall, then CAMERA at runtime (a refusal stops silently, as handleStartCall), then start or join and `setVideo(true)` once the call is ours. The reference's VideoGuard "Camera Unavailable" alert is not ported |
| Incoming video call UI | Not in the reference | `IncomingCallActivity` and the Telecom service never mention video. A ring is answered with the camera off |
| Telecom call type | Audio only | The reference's `TelecomConnection` never sets a video state, so ours stays `CALL_TYPE_AUDIO_CALL` |
| DM Go Live, participants on the button | Missing | |

## 11. UI (phases 1 and 2)

All from the reference's `voice_panel` module, styled with our tokens:
- **Channel list.** Voice channel rows list participants (avatar, name, mute/deaf/video/live icons, speaking ring).
  Reference `VoiceOrStageSummaryRow`, `VoiceMemberUser`. Fills the TODO item "voice channel participants".
- **Pre-join** (`voice/prejoin`, reference `VoicePanelPreJoinContent`). The first tap on a voice channel we are
  not in opens a card where the call's dock goes. A second tap on it joins, as Join Voice does. A tap on another
  voice channel switches the card to it. The channel we are in behaves as before. During a call the call waits as
  the PIP, and a tap on the PIP dismisses the card.
  - Contents: the channel and server names, "No one's here yet" when empty (`ChannelInfo`), a preview per stream
    ("{username}'s stream", `VoicePanelStreamPreview` with Watch Stream), then "N People in Voice" (`RoomMembers`,
    20 rows per "Load more"). Rows sort as `SortedVoiceStateStore` does: streamers first, then by name.
  - Rows (`MemberRowItem`): 32 px avatar, name, then badges: one mute or deafen (server deafen, deafen, server mute,
    mute, from `useMuteDeafenIconState`, server ones red), video, and a LIVE tag. The LIVE tag is ours. A tap opens
    the profile.
  - Controls: the disconnected row of `useControlsButtons` (mic, Join Voice filling the rest, chat), then camera,
    screen share and soundboard chips, disabled. The mic sets the flags the join uses.
  - Join Voice opens the reference's alerts when we cannot join: `VoicePanelNoJoinPermissionsAlert` without CONNECT,
    `VoicePanelMaxCapacityAlert` when full (`joinChecks.isChannelFull`).
  - Previews: `GET /streams/{stream_key}/preview?version=<now>` (`useFetchStreamPreview`,
    `ApplicationStreamPreviewStore`), while we may connect or are in the channel. A preview stays fresh 2 minutes.
    A failure retries after `retry_after` on a 429, else 10 s per attempt. A stream with no preview yet is tried 5
    times. READY and a voice state that stops streaming drop it. The reference's "Hide Stream Previews" hides our
    own stream's preview from others, so it does not apply here.
  - Card: the pre-join is a state of the call's card (`panel/dock/VoiceDock`), not a card of its own. It never
    grows. It enters and leaves like an alert (`MODAL_SPRING`, `MODAL_HIDDEN`). A fast swipe down or a drag past half
    its height dismisses it, a list drags it only from its top. Back, a chat sliding in, a pushed screen or selecting
    another server dismisses it too. It reports its height as an overlay inset and releases it as it leaves.
  - Joining morphs the card into the call's dock (the reference's `PreJoinTransitioner` yeets the content while the
    panel changes mode). The card keeps its React key (`useVoiceCards`). Its height springs from the pre-join's to the
    docked card's with `DOCK_MODE_SPRING` (`motion.preJoin` in `dockFrame.ts`). Width and rest are the same. The
    pre-join's contents fade and shrink out while the dock's controls fade and grow in, as in the PIP morph. The
    handle bar is shared and slides down with the card's top edge. The controls cross-fade: the two rows share no
    layout. A call we leave for the new channel exits like an alert, as does any call that ends.
  - Not ported: activities, games, opt-in channels, the blocked and ignored members' sections and warning, the
    NSFW and spoiler alerts.
- **Panel.** Participant cards (`VoicePanelCard`, `fitCardsInGrid`), video tiles (`IsocordVideoView`), stream
  cards with preview (`VoicePanelStreamPreview`), header with channel title (`VoicePanelTitleButton`), controls
  (`VoicePanelVoiceControls`: mic, video, screen share, chat, disconnect), drawer (`VoicePanelControlsDrawer`).
  - Layout (`panel/grid/gridLayout.ts`, `VoicePanelCardLayoutManager`): a grid of cells with 12 px gutters. Up to 6
    cards take the columns and size `fitCardsInGrid` picks, more take 165 px target cards across. Content taller than the area shrinks to fit. One or two
    people get one big square each, a stream with up to two people gets a big stream card. Streams come before
    cameras, a partial last row is centered and the content is centered in the area.
  - Motion (`GridCard`, the card's `AnimatedWrapper`): a card springs to its new frame with LAYOUT_PHYSICS. A
    joining card fades in over 200 ms and grows from 0.8, a leaving one fades, shrinks and sinks a quarter of its
    height. Cards there when the panel opens appear in place.
  - Taps: a camera card or the watched stream grows over the grid. An avatar card, a long press on any card or the
    name opens the profile. The reference's single tap hides the controls and its double tap focuses: ours never hide.
    A tap anywhere on a stream preview watches the stream and focuses it (AnimatedStreamCard). A focused video
    whose camera or stream goes away shrinks back into its tile like a close.
  - A watch ends when the streamer stops streaming or leaves the call (`useEndedStreamWatch`).
  - Header: the camera switch while our camera is on ("Change camera", `switchCamera`).
- **Minimized.** A PIP card over the app (`VoicePanelPIP`) while navigating: the speaker's avatar and the channel
  over mute, deafen and disconnect, its corners nested with the buttons'. It can be dragged and snaps to the corner
  it is let go towards (`calculatePIPPositionFromVelocity`, rounded to a corner; the reference rests anywhere on an
  edge). A docked card dragged down until its bottom edge meets the screen's bottom inset turns into the PIP under
  the finger mid-drag, a manual minimize. The PIP then follows the finger and snaps to a corner on release. Dragged
  back 24 px above the inset (hysteresis) in the same drag, it turns back into the docked card and the minimize is
  undone. Android PiP mode when leaving the
  app during video is a later step (the reference's `MainActivity` supports it).
- **Go Live sheet** (`MobileGoLiveActionSheet`): built, see 5.2.
- **Voice settings** under You: built, see 4.1 (`user_settings/voice`, SettingsVoiceScreen).
- **Profile voice settings** (`UserProfileVoiceSettings`): the profile of someone in our call has a volume slider,
  Stream Volume while we watch them, and local Mute. Kept per account on the device (`voice/localVolumes.ts`) and
  re-sent as each connection opens. The reference syncs them in the `audioContextSettings` user setting.

### 11.1 Call screen

Native (Compose) `CallActivity`, so it works when JS isn't running (a ring that wakes the background session).
Reference `IncomingCallActivity` (layout `incoming_call_screen`):
- Shown on the lock screen and turns the screen on (`setShowWhenLocked`, `setTurnScreenOn`).
- The caller's avatar, 96 sp and round (guild member avatar first, then the user's), with a 32 sp Discord badge
  at its bottom-right.
- The caller's name in 32 sp. Two 16 sp lines below it: the call text and the channel name.
- Decline on the left, accept on the right. Each is a 64 sp round button with a 14 sp label under it.
- Accept dismisses the keyguard (`requestDismissKeyguard`) and opens the app on the call's panel.
- A screen-off broadcast while ringing silences the ringtone and the call keeps ringing (`CallActivity`, a receiver
  registered while it is started). **Assumed**: the reference registers one, and RDX was unavailable to read it.


Built as `voice/callscreen/CallActivity.kt` and `CallScreen.kt` (2026-11-27, untested). Differences from the notes
above, which come from earlier RDX reads of `incoming_call_screen`:
- Colours are the dark theme's tokens as named constants: there is no JS theme when JS is not running.
- The badge is the app's notification glyph on the brand colour, not Discord's logo.
- The name is the caller's (the group's name in a DM with no known caller). The two lines are "Incoming call" and the
  group's name, shown in a group DM only. The decline and accept labels and the buttons' content descriptions
  ("Decline incoming call", "Answer incoming call") come from the notification config strings.
- The ongoing-call mode below is not built.

Our addition: the same screen also serves an ongoing call when opened from the lock screen or the notification,
with mute, deafen, speaker and hang-up in place of answer and decline. The full voice panel stays in JS.
- Strings come from Discord's intl messages by hash, as always.

### 11.2 Mobile voice overlay

The reference (`com.discord.mobile_voice_overlay`, `MobileVoiceOverlayLifecycleManager`) draws a round avatar bubble
over other apps during a call. Ours draws the in-app PIP instead, with the reference's native movement.

What the reference does, and what we copied:
- **Window.** `WindowUtils.createWindowLayoutParams`: `TYPE_APPLICATION_OVERLAY` (`TYPE_PRIORITY_PHONE` before 26),
  wrapped size, `FLAG_NOT_FOCUSABLE | FLAG_NOT_TOUCH_MODAL | FLAG_LAYOUT_NO_LIMITS | FLAG_HARDWARE_ACCELERATED`,
  translucent, top-left gravity. The window itself moves: `LayoutParams.x/y` and `updateViewLayout`. Touches outside
  it reach the app below. Ours adds `fitInsetsTypes = 0` so its coordinates are the screen's.
- **Drag.** `OverlayBubbleWrap.dispatchTouchEvent`: past a movement threshold the bubble intercepts the touch and
  follows the finger, unclamped. Ours uses the system touch slop, and never takes a touch a child keeps with
  `requestDisallowInterceptTouchEvent`.
- **Snap.** `floatBubbleToHorizontalEdge`: on release it springs to the side its centre is on, keeping its height,
  clamped to the allowed area. Springs: stiffness 200, damping 0.75 (`androidx.dynamicanimation`). The reference starts
  them at 50 px/s. Ours starts them at the finger's speed. The area keeps `PIP_WINDOW_OFFSET` from the system bars and
  cutout. The reference lets the round bubble hang past the sides instead. First show: top left, as the reference's
  (0, 0). Later shows in the process: the last rest.
- **Trash.** `OverlayTrashWrap`: a second, untouchable window along the bottom, shown while dragging. A radial shade,
  and a circle with an X 48 dp above the bottom (plus the navigation bar). A finger over its zone pulls the bubble
  onto the circle, which grows and thickens with a haptic tick. Released there, the bubble fades and sinks, and stays
  away until the call's channel changes (`trashedVoiceChannelId`). The reference grows the circle to fit its bubble.
  Ours grows it by 1.5, as for a bubble no larger than the circle, since the PIP is wider.
- **When.** The reference shows while the setting is on, a voice channel is selected and the foreground service
  runs, also over the app. Ours shows only while the activity is stopped (`onStop`), so in-app system dialogs keep it
  away, and hides on `onStart` or when the call ends.
- **Permission.** `enableOverlay`: true when `Settings.canDrawOverlays`, else `ACTION_MANAGE_OVERLAY_PERMISSION` for
  the package, and the answer on return. A refusal turns the setting back off. The reference asks again at start when
  the permission was revoked. Ours turns the setting off instead.
- **Reopening.** The menu's Open Discord starts `MainActivity` with `FLAG_ACTIVITY_NEW_TASK`, then a headless task
  selects the channel. Ours has no menu: the PIP's name tap (its expand) opens the app and the full panel.
- **Setting.** Voice & Video, section "Overlay": "Enable Mobile Voice Overlay" (`AndroidMobileOverlaySetting`), kept
  on the device (`voiceSettings.mobileOverlay`, MobileVoiceOverlayStore is a DeviceSettingsStore).
- Not ported: the menu, the channel selector and invite link, the avatar bubble with up to three speakers.

How it is built:
- `voice/overlay/VoiceOverlay.kt` decides when to show. `OverlayBubble` owns the window, the drag and the springs,
  `OverlayTrash` the target, `OverlayWindow.kt` the params and the allowed area.
- The bubble's contents are a React surface: `ReactHost.createSurface(context, "IsocordVoiceOverlay")`, the root
  `overlay/MobileVoiceOverlay.tsx` registers. It renders `VoicePip` on the PIP card's background and corners, inside
  a `GestureHandlerRootView` (push to talk) and the app's running session (`activeSession()`). A call keeps the
  session alive. The window measures the surface unbounded, so React lays it out at the PIP's size. Fabric then asks
  for a relayout as the PIP changes size.
- A stopped activity pauses Fabric's mounting frame loop and Reanimated's. While the bubble shows, native restarts
  both (`onHostResume` on the FabricUIManager and the ReanimatedModule only, so AppState stays `background`), and
  pauses them again when it hides with the app still away. JS timers run because of the call's headless task (3.6).
- Expand: `requestPanel` marks the panel requested in `panelRequestStore`, `openApp` brings the activity forward. The
  call's dock opens the panel when it sees the request (`usePanelRequest`), also after a recreated activity mounts it.
  A pre-join of another channel is dismissed first.

The seam (`IsocordVoiceOverlay`, `HybridIsocordVoiceOverlay.kt`, a Nitro HybridObject):

| Crosses | Value | Notes |
|---|---|---|
| Method | `setEnabled(bool)` | The setting, sent at session start and on change |
| Method | `setChannel(id \| undefined)` | The call's channel. A new id forgets a trashed bubble. Undefined on session dispose. Native clears it on JS reload |
| Method | `canDrawOverlays(): bool` | Sync. Read at session start |
| Method | `requestPermission(): Promise<bool>` | Request code 234780 (OVERLAY_REQUEST_CODE), native only |
| Method | `openApp()` | Starts `MainActivity`, new task |
| Constant | `getConstants().componentName` | `OVERLAY_COMPONENT`, the AppRegistry key of the bubble's root |
| Constant | `getConstants().pipWindowOffset` | `PIP_WINDOW_OFFSET_DP`, 16. The in-app PIP's `PIP_WINDOW_OFFSET` reads it |
| Activity | `onStart`, `onStop` | `VoiceOverlay.setAppVisible` |

No events and no links: the expand runs in the overlay's own JS, which shares the app's runtime and session.

## 12. Open questions

1. Remote speaking rings: `getStats` polling cost vs a decoded-audio tap.
2. Which middle noise suppression tier: GTCRN (cheap, 16 kHz) or DeepFilterNet3 (48 kHz, heavier). Measured on
   the real phone and an ARMv7 device.
3. GitHub Actions disk and time for the libwebrtc build: standard runner with cleanup, or larger/self-hosted.

## 13. Verification

- The prototype first, then tests: emulator against real clients with the alt account, a scripted adb run per
  feature, logcat filtered to the voice tags.
- Then a real arm64 phone for routing, echo, H264, Bluetooth, Telecom and battery, and an ARMv7 device.
- One long background soak (30+ min) per phase.

Sources for 4.2 and 6.4: [RNNoise](https://rnnoise.com/), [GTCRN](https://github.com/Xiaobin-Rong/gtcrn),
[DeepFilterNet](https://github.com/rikorose/deepfilternet), [OpenNC comparison table](https://github.com/MAkcanca/OpenNC),
[Core-Telecom](https://developer.android.com/develop/connectivity/telecom/voip-app/telecom),
[build_aar.py](https://webrtc.googlesource.com/src/+/main/tools_webrtc/android/build_aar.py).
