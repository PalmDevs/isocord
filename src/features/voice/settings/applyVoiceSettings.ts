import { ChannelType } from '../../../core/discord/channelType'
import { Permission } from '../../../core/discord/permissions'
import { t } from '../../../i18n'
import native from '../../../native/IsocordVoice'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { can, channelPermissions } from '../../../stores/permissions'
import { showToast } from '../../toasts'
import { rtcStore } from '../rtc'
import { voiceSettingsStore } from './voiceSettings'
import type { Session } from '../../../core/session'
import type { InputMode, PreferredDevices } from '../../../native/voiceTypes'
import type { VoiceSettings } from './voiceSettings'

/**
 * PermissionVADStore: a guild voice channel without USE_VAD needs push to talk. Stages and DM calls never do.
 * The reference mutes voice activity there and warns. Isocord switches to push to talk instead.
 */
export function channelForcesPushToTalk(
    guildId: string | null,
    channelType: number | undefined,
    permissions: bigint,
): boolean {
    if (!guildId || channelType === undefined) return false
    if (channelType === ChannelType.GUILD_STAGE_VOICE) return false
    return (permissions & Permission.USE_VAD) === 0n
}

function forcesPushToTalk(session: Session): boolean {
    const { guildId, channelId } = session.get(rtcStore).getState()
    if (!channelId) return false
    const channel = session.get(channelsStore).getState().channels[channelId]
    return channelForcesPushToTalk(
        guildId,
        channel?.type,
        channelPermissions(session, channelId),
    )
}

/** Returns what `setInputMode` gets: the settings, with the call channel's push to talk and priority speaker. */
function inputModeOf(session: Session, settings: VoiceSettings): InputMode {
    const { channelId } = session.get(rtcStore).getState()
    const pushToTalk =
        settings.inputMode === 'pushToTalk' || forcesPushToTalk(session)
    return {
        mode: pushToTalk ? 'pushToTalk' : 'voiceActivity',
        autoThreshold: settings.autoThreshold,
        threshold: settings.threshold,
        noiseSuppression: settings.noiseSuppression,
        echoCancellation: settings.echoCancellation,
        autoGainControl: settings.autoGainControl,
        prioritySpeaker:
            channelId !== null &&
            can(session, channelId, Permission.PRIORITY_SPEAKER),
    }
}

/**
 * Sends the voice settings to native now and on every change. Native keeps them per process only, and a JS
 * reload ends the call, so each session start sends them again. Returns the cleanup.
 */
export function registerVoiceSettings(session: Session): () => void {
    if (!native) return () => {}
    const voice = native
    let sentMode = ''
    let sentInput: number | null = null
    let sentOutput: number | null = null
    let sentDevices = ''
    let sentCamera = ''
    let forced = false
    const apply = () => {
        const settings = voiceSettingsStore.getState()
        const mode = JSON.stringify(inputModeOf(session, settings))
        if (mode !== sentMode) voice.setInputMode(mode)
        sentMode = mode
        if (settings.inputVolume !== sentInput)
            voice.setInputVolume(settings.inputVolume)
        sentInput = settings.inputVolume
        if (settings.outputVolume !== sentOutput)
            voice.setOutputVolume(settings.outputVolume)
        sentOutput = settings.outputVolume
        const devices = JSON.stringify({
            input: settings.inputDevice ?? undefined,
            output: settings.outputDevice ?? undefined,
        } satisfies PreferredDevices)
        if (devices !== sentDevices) voice.setPreferredDevices(devices)
        sentDevices = devices
        const camera = JSON.stringify(settings.camera)
        if (camera !== sentCamera) voice.setCamera(camera)
        sentCamera = camera
        const nowForced =
            settings.inputMode === 'voiceActivity' && forcesPushToTalk(session)
        // VADPermission's title: the channel switched us to push to talk.
        if (nowForced && !forced)
            showToast({ content: t('voice.pushToTalkRequired') })
        forced = nowForced
    }
    apply()
    const inCall = () => session.get(rtcStore).getState().channelId !== null
    const offs = [
        voiceSettingsStore.subscribe(apply),
        session.get(rtcStore).subscribe((state, previous) => {
            if (state.channelId !== previous.channelId) apply()
        }),
        // Overwrites, roles and our own roles change what the channel allows.
        session.get(channelsStore).subscribe(() => inCall() && apply()),
        session.get(guildsStore).subscribe(() => inCall() && apply()),
    ]
    return () => {
        for (const off of offs) off()
    }
}
