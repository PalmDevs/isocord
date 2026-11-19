import { Endpoint } from '../../core/api/paths'
import {
    MESSAGE_REFERENCE_FORWARD,
    MessageFlag,
} from '../../core/discord/messages'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { channelPermissions } from '../../stores/permissions'
import { usersStore } from '../../stores/users'
import { createNonce, send } from '../chat/composer/outbox/outbox'
import { bypassesSlowmode } from '../chat/composer/state/status'
import {
    addAttachments,
    clearAttachments,
    maxUploadSize,
    uploadsStore,
} from '../upload'
import type { Session } from '../../core/session'
import type { Message } from '../../stores/readStates'

/** isRatelimitedInChannel: slowmode holds the user in the channel. */
export function isSlowmoded(session: Session, channelId: string): boolean {
    const channel = session.get(channelsStore).getState().channels[channelId]
    return (
        (channel?.rate_limit_per_user ?? 0) > 0 &&
        !bypassesSlowmode(channelPermissions(session, channelId))
    )
}

/**
 * ForwardActionCreators.sendForward: the forward, then the added text as a message of its own.
 * The text is not sent where slowmode holds the user. `@silent` silences both.
 * Like the reference (`eagerDispatch: false`), the forward shows only once the server has it.
 */
async function sendForward(
    session: Session,
    message: Message,
    channelId: string,
    content: string,
    silent: boolean,
): Promise<void> {
    const origin = session.get(channelsStore).getState().channels[
        message.channel_id
    ]
    await session.rest.post(Endpoint.channelMessages(channelId), {
        body: {
            content: '',
            nonce: createNonce(),
            tts: false,
            flags: silent ? MessageFlag.SUPPRESS_NOTIFICATIONS : 0,
            message_reference: {
                type: MESSAGE_REFERENCE_FORWARD,
                message_id: message.id,
                channel_id: message.channel_id,
                guild_id: origin?.guild_id,
            },
        },
    })
    if (content !== '' && !isSlowmoded(session, channelId))
        await send(session, channelId, { content, silent })
}

/** sendForwards: forwards to every destination at once. Returns those it failed for. */
export async function sendForwards(
    session: Session,
    message: Message,
    channelIds: string[],
    content: string,
    silent: boolean,
): Promise<string[]> {
    const results = await Promise.allSettled(
        channelIds.map(id =>
            sendForward(session, message, id, content, silent),
        ),
    )
    return channelIds.filter(
        (_, index) => results[index]?.status === 'rejected',
    )
}

/**
 * sendShareMessage: the text and the files of the `filesKey` list, as one message per destination.
 * Each destination uploads its own copy of the files, under its own limits. Returns those it failed for.
 */
export async function sendShares(
    session: Session,
    filesKey: string,
    channelIds: string[],
    content: string,
    silent: boolean,
): Promise<string[]> {
    const files = session.get(uploadsStore).getState().channels[filesKey] ?? []
    const premiumType = session.get(usersStore).getState().users[
        session.userId
    ]?.premium_type
    const results = await Promise.all(
        channelIds.map(async channelId => {
            const key = `${filesKey}.${channelId}`
            const guildId = session.get(channelsStore).getState().channels[
                channelId
            ]?.guild_id
            const guild = guildId
                ? session.get(guildsStore).getState().guilds[guildId]
                : undefined
            addAttachments(
                session,
                key,
                files.map(file => ({
                    uri: file.previewUri,
                    filename: file.filename,
                    mimeType: file.mimeType,
                    spoiler: file.spoiler,
                    description: file.description,
                })),
                {
                    maxFileSize: maxUploadSize({
                        premiumType,
                        guildFeatures: guild?.features,
                    }),
                    defer: true,
                },
            )
            const sent = await send(session, channelId, {
                content,
                silent,
                files: key,
            })
            // A failed upload keeps its list for a retry in the chat; here nothing shows it.
            if (!sent) clearAttachments(session, key)
            return sent
        }),
    )
    return channelIds.filter((_, index) => !results[index])
}
