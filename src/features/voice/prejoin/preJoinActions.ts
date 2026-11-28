import { selectVoiceChannel } from '../actions'
import { joinBlocker, reachedChannelLimit } from '../joinChecks'
import { rtcStore } from '../rtc'
import { watchStream } from '../streamActions'
import { openMaxCapacityAlert, openNoJoinPermissionsAlert } from './joinAlerts'
import { openPreJoin, preJoinStore } from './preJoinStore'
import type { Session } from '../../../core/session'

/**
 * VoicePanelConnectButton's press checks: an alert says why we cannot join (no CONNECT, or the channel is full).
 * Returns whether one opened. A stage is left to selectVoiceChannel's toast.
 */
function alertJoinBlocker(session: Session, channelId: string): boolean {
    const blocker = joinBlocker(session, channelId)
    if (blocker === 'voice.noJoinPermission') {
        openNoJoinPermissionsAlert()
        return true
    }
    if (blocker === 'voice.channelFull') {
        // VoicePanelMaxCapacityAlert names the user limit, which is 0 when video filled the channel. Ours names the
        // limit that was reached.
        openMaxCapacityAlert(reachedChannelLimit(session, channelId) ?? 0)
        return true
    }
    return false
}

/** VoicePanelConnectButton's press: joins, or opens the alert that says why we cannot. */
export function joinFromPreJoin(
    session: Session,
    guildId: string,
    channelId: string,
): void {
    if (alertJoinBlocker(session, channelId)) return
    void selectVoiceChannel(session, guildId, channelId)
}

/**
 * VoiceChannel's press. The first tap on a channel we are not in opens the pre-join card (openGuildVoiceModal). A
 * second tap on the same channel joins, like Join Voice. A tap on the channel we are in does nothing, and on our
 * dropped call there it rejoins like Join Voice.
 */
export function tapVoiceChannel(
    session: Session,
    guildId: string,
    channelId: string,
): void {
    const rtc = session.get(rtcStore).getState()
    if (rtc.channelId === channelId) {
        if (rtc.connection === 'disconnected')
            joinFromPreJoin(session, guildId, channelId)
        else void selectVoiceChannel(session, guildId, channelId)
        return
    }
    const preJoin = session.get(preJoinStore).getState()
    if (preJoin.channelId === channelId && !preJoin.closing) {
        joinFromPreJoin(session, guildId, channelId)
        return
    }
    openPreJoin(session, guildId, channelId)
}

/**
 * VoicePanelPreJoinContent StreamPreview's press: joins the channel and watches the stream. It checks like Join
 * Voice first, so a full channel opens the capacity alert.
 */
export async function watchFromPreJoin(
    session: Session,
    guildId: string,
    channelId: string,
    ownerId: string,
): Promise<void> {
    if (alertJoinBlocker(session, channelId)) return
    await selectVoiceChannel(session, guildId, channelId)
    if (session.get(rtcStore).getState().channelId === channelId)
        watchStream(session, ownerId)
}
