import { ChannelType } from '../../core/discord/channelType'
import { t } from '../../i18n'
import { displayName } from '../users'
import { isThread, isVoice } from './channels'
import type { User } from '../users'
import type { Channel } from './channels'

/** The name a DM shows when its other user is not known. */
const UNKNOWN_USER = '???'

/**
 * Port of computeChannelName (useChannelName). A DM is its user, a group DM its name or its people,
 * other channels their name. `prefixed` adds "@" to a DM and "#" to a text channel.
 */
export function computeChannelName(
    channel: Channel,
    users: Record<string, User | undefined>,
    prefixed = false,
): string {
    if (channel.type === ChannelType.DM) {
        const recipient = users[channel.recipient_ids?.[0] ?? '']
        if (!recipient) return UNKNOWN_USER
        return prefixed ? `@${displayName(recipient)}` : displayName(recipient)
    }
    if (channel.type === ChannelType.GROUP_DM)
        return (
            channel.name ||
            (channel.recipient_ids ?? [])
                .map(id => displayName(users[id]))
                .filter(Boolean)
                .join(', ') ||
            t('messages.unnamedGroup')
        )
    const name = channel.name ?? ''
    return prefixed && !isThread(channel) && !isVoice(channel)
        ? `#${name}`
        : name
}
