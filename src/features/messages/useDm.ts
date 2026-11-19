import { ChannelType } from '../../core/discord/channelType'
import { useSessionStore } from '../../core/react'
import { computeChannelName } from '../../stores/channels/channelName'
import { channelsStore } from '../../stores/channels/channels'
import { presencesStore } from '../../stores/presences'
import { usersStore } from '../../stores/users'
import type { Presence } from '../../stores/presences'
import type { User } from '../../stores/users'

export interface DmInfo {
    isGroup: boolean
    /** Channel name, else the recipients' names joined, else "Unnamed". Empty if the channel is unknown. */
    name: string
    /** The other user of a 1:1 DM. */
    recipient?: User
    presence?: Presence
    memberCount: number
    icon?: string | null
}

/** What both the conversation row and the chat header show about a DM or group DM. */
export function useDm(channelId: string): DmInfo | undefined {
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const recipientIds = channel?.recipient_ids ?? []
    const isGroup = channel?.type === ChannelType.GROUP_DM
    const recipient = useSessionStore(usersStore, state =>
        isGroup ? undefined : state.users[recipientIds[0] ?? ''],
    )
    const name = useSessionStore(usersStore, state =>
        channel ? computeChannelName(channel, state.users) : '',
    )
    const presence = useSessionStore(
        presencesStore,
        state => state.presences[recipient?.id ?? ''],
    )
    if (!channel) return undefined
    return {
        isGroup,
        name,
        recipient,
        presence,
        memberCount: recipientIds.length + 1,
        icon: channel.icon,
    }
}
