import { useSession, useSessionStore } from '../../core/react'
import { VoiceDock } from './panel/dock/VoiceDock'
import { preJoinClosed, preJoinStore } from './prejoin/preJoinStore'
import { rtcStore } from './rtc'
import { useVoiceCards } from './useVoiceCards'
import type { VoiceDockProps } from './panel/dock/VoiceDock'

/**
 * The voice UI over the app: the call's card above the tab bar, which opens to the voice panel, and the pre-join
 * card of a channel we are not in. While both show, the call waits as the PIP. Joining turns the pre-join's card
 * into the call's, and an ended call's card plays its exit.
 */
export function VoiceOverlay() {
    const session = useSession()
    const callChannelId = useSessionStore(rtcStore, state => state.channelId)
    const preJoinGuildId = useSessionStore(preJoinStore, state => state.guildId)
    const preJoinChannelId = useSessionStore(
        preJoinStore,
        state => state.channelId,
    )
    const closing = useSessionStore(preJoinStore, state => state.closing)
    const preJoin =
        preJoinGuildId !== null &&
        preJoinChannelId !== null &&
        preJoinChannelId !== callChannelId
    const cards = useVoiceCards(
        callChannelId,
        preJoin ? preJoinChannelId : null,
    )
    // One list, so React keeps a card by its key while it changes role.
    const shown: (VoiceDockProps & { key: number })[] = []
    if (cards.ended) {
        const { key } = cards.ended
        shown.push({
            key,
            channelId: cards.ended.channelId,
            closing: true,
            onExited: () => cards.clearEnded(key),
        })
    }
    if (cards.call) shown.push({ ...cards.call, behindPreJoin: preJoin })
    if (preJoin)
        shown.push({
            key: cards.preJoinKey,
            channelId: preJoinChannelId,
            preJoinGuildId,
            closing,
            onExited: () => preJoinClosed(session),
        })
    return (
        <>
            {shown.map(({ key, ...props }) => (
                <VoiceDock key={key} {...props} />
            ))}
        </>
    )
}
