import {
    channelVoiceStates,
    guildVoiceState,
} from '../../../stores/voiceStates'
import type { VoiceStatesState } from '../../../stores/voiceStates'

/** What a call row reads besides its message: the live call, as primitives so the rows rebuild only on change. */
export interface CallInputs {
    /** The users connected to the shown channel's call, ids joined by commas. */
    participants: string
    /** Whether the user is in a DM or group DM call. */
    inDmCall: boolean
}

/**
 * ChannelRTCStore.getParticipants without the ringing ones: the users connected to the channel's call, joined by
 * commas.
 */
export const callParticipantIds = (
    state: VoiceStatesState,
    channelId: string,
): string =>
    channelVoiceStates(state, channelId)
        .map(voice => voice.userId)
        .join(',')

/** VoiceStateStore.getUserVoiceChannelId(ME, id): whether the user has a voice state in a DM or group DM call. */
export const isInDmCall = (state: VoiceStatesState, userId: string): boolean =>
    guildVoiceState(state, null, userId) !== undefined
