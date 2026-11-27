import { ChannelType } from '../../../core/discord/channelType'
import {
    MESSAGE_REFERENCE_FORWARD,
    MessageFlag,
    MessageType,
    REPLYABLE_MESSAGE_TYPES,
    UNDELETABLE_MESSAGE_TYPES,
    USER_MESSAGE_TYPES,
} from '../../../core/discord/messages'
import { Permission } from '../../../core/discord/permissions'
import { t } from '../../../i18n'
import { swipeMode } from '../../../native/IsocordConstants'
import { channelsStore, isPrivate } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { can as hasPermission } from '../../../stores/permissions'
import { settingsStore } from '../../../stores/settings/settingsStore'
import {
    copyMediaLink,
    openMediaLink,
    saveMedia,
} from '../../mediaViewer/actions'
import { canForwardMessage } from '../../share/canForward'
import { allTextDisplayContent } from '../messageComponents/apiComponent'
import { canEndPollEarly, endPollAction } from '../polls/pollActions'
import {
    composerActions,
    copyId,
    copyLink,
    copyText,
    failedActions,
    forward,
    moderationActions,
    navigationActions,
} from './messageActionRows'
import type { Session } from '../../../core/session'
import type { IconName } from '../../../design/icons/Icon'
import type { Channel } from '../../../stores/channels/channels'
import type { Message } from '../../../stores/readStates'
import type { HeldMedia } from '../../mediaViewer/store'
import type { ComposerApi } from '../composer'
import type { ApiComponent } from '../messageComponents/apiComponent'
import type { ActionEnv } from './messageActionRows'

/** One row of the long press sheet. */
export interface MessageAction {
    key: string
    label: string
    icon: IconName
    isDestructive?: boolean
    onPress: () => void
}

export interface MessageActionContext {
    session: Session
    message: Message
    /** Absent in a message preview, which has no composer: edit, reply and mention are left out there. */
    composer?: ComposerApi
    /** Opens another chat (a thread, or the DM "Message" starts). */
    openChannel: (channelId: string) => void
}

export type FlaggedMessage = Message & {
    flags?: number
    components?: ApiComponent[]
    poll?: unknown
    message_snapshots?: Array<{ message: { content?: string } }>
    message_reference?: { type?: number }
}

/** Returns a check of one permission bit in a channel (PermissionStore.can), a lookup in the permission cache. */
function permissionCheck(session: Session, channelId: string) {
    return (permission: bigint) => hasPermission(session, channelId, permission)
}

/**
 * The text a message has to copy: its content, or a forward's (`getContentMessage`). A components message copies
 * its text displays (getAllTextDisplayContent).
 */
function messageText(message: FlaggedMessage): string {
    if ((message.flags ?? 0) & MessageFlag.IS_COMPONENTS_V2)
        return allTextDisplayContent(message.components) ?? ''
    return (
        message.content || message.message_snapshots?.[0]?.message.content || ''
    )
}

/** Whether the emoji row (and reacting) is offered: `canReactToMessage` in an active channel. */
export function canReact(session: Session, message: FlaggedMessage): boolean {
    const channel = session.get(channelsStore).getState().channels[
        message.channel_id
    ]
    const can = permissionCheck(session, message.channel_id)
    return (
        !message.state &&
        message.type !== MessageType.THREAD_STARTER_MESSAGE &&
        !((message.flags ?? 0) & MessageFlag.EPHEMERAL) &&
        (channel === undefined ||
            (isPrivate(channel)
                ? true
                : can(Permission.ADD_REACTIONS) &&
                  can(Permission.VIEW_CHANNEL))) &&
        isActive(channel, can)
    )
}

/** `isActiveChannelOrUnarchivableThread`: an archived thread only counts if the user could unarchive it by writing. */
function isActive(
    channel: Channel | undefined,
    can: (permission: bigint) => boolean,
): boolean {
    const metadata = channel?.thread_metadata
    if (!metadata?.archived) return true
    return can(
        metadata.locked
            ? Permission.MANAGE_THREADS
            : Permission.SEND_MESSAGES_IN_THREADS,
    )
}

/** `canEditMessage` plus the locked-thread check, for a sent message. */
function canEditMessage(
    message: FlaggedMessage,
    mine: boolean,
    lockedForMe: boolean,
): boolean {
    const type = message.type ?? MessageType.DEFAULT
    return (
        mine &&
        !lockedForMe &&
        USER_MESSAGE_TYPES.has(type) &&
        type !== MessageType.MEDIA_MENTION_MESSAGE &&
        (!message.sticker_items?.length || message.content !== '') &&
        ((message.flags ?? 0) & MessageFlag.IS_VOICE_MESSAGE) === 0 &&
        message.poll == null &&
        message.message_reference?.type !== MESSAGE_REFERENCE_FORWARD
    )
}

/** `canReplyToMessage`, for a sent message in an active channel. */
function canReplyToMessage(
    message: FlaggedMessage,
    priv: boolean,
    can: (permission: bigint) => boolean,
): boolean {
    return (
        REPLYABLE_MESSAGE_TYPES.has(message.type ?? MessageType.DEFAULT) &&
        (priv ||
            (can(Permission.SEND_MESSAGES) &&
                can(Permission.READ_MESSAGE_HISTORY)))
    )
}

/**
 * What swiping a message does (RowGeneratorConstants SwipeActionsType): reply, reply and with a longer pull edit, or
 * nothing. The permissions of the channel are worked out once; the returned function answers for each message.
 * Failed, sending and ephemeral messages offer nothing.
 */
export function messageSwipeActions(
    session: Session,
    channel: Channel | undefined,
): (message: Message) => string | undefined {
    // No channel: the DM default.
    const can = permissionCheck(session, channel?.id ?? '')
    const priv = channel === undefined || isPrivate(channel)
    const lockedForMe =
        channel?.thread_metadata?.locked === true &&
        !can(Permission.MANAGE_THREADS)
    const active = isActive(channel, can)
    return base => {
        const message = base as FlaggedMessage
        if (
            !active ||
            message.state ||
            ((message.flags ?? 0) & MessageFlag.EPHEMERAL) !== 0
        )
            return undefined
        if (!canReplyToMessage(message, priv, can)) return undefined
        return canEditMessage(
            message,
            message.author.id === session.userId,
            lockedForMe,
        )
            ? swipeMode.replyEdit
            : swipeMode.reply
    }
}

/** The rows of a message that is not sent (failed, sending) or only shown to you (ephemeral), or `undefined`. */
function unsentGroups(
    env: ActionEnv,
    flags: number,
    developerMode: boolean,
): MessageAction[][] | undefined {
    const { message, text } = env
    const hasText = text.length > 0
    const copy = copyText(text)
    if (message.state === 'failed') {
        const { retry, discard } = failedActions(env)
        return [[retry, ...(hasText ? [copy] : []), discard]]
    }
    // A message that is still sending cannot be cancelled here.
    if (message.state === 'sending') return hasText ? [[copy]] : []
    if ((flags & MessageFlag.EPHEMERAL) !== 0) {
        const group = [
            ...(hasText ? [copy] : []),
            ...(developerMode ? [copyId(message.id)] : []),
        ]
        return group.length > 0 ? [group] : []
    }
    return undefined
}

/** What the signed-in user may do with a sent message, from the reference's conditions. */
function messagePermissions(env: ActionEnv, flags: number) {
    const { session, message, channel } = env
    const channels = session.get(channelsStore).getState().channels
    const guild = channel?.guild_id
        ? session.get(guildsStore).getState().guilds[channel.guild_id]
        : undefined
    const can = permissionCheck(session, message.channel_id)
    const mine = message.author.id === session.userId
    const type = message.type ?? MessageType.DEFAULT
    const priv = channel === undefined || isPrivate(channel)
    const lockedForMe =
        channel?.thread_metadata?.locked === true &&
        !can(Permission.MANAGE_THREADS)
    const canManage = can(Permission.MANAGE_MESSAGES)
    const canTalkToAuthor = !priv && !message.author.bot
    return {
        active: isActive(channel, can),
        canManage,
        canEdit: canEditMessage(message, mine, lockedForMe),
        canReply: canReplyToMessage(message, priv, can),
        canPin: !USER_MESSAGE_TYPES.has(type)
            ? false
            : (priv ||
                  (can(Permission.PIN_MESSAGES) &&
                      can(Permission.READ_MESSAGE_HISTORY))) &&
              channel?.type !== ChannelType.GUILD_VOICE &&
              channel?.type !== ChannelType.GUILD_STAGE_VOICE,
        canPublish:
            (flags & MessageFlag.CROSSPOSTED) === 0 &&
            channel?.type === ChannelType.GUILD_ANNOUNCEMENT &&
            guild?.features?.includes('NEWS') === true &&
            can(Permission.SEND_MESSAGES) &&
            (mine || canManage) &&
            type === MessageType.DEFAULT &&
            message.poll == null,
        canDelete: (canManage || mine) && !UNDELETABLE_MESSAGE_TYPES.has(type),
        canMessageAuthor: canTalkToAuthor && !mine,
        canMention: canTalkToAuthor && can(Permission.SEND_MESSAGES),
        hasThread:
            (flags & MessageFlag.HAS_THREAD) !== 0 &&
            channels[message.id] !== undefined,
        // computeCanStartPublicThread with a message: a text or announcement channel (a message elsewhere is in a
        // thread or a DM), a user message without a thread yet.
        canCreateThread:
            (channel?.type === ChannelType.GUILD_TEXT ||
                channel?.type === ChannelType.GUILD_ANNOUNCEMENT) &&
            can(Permission.CREATE_PUBLIC_THREADS) &&
            can(Permission.READ_MESSAGE_HISTORY) &&
            (flags & MessageFlag.HAS_THREAD) === 0 &&
            USER_MESSAGE_TYPES.has(type),
    }
}

/**
 * Returns the long press sheet's rows in groups, with the reference's conditions and order
 * (LongPressMessageActionSheet).
 * Left out, as the feature is missing: view reactions, report, apps, bookmarks, reminders and the
 * attachment rows.
 * A held media tile's rows are `mediaActions`.
 */
export function messageActionGroups(
    context: MessageActionContext,
): MessageAction[][] {
    const { session, composer } = context
    const message = context.message as FlaggedMessage
    const flags = message.flags ?? 0
    const channel = session.get(channelsStore).getState().channels[
        message.channel_id
    ]
    const env: ActionEnv = {
        ...context,
        message,
        channel,
        text: messageText(message),
    }
    const developerMode = session.get(settingsStore).getState().developerMode
    const unsent = unsentGroups(env, flags, developerMode === true)
    if (unsent) return unsent
    // Thread starter messages offer only a jump to the thread, which has no screen yet.
    if (message.type === MessageType.THREAD_STARTER_MESSAGE) return []

    const allowed = messagePermissions(env, flags)
    const { edit, reply, createThread, mention } = composerActions(env)
    const { openThread, markUnread, messageAuthor } = navigationActions(env)
    const { publish, pin, removeReactions, remove } = moderationActions(env)
    const { active } = allowed
    const hasComposer = !!composer
    const hasReactions =
        (message.reactions?.length ?? 0) > 0 && message.poll == null
    // In an archived thread nothing that changes the message is offered.
    const groups: Array<Array<MessageAction | false>> = [
        [
            active && allowed.canEdit && hasComposer && edit,
            active && allowed.canReply && hasComposer && reply,
            canForwardMessage(session, message) && forward(message),
            // Only from a chat: the screen it opens leaves for the new thread's chat.
            active && allowed.canCreateThread && hasComposer && createThread,
        ],
        [
            // END_EARLY (usePollMessageContextItemTypes): first of the reference's rows this sheet has.
            active &&
                canEndPollEarly(session, message) &&
                endPollAction(session, message),
            allowed.hasThread && openThread,
            env.text.length > 0 && copyText(env.text),
            active && markUnread,
            active && allowed.canPublish && publish,
            active && allowed.canPin && pin,
            active && allowed.canMessageAuthor && messageAuthor,
            active && allowed.canMention && hasComposer && mention,
            copyLink(channel, message),
            developerMode === true && copyId(message.id),
        ],
        [
            active && hasReactions && allowed.canManage && removeReactions,
            active && allowed.canDelete && remove,
        ],
    ]
    return groups
        .map(group =>
            group.filter((action): action is MessageAction => !!action),
        )
        .filter(group => group.length > 0)
}

/**
 * Returns the rows for a held media tile: selectedMedia's Save Image or Video and Copy Media Link, plus Copy
 * Proxied Media Link and Open Media Link.
 * Unlike the reference, they form their own group above the message's rows.
 * The links are the file's own address, the reference's are the proxy's (getEmbedUrl).
 * Copy Proxied Media Link shows only when the proxy's address differs.
 * Web player media (YouTube, TikTok) has no file to save (isWebPlayerVideoUrl).
 */
export function mediaActions({
    source,
    url,
    proxyUrl,
}: HeldMedia): MessageAction[] {
    return [
        ...(source.embedUrl
            ? []
            : [
                  {
                      key: 'saveMedia',
                      label: t('chat.actions.saveMedia'),
                      icon: 'DownloadIcon' as const,
                      onPress: () => void saveMedia(url, source.kind),
                  },
              ]),
        {
            key: 'copyMediaLink',
            label: t('mediaViewer.copyMediaLink'),
            icon: 'LinkIcon',
            onPress: () => copyMediaLink(source.file),
        },
        ...(proxyUrl === source.file
            ? []
            : [
                  {
                      key: 'copyProxiedMediaLink',
                      label: t('chat.actions.copyProxiedMediaLink'),
                      icon: 'LinkIcon' as const,
                      onPress: () => copyMediaLink(proxyUrl),
                  },
              ]),
        {
            key: 'openMediaLink',
            label: t('chat.actions.openMediaLink'),
            icon: 'WindowLaunchIcon',
            onPress: () => openMediaLink(source.file),
        },
    ]
}
