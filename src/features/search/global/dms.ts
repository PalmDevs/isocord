import { useMemo } from 'react'
import { ChannelType } from '../../../core/discord/channelType'
import { compareSnowflakes } from '../../../core/discord/snowflake'
import { useSessionStore } from '../../../core/react'
import { computeChannelName } from '../../../stores/channels/channelName'
import { channelsStore } from '../../../stores/channels/channels'
import { displayName, usersStore } from '../../../stores/users'
import type { Channel } from '../../../stores/channels/channels'
import type { User } from '../../../stores/users'

export interface PrivateChannelEntry {
    channel: Channel
    isGroup: boolean
    /** Channel name, else the recipients joined. */
    name: string
    /** Names the query is matched against: the recipients' usernames and display names. */
    haystack: string[]
    recipient?: User
}

/** Private channels newest first (the Messages tab order). */
export function usePrivateChannelEntries(): PrivateChannelEntry[] {
    const channels = useSessionStore(channelsStore, state => state.channels)
    const privateIds = useSessionStore(channelsStore, state => state.privateIds)
    const users = useSessionStore(usersStore, state => state.users)
    return useMemo(() => {
        const entries: PrivateChannelEntry[] = []
        for (const id of privateIds) {
            const channel = channels[id]
            if (!channel) continue
            const recipients = (channel.recipient_ids ?? []).map(
                userId => users[userId],
            )
            const isGroup = channel.type === ChannelType.GROUP_DM
            entries.push({
                channel,
                isGroup,
                name: computeChannelName(channel, users),
                recipient: isGroup ? undefined : recipients[0],
                haystack: [
                    ...(isGroup && channel.name ? [channel.name] : []),
                    ...recipients.flatMap(user =>
                        user ? [user.username, displayName(user)] : [],
                    ),
                ].map(name => name.toLowerCase()),
            })
        }
        return entries.sort((a, b) =>
            compareSnowflakes(
                b.channel.last_message_id ?? b.channel.id,
                a.channel.last_message_id ?? a.channel.id,
            ),
        )
    }, [channels, privateIds, users])
}
