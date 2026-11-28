import { useSessionStore } from '../../../core/react'
import { membersStore } from '../../../stores/members'
import { displayName, usersStore } from '../../../stores/users'
import type { VoiceState } from '../../../stores/voiceStates'

/** SortedVoiceStateStore's comparator prefixes: streamers sort first. */
const STREAMING_FIRST = '\0'
const NOT_STREAMING = '\u0001'
/** Between the comparator's name and user id. */
const COMPARATOR_SEPARATOR = '\0'

/**
 * SortedVoiceStateStore.getVoiceStatesForChannelAlt: a channel's voice states, streamers first, then by lowercase
 * name and user id.
 */
export function useSortedVoiceStates(
    guildId: string,
    states: readonly VoiceState[],
): VoiceState[] {
    const users = useSessionStore(usersStore, state => state.users)
    const members = useSessionStore(
        membersStore,
        state => state.members[guildId],
    )
    const keyed = states.map(voice => ({
        voice,
        comparator:
            (voice.selfStream ? STREAMING_FIRST : NOT_STREAMING) +
            displayName(
                users[voice.userId],
                members?.[voice.userId]?.nick,
            ).toLowerCase() +
            COMPARATOR_SEPARATOR +
            voice.userId,
    }))
    keyed.sort((a, b) =>
        a.comparator < b.comparator ? -1 : a.comparator > b.comparator ? 1 : 0,
    )
    return keyed.map(entry => entry.voice)
}
