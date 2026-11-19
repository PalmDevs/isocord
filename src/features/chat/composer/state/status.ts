import { useEffect, useState } from 'react'
import {
    canSendMessages,
    canStartPrivateThread,
    canStartPublicThread,
    canStartThread,
    Permission,
} from '../../../../core/discord/permissions'
import { useSessionStore } from '../../../../core/react'
import { channelsStore } from '../../../../stores/channels/channels'
import { useChannelPermissions } from '../../../../stores/permissions'
import { useLastSent } from '../outbox/outbox'

/**
 * BYPASS_SLOWMODE skips slowmode, as in the reference (SlowmodeUtils.canBypassSlowmode). MANAGE_MESSAGES and
 * MANAGE_CHANNELS, which skipped it before that permission existed, are kept for guilds whose roles predate it.
 */
const SLOWMODE_BYPASS =
    Permission.BYPASS_SLOWMODE |
    Permission.MANAGE_MESSAGES |
    Permission.MANAGE_CHANNELS

const useChannel = (channelId: string) =>
    useSessionStore(channelsStore, state => state.channels[channelId])

/** Whether the user may send messages in the channel. Read it from the composer's state (`canSend`). */
export function useCanSend(channelId: string): boolean {
    return canSendMessages(
        useChannel(channelId),
        useChannelPermissions(channelId),
    )
}

/** Whether the user may start a thread in the channel (ThreadHooks.useCanStartThread). */
export function useCanStartThread(channelId: string): boolean {
    const channel = useChannel(channelId)
    const permissions = useChannelPermissions(channelId)
    return channel !== undefined && canStartThread(channel, permissions)
}

/**
 * ThreadCreationHooks.usePrivateThreadMode: whether a new thread in the channel can be private ('enabled'), must be
 * ('privateOnly', when the user may not start a public one), or cannot be ('disabled').
 */
export function usePrivateThreadMode(
    channelId: string,
): 'disabled' | 'enabled' | 'privateOnly' {
    const channel = useChannel(channelId)
    const permissions = useChannelPermissions(channelId)
    if (!channel || !canStartPrivateThread(channel, permissions))
        return 'disabled'
    return canStartPublicThread(channel, permissions)
        ? 'enabled'
        : 'privateOnly'
}

/** The channel's slowmode (rate_limit_per_user): seconds between messages, 0 without. */
export function useSlowmodeRate(channelId: string): number {
    return useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.rate_limit_per_user ?? 0,
    )
}

/** SlowmodeUtils.canBypassSlowmode, from the user's permissions in a channel. */
export const bypassesSlowmode = (permissions: bigint): boolean =>
    (permissions & SLOWMODE_BYPASS) !== 0n

/** SlowmodeUtils.useCanBypassSlowmode: slowmode does not hold the user here. */
export function useCanBypassSlowmode(channelId: string): boolean {
    return bypassesSlowmode(useChannelPermissions(channelId))
}

/** Seconds of slowmode left, ticking once a second. Read it from the composer's state (`slowmode`). */
export function useSlowmode(channelId: string): number {
    const rate = useSlowmodeRate(channelId)
    const bypass = useCanBypassSlowmode(channelId)
    const lastSent = useLastSent(channelId)
    const [now, setNow] = useState(Date.now())
    const remaining =
        !rate || bypass || lastSent === undefined
            ? 0
            : Math.max(0, Math.ceil((lastSent + rate * 1000 - now) / 1000))
    useEffect(() => {
        if (remaining === 0) return
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [remaining])
    return remaining
}
