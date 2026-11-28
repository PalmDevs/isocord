import { useEffect } from 'react'
import { streamOwnerId } from '../../../core/discord/streams'
import { useSession, useSessionStore } from '../../../core/react'
import { guildVoiceState, voiceStatesStore } from '../../../stores/voiceStates'
import { rtcStore } from '../rtc'
import { endStream } from '../streamActions'
import { streamsStore } from '../streams'

/**
 * Ends the watch of a stream whose streamer stopped streaming or left the call. ChannelRTCStore drops a stream's
 * participant when its voice state stops streaming, which unfocuses it and closes its connection.
 */
export function useEndedStreamWatch(): void {
    const session = useSession()
    const owner = useSessionStore(streamsStore, state =>
        state.streamKey !== null && !state.own
            ? streamOwnerId(state.streamKey)
            : null,
    )
    const guildId = useSessionStore(rtcStore, state => state.guildId)
    const channelId = useSessionStore(rtcStore, state => state.channelId)
    const streaming = useSessionStore(voiceStatesStore, state => {
        if (owner === null) return false
        const voice = guildVoiceState(state, guildId, owner)
        return voice?.channelId === channelId && voice.selfStream
    })
    useEffect(() => {
        // The stream already ended on the server, so there is nothing to tell it.
        if (owner !== null && !streaming) endStream(session, false)
    }, [session, owner, streaming])
}
