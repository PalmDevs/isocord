import * as Clipboard from 'expo-clipboard'
import { GuildFeature } from '../../../core/discord/guild'
import { channelPermalink } from '../../../core/discord/permalink'
import { logger } from '../../../core/log'
import { openLink, warmUpBrowser } from '../../../core/openLink'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { holdLinkedChannel } from '../../../stores/channels/linkedChannels'
import {
    joinThread,
    leaveThread,
} from '../../../stores/channels/threadMemberActions'
import { guildsStore } from '../../../stores/guilds'
import {
    findMessage,
    messagesStore,
    toggleRevealed,
} from '../../../stores/messages/messages'
import { chatGesturesStore } from '../../../stores/settings/chatGestures'
import { openMediaViewer } from '../../mediaViewer/store'
import { retryMessage } from '../composer/outbox/outbox'
import { toast } from '../composer/toast'
import { handleHeaderPress, openUserProfile } from '../headerActions'
import { heldFile, openAttachment } from '../longPress/fileActions'
import { copy } from '../longPress/messageActionRows'
import { handleComponentLink } from '../messageComponents/componentActions'
import { handlePollLink } from '../polls/pollActions'
import { toggleReactionByKey } from '../reactions'
import { openEmojiInfo } from '../sheets/emojiInfoSheet'
import { openReactionPicker } from '../sheets/openReactionPicker'
import { showReactionsSheet } from '../sheets/reactionsSheet'
import { openRoleMembers } from '../sheets/roleMembersSheet'
import { PostLinkAction, parseChatLink } from './chatLink'
import { openMaskedLink } from './maskedLink'
import { openChannelBrowser, openStackedChat } from './openChannel'
import { openMessageSticker } from './openSticker'
import type { Session } from '../../../core/session'
import type { Message } from '../../../stores/readStates'
import type { ForwardingMessage } from '../../mediaViewer/store'
import type { ComposerApi } from '../composer'
import type { ChatLink } from './chatLink'

const log = logger('ChatLinks')

/** ThreadActionCreators.joinThread and leaveThread: the `location` of the forum post action bar. */
const ACTION_BAR_LOCATION = 'Forum Post Action Bar'

warmUpBrowser()

interface LinkContext {
    session: Session
    /** The channel the links are in, whose server user and role links use. Absent over global DM search results. */
    channelId?: string
    /** Absent in a message preview or search, which have no composer: what needs it does nothing there. */
    composer?: ComposerApi
    /** The message a media or author link names. The chat's loaded messages when absent. */
    findMessage?: (messageId: string) => Message | undefined
    /**
     * Opens another chat as the panel of its tab, scrolled to a message when given one: what links open where no
     * chat panels are on screen to stack it on.
     */
    openChannel: (channelId: string, messageId?: string) => void
    /**
     * Scrolls the chat on screen to a message, loading the window around it when needed. Absent without a chat on
     * screen (search results): links to any channel then leave with `openChannel`.
     */
    scrollToMessage?: (messageId: string) => void
    /** Opens the details of the chat on screen on its Pinned Messages tab. Absent without a chat on screen. */
    openPins?: () => void
    /** Search lists: a tapped result or author line opens the result's preview. */
    openResult?: (channelId: string, messageId: string) => void
    /** Overrides `toggleRevealed` for a message preview, whose state is separate from the channel's. */
    toggleRevealed?: (groupId: string) => void
    /** Whether links to other channels stack over the chat on screen. True by default. */
    stack?: boolean
}

/**
 * Handles a link tapped in the message list, a search list or the media viewer: web links open in the browser,
 * `isocord://` links are in-app actions (chatLink.ts). Actions without a screen yet are ignored.
 */
export function handleChatLink(url: string, context: LinkContext): void {
    const link = parseChatLink(url)
    if (!link) return
    log.debug(`Chat link: ${link.kind}`)
    if (link.kind === 'web') {
        openLink(link.url)
        return
    }
    const { session, channelId, composer } = context
    const guildId = () =>
        channelId
            ? session.get(channelsStore).getState().channels[channelId]
                  ?.guild_id
            : undefined

    switch (link.kind) {
        case 'react':
            if (channelId)
                toggleReactionByKey(
                    session,
                    channelId,
                    link.messageId,
                    link.emojiKey,
                    link.burst,
                )
            return
        case 'reactions':
            if (channelId)
                showReactionsSheet(
                    channelId,
                    link.messageId,
                    link.emojiKey,
                    link.burst,
                )
            return
        case 'poll':
            if (channelId)
                handlePollLink(
                    session,
                    channelId,
                    link.messageId,
                    link.action,
                    link.answerId,
                )
            return
        case 'dismiss':
            // bindDismissMessage: the ephemeral message goes from this device only.
            if (channelId)
                session.gateway.dispatch.emit('MESSAGE_DELETE', {
                    id: link.messageId,
                    channel_id: channelId,
                })
            return
        case 'reveal':
            if (context.toggleRevealed) context.toggleRevealed(link.groupId)
            else if (channelId) toggleRevealed(session, channelId, link.groupId)
            return
        case 'component':
            if (channelId)
                handleComponentLink(
                    session,
                    channelId,
                    link.messageId,
                    link.componentId,
                )
            return
        case 'addReaction':
            if (channelId)
                openReactionPicker(session, channelId, link.messageId)
            return
        case 'retry':
            if (channelId) retryMessage(session, channelId, link.nonce)
            return
        case 'channel':
            void openLinkedChannel(link, context)
            return
        case 'emoji':
            void openEmojiInfo(link.emoji)
            return
        case 'timestamp':
            toast(link.text, 'timestamp')
            return
        case 'media':
            openLinkedMedia(link, context)
            return
        case 'author': {
            // Search: the name, avatar and tags of a result open it like the rest of it.
            if (context.openResult) {
                const message = messageOf(link.messageId, context)
                if (message) context.openResult(message.channel_id, message.id)
            } else if (channelId)
                handleHeaderPress(link.part, link.messageId, {
                    session,
                    channelId,
                    composer,
                })
            return
        }
        case 'masked':
            openMaskedLink(link.url)
            return
        case 'user':
            openUserProfile(session, link.userId, guildId())
            return
        case 'role': {
            // The role members sheet (@everyone's id is the guild's); an unknown role does nothing.
            const server = guildId()
            if (server)
                openRoleMembers(session, {
                    guildId: server,
                    roleId: link.roleId,
                    channelId,
                })
            return
        }
        case 'command':
            // The reference opens the app launcher on the command; here `/name` goes into the composer.
            if (composer) {
                composer.insertText(`/${link.name}`, { space: true })
                composer.focus()
            }
            return
        case 'nav':
            // openStaticChannelRoute: Channels & Roles on the tab the link names.
            if (
                link.guildId &&
                (link.route === 'browse' || link.route === 'customize') &&
                session
                    .get(guildsStore)
                    .getState()
                    .guilds[link.guildId]?.features?.includes(
                        GuildFeature.COMMUNITY,
                    )
            ) {
                openChannelBrowser(link.guildId, link.route)
                return
            }
            // There are no guild home and linked roles screens yet.
            toast(t('chat.mention.unavailable'), 'unavailable')
            return
        case 'pins':
            // openPinnedMessages: the channel details on Pinned Messages.
            if (link.channelId === channelId) context.openPins?.()
            return
        case 'editGroup':
            // There is no group DM settings sheet yet.
            toast(t('chat.mention.unavailable'), 'unavailable')
            return
        case 'result':
            context.openResult?.(link.channelId, link.messageId)
            return
        case 'post':
            handlePostLink(session, link.channelId, link.action)
            return
        case 'inlineCode':
            // onTapInlineCode: copies the code, unless turned off in Settings → Chat.
            if (chatGesturesStore.getState().tapInlineCodeToCopy) {
                Clipboard.setStringAsync(link.text).catch(() => {})
                toast(t('chat.copiedToClipboard'))
            }
            return
        case 'file': {
            const message = messageOf(link.messageId, context)
            const attachment = message && heldFile(message, url)
            if (attachment) void openAttachment(session, attachment)
            return
        }
        case 'sticker':
            void openMessageSticker(session, link.url)
            return
        case 'viewer':
            // The media viewer handles its own.
            return
        case 'embedText':
            // Only held, which the long press sheet handles (handleMessageLongPress).
            return
    }
}

/** ForumPostActionBar's Follow, Unfollow and Copy Link (handleCopyLinkForumPost). */
function handlePostLink(
    session: Session,
    channelId: string,
    action: PostLinkAction,
): void {
    const post = session.get(channelsStore).getState().channels[channelId]
    if (!post) return
    if (action === PostLinkAction.copyLink)
        copy(channelPermalink(post.guild_id, post.id), 'link')
    else
        void (action === PostLinkAction.follow ? joinThread : leaveThread)(
            session,
            post,
            ACTION_BAR_LOCATION,
        )
}

const messageOf = (
    messageId: string,
    { session, channelId, findMessage: find }: LinkContext,
): Message | undefined =>
    find
        ? find(messageId)
        : channelId
          ? findMessage(
                session.get(messagesStore).getState(),
                channelId,
                messageId,
            )
          : undefined

/**
 * Opens a channel from a mention, message link, reply preview or forward footer.
 * The reference pushes another channel screen (navigationReplace: false, navigateToChannel) that swipes back.
 * Here each opens in a panel stacked over what is on screen.
 */
async function openLinkedChannel(
    link: ChatLink & { kind: 'channel' },
    {
        session,
        channelId,
        openChannel,
        scrollToMessage,
        stack = true,
    }: LinkContext,
): Promise<void> {
    const { channelId: target, messageId } = link
    // An active or archived thread the client does not hold yet is held first, as the Threads tab does.
    if (!(await holdLinkedChannel(session, target))) {
        // Another server's channel we are not in, or one we cannot see. The reference lurks the server; here the
        // channel cannot be shown.
        toast(t('chat.mention.noAccess'), 'no-access')
        return
    }
    if (!scrollToMessage) {
        // No chat on screen: the channel opens in its tab.
        openChannel(target, messageId)
        return
    }
    // The chat on screen only sets its params, jumping to the message (navigateToChannel, jumpToReferencedMessage).
    if (target === channelId) {
        if (messageId) scrollToMessage(messageId)
    } else if (!stack || !openStackedChat(target, messageId))
        // A message preview has no panels to stack on: the channel opens in its tab.
        openChannel(target, messageId)
}

/** An attachment tile or an embed's media: the message's own, or the snapshot's under a forward. */
function openLinkedMedia(
    link: ChatLink & { kind: 'media' },
    context: LinkContext,
): void {
    const message = messageOf(link.messageId, context)
    if (!message) return
    if (!link.forward) {
        openMediaViewer(context.session, message, link.selection, link.origin)
        return
    }
    const snapshot = (message as ForwardingMessage).message_snapshots?.[0]
        ?.message
    if (snapshot)
        openMediaViewer(
            context.session,
            message,
            link.selection,
            link.origin,
            snapshot,
        )
}
