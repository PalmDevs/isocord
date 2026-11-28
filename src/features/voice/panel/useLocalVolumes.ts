import { useEffect } from 'react'
import { useSession, useSessionStore } from '../../../core/react'
import { applyLocalVolumes } from '../localVolumes'
import { rtcStore } from '../rtc'
import { streamsStore } from '../streams'

/** Gives each new voice and stream connection the kept per-user volumes and mutes, as it opens. */
export function useLocalVolumes(): void {
    const session = useSession()
    const voiceConnected = useSessionStore(
        rtcStore,
        state => state.connection === 'connected',
    )
    // A new stream server is a new stream connection.
    const streamServer = useSessionStore(streamsStore, state => state.server)
    useEffect(() => {
        if (voiceConnected) applyLocalVolumes(session, 'default')
    }, [session, voiceConnected])
    useEffect(() => {
        if (streamServer) applyLocalVolumes(session, 'stream')
    }, [session, streamServer])
}
