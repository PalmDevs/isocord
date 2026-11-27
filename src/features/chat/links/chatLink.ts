import { parseDiscordChannelUrl } from '../../../core/discord/channelUrl'
import { parseDiscordInviteUrl } from '../../../core/discord/inviteUrl'
import {
    burstPart,
    dmGuild,
    embedTextPart,
    linkKind,
    linkScheme,
    originParam,
    thumbnailPart,
    viewerAction,
} from '../../../native/NativeIsocordConstants'
import { headerPartOf } from '../headerParts'
import type { MediaOrigin, MediaSelection } from '../../mediaViewer/store'
import type { HeaderPart } from '../headerParts'
import type { EmojiInfo } from '../sheets/emojiInfoSheet'

/**
 * The `isocord://` grammar: in-app links that JS builds into rows and native views report back through
 * `onLinkPress`. The native views build the `linkKind` ones; the kinds here are built in JS only.
 */
const jsKind = {
    forward: 'forward',
    emoji: 'emoji',
    timestamp: 'timestamp',
    masked: 'masked',
    user: 'user',
    role: 'role',
    command: 'command',
    nav: 'nav',
    wave: 'wave',
    pins: 'pins',
    editGroup: 'edit-group',
    poll: 'poll',
    dismiss: 'dismiss',
    component: 'component',
    post: 'post',
    reveal: 'reveal',
} as const

/** What a forum post's action bar link does (ForumPostActionBar). */
export const PostLinkAction = {
    follow: 'follow',
    unfollow: 'unfollow',
    copyLink: 'copy-link',
} as const
export type PostLinkAction =
    (typeof PostLinkAction)[keyof typeof PostLinkAction]
const postActions: string[] = Object.values(PostLinkAction)
const isPostAction = (value: string | undefined): value is PostLinkAction =>
    value !== undefined && postActions.includes(value)

/** What a poll link does (PollsActionCreators.handlePollAnswerTapped and handlePollActionTapped). */
export const PollLinkAction = {
    /** Selects or deselects an answer, or lists its voters once results show. */
    answer: 'answer',
    /** Vote: sends the selected answers. */
    submit: 'submit',
    /** Remove Vote. */
    remove: 'remove',
    /** Show results, and Go back to vote. */
    results: 'results',
    /** The votes line: lists the voters of the first answer. */
    voters: 'voters',
} as const
export type PollLinkAction =
    (typeof PollLinkAction)[keyof typeof PollLinkAction]
const pollActions: string[] = Object.values(PollLinkAction)
const isPollAction = (value: string | undefined): value is PollLinkAction =>
    value !== undefined && pollActions.includes(value)

/** The query of a media link: the tile the viewer grows out of. */
const ORIGIN_QUERY = `${originParam}=`
/** The media viewer's own actions: a long press on the media, the alt text button, the speed picker. */
const viewerActions = [
    viewerAction.options,
    viewerAction.alt,
    viewerAction.speed,
]

/** A link tapped in a chat, a search list or the media viewer, decoded. */
export type ChatLink =
    | { kind: 'web'; url: string }
    | { kind: 'invite'; code: string; url: string }
    /** A tap on a reaction chip (`react`) or a hold on it (`reactions`). `burst`: the super reaction chip. */
    | {
          kind: 'react' | 'reactions'
          messageId: string
          emojiKey: string
          burst: boolean
      }
    /** A poll's answer or action button. */
    | {
          kind: 'poll'
          messageId: string
          action: PollLinkAction
          answerId?: number
      }
    /** "Dismiss message" under an ephemeral message (bindDismissMessage). */
    | { kind: 'dismiss'; messageId: string }
    | { kind: 'reveal'; groupId: string }
    /** A button or select of a message, by its component id (handleTapButtonActionComponent, handleTapSelectActionComponent). */
    | { kind: 'component'; messageId: string; componentId: string }
    /** A button of a forum post's action bar: Follow, Unfollow or Copy Link. */
    | { kind: 'post'; channelId: string; action: PostLinkAction }
    | { kind: 'addReaction'; messageId: string }
    /** A message that failed to send, by its nonce. */
    | { kind: 'retry'; nonce: string }
    /** Channel mentions, message links, reply previews and forward footers. */
    | { kind: 'channel'; channelId: string; messageId?: string }
    | { kind: 'emoji'; emoji: EmojiInfo }
    | { kind: 'timestamp'; text: string }
    /**
     * An attachment tile, an embed's media or a component's, of the message or of the snapshot it forwards. `origin` is the tile
     * in the window, undefined when unknown.
     */
    | {
          kind: 'media'
          messageId: string
          selection: MediaSelection
          forward: boolean
          origin?: MediaOrigin
      }
    /** A tap on a message's author line. */
    | { kind: 'author'; messageId: string; part: HeaderPart }
    /** A `[text](url)` link whose text differs from its target. */
    | { kind: 'masked'; url: string }
    | { kind: 'user'; userId: string }
    | { kind: 'role'; roleId: string }
    | { kind: 'command'; id: string; name: string }
    /** A tapped inline code span (onTapInlineCode). */
    | { kind: 'inlineCode'; text: string }
    /** A file or audio attachment card, by its index among the attachments the chat shows. */
    | { kind: 'file'; messageId: string; index: number; forward: boolean }
    /** A tapped sticker, by its image URL. */
    | { kind: 'sticker'; url: string }
    /** A held part of an embed's text (EmbedView's onTapCopyText); `field` for a field's name or value. */
    | {
          kind: 'embedText'
          messageId: string
          index: number
          part: EmbedTextPart
          field?: number
          forward: boolean
      }
    /** `<id:route>`: guild home, guide, browse, customize or linked roles. `guildId` is absent outside a server. */
    | { kind: 'nav'; guildId: string | undefined; route: string }
    /** A channel's pinned messages (bindOpenPins). */
    | { kind: 'pins'; channelId: string }
    /** A group DM's settings (bindOpenGdmCustomizeActionSheet). */
    | { kind: 'editGroup'; channelId: string }
    /** A whole search result. */
    | { kind: 'result'; channelId: string; messageId: string }
    /** The media viewer's own: a long press on the media, the alt text button, the speed picker. */
    | {
          kind: 'viewer'
          action: (typeof viewerActions)[number]
          index: number
          origin?: MediaOrigin
      }

export type EmbedTextPart = (typeof embedTextPart)[keyof typeof embedTextPart]

const embedTextParts: string[] = Object.values(embedTextPart)
const isEmbedTextPart = (part: string | undefined): part is EmbedTextPart =>
    part !== undefined && embedTextParts.includes(part)

/** Builds the links JS writes into rows. */
export const chatLink = {
    user: (id: string) => `${linkScheme}${jsKind.user}/${id}`,
    role: (id: string) => `${linkScheme}${jsKind.role}/${id}`,
    /** A channel, or a message in it. `guildId` is absent outside a server. */
    channel: (
        guildId: string | undefined,
        channelId: string,
        messageId?: string,
    ) =>
        `${linkScheme}${linkKind.channel}/${guildId ?? dmGuild}/${channelId}${messageId ? `/${messageId}` : ''}`,
    /** The footer of a forwarded message (handleForwardBreadcrumb). */
    forward: (
        guildId: string | undefined,
        channelId: string,
        messageId: string,
    ) =>
        `${linkScheme}${jsKind.forward}/${guildId ?? dmGuild}/${channelId}/${messageId}`,
    command: (id: string, name: string) =>
        `${linkScheme}${jsKind.command}/${id}/${encodeURIComponent(name)}`,
    nav: (guildId: string | undefined, route: string, item?: string) =>
        `${linkScheme}${jsKind.nav}/${guildId ?? dmGuild}/${route}${item ? `/${item}` : ''}`,
    masked: (url: string) =>
        `${linkScheme}${jsKind.masked}/${encodeURIComponent(url)}`,
    timestamp: (full: string) =>
        `${linkScheme}${jsKind.timestamp}/${encodeURIComponent(full)}`,
    /** MessageEmojiActionSheet's custom emoji. */
    customEmoji: (id: string, name: string, animated: boolean) =>
        `${linkScheme}${jsKind.emoji}/custom/${id}/${encodeURIComponent(name)}/${animated ? 1 : 0}`,
    unicodeEmoji: (text: string) =>
        `${linkScheme}${jsKind.emoji}/unicode/${encodeURIComponent(text)}`,
    /** "Wave to say hi!" under a join message. */
    wave: (messageId: string) => `${linkScheme}${jsKind.wave}/${messageId}`,
    /** "pinned messages" in a pin's system message. */
    pins: (channelId: string) => `${linkScheme}${jsKind.pins}/${channelId}`,
    /** "Edit group" in a group DM's rename and icon change. */
    editGroup: (channelId: string) =>
        `${linkScheme}${jsKind.editGroup}/${channelId}`,
    /** A poll's answer (with `answerId`) or action. */
    poll: (messageId: string, action: PollLinkAction, answerId?: number) =>
        `${linkScheme}${jsKind.poll}/${messageId}/${action}${answerId === undefined ? '' : `/${answerId}`}`,
    dismiss: (messageId: string) =>
        `${linkScheme}${jsKind.dismiss}/${messageId}`,
    /** A blocked or ignored messages group, by its oldest message. */
    reveal: (groupId: string) => `${linkScheme}${jsKind.reveal}/${groupId}`,
    /** A message's button or select, by its component id (`childPath`). */
    component: (messageId: string, componentId: string) =>
        `${linkScheme}${jsKind.component}/${messageId}/${encodeURIComponent(componentId)}`,
    /** A forum post's action bar button. */
    post: (channelId: string, action: PostLinkAction) =>
        `${linkScheme}${jsKind.post}/${channelId}/${action}`,
}

/** Decodes an emoji link's path: `custom/<id>/<name>/<animated>` or `unicode/<characters>`. */
function emojiOf([type, first, name, animated]: string[]):
    | EmojiInfo
    | undefined {
    if (!first) return undefined
    if (type === 'custom' && name)
        return {
            kind: 'custom',
            id: first,
            name: decodeURIComponent(name),
            animated: animated === '1',
        }
    if (type === 'unicode')
        return { kind: 'unicode', text: decodeURIComponent(first) }
    return undefined
}

/** Decodes the `origin=x,y,width,height` query of a media link, undefined when absent or empty. */
function originOf(query: string | undefined): MediaOrigin | undefined {
    if (!query?.startsWith(ORIGIN_QUERY)) return undefined
    const [x, y, width, height] = query
        .slice(ORIGIN_QUERY.length)
        .split(',')
        .map(Number)
    if (x === undefined || y === undefined || !width || !height)
        return undefined
    return { x, y, width, height }
}

/**
 * Decodes a media link: `<messageId>/<index>` for attachments, `<messageId>/<index>[/thumbnail]` for embeds.
 * Component media links are decoded in parseChatLink.
 */
function mediaOf(
    kind: string,
    [messageId, index, part]: string[],
    query: string | undefined,
): ChatLink | undefined {
    if (!messageId) return undefined
    const attachment = kind === linkKind.media || kind === linkKind.forwardMedia
    return {
        kind: 'media',
        messageId,
        selection: attachment
            ? { attachment: Number(index) }
            : part === thumbnailPart
              ? { thumbnail: Number(index) }
              : { embed: Number(index) },
        forward:
            kind === linkKind.forwardMedia ||
            kind === linkKind.forwardEmbedMedia,
        origin: originOf(query),
    }
}

/**
 * Decodes a tapped link. Web links come back as `web`; an in-app link that is malformed or has no action yet is
 * undefined.
 */
export function parseChatLink(url: string): ChatLink | undefined {
    if (!url.startsWith(linkScheme)) {
        const channel = parseDiscordChannelUrl(url)
        if (channel?.channelId)
            return {
                kind: 'channel',
                channelId: channel.channelId,
                messageId: channel.messageId,
            }
        const invite = parseDiscordInviteUrl(url)
        if (invite) return { kind: 'invite', ...invite }
        return { kind: 'web', url }
    }
    const [path = '', query] = url.slice(linkScheme.length).split('?', 2)
    const [kind = '', ...parts] = path.split('/')
    const [first, second, third] = parts
    switch (kind) {
        case linkKind.react:
        case linkKind.reactions:
            // <messageId>/<emoji>[/burst]
            return first && second
                ? {
                      kind: kind === linkKind.react ? 'react' : 'reactions',
                      messageId: first,
                      emojiKey: decodeURIComponent(second),
                      burst: third === burstPart,
                  }
                : undefined
        case linkKind.addReaction:
            return first ? { kind: 'addReaction', messageId: first } : undefined
        case linkKind.retry:
            return first ? { kind: 'retry', nonce: first } : undefined
        case linkKind.channel:
            // <guildId|@me>/<channelId>[/<messageId>]
            return second
                ? { kind: 'channel', channelId: second, messageId: third }
                : undefined
        case jsKind.forward:
            return second && third
                ? { kind: 'channel', channelId: second, messageId: third }
                : undefined
        case jsKind.emoji: {
            const emoji = emojiOf(parts)
            return emoji && { kind: 'emoji', emoji }
        }
        case jsKind.timestamp:
            return first
                ? { kind: 'timestamp', text: decodeURIComponent(first) }
                : undefined
        case linkKind.componentMedia:
        case linkKind.forwardComponentMedia:
            // <messageId>/<component id>/<item>
            return first && second
                ? {
                      kind: 'media',
                      messageId: first,
                      selection: {
                          component: Number(second),
                          item: Number(third ?? 0),
                      },
                      forward: kind === linkKind.forwardComponentMedia,
                      origin: originOf(query),
                  }
                : undefined
        case linkKind.media:
        case linkKind.embedMedia:
        case linkKind.forwardMedia:
        case linkKind.forwardEmbedMedia:
            return mediaOf(kind, parts, query)
        case linkKind.author: {
            const part = second ? headerPartOf(second) : undefined
            return first && part
                ? { kind: 'author', messageId: first, part }
                : undefined
        }
        case jsKind.masked:
            return first
                ? { kind: 'masked', url: decodeURIComponent(first) }
                : undefined
        case jsKind.user:
            return first ? { kind: 'user', userId: first } : undefined
        case jsKind.role:
            return first ? { kind: 'role', roleId: first } : undefined
        case jsKind.command:
            // <id>/<name>
            return first && second
                ? {
                      kind: 'command',
                      id: first,
                      name: decodeURIComponent(second),
                  }
                : undefined
        case linkKind.inlineCode:
            return first !== undefined
                ? { kind: 'inlineCode', text: decodeURIComponent(first) }
                : undefined
        case linkKind.file:
        case linkKind.forwardFile:
            // <messageId>/<index>
            return first && second
                ? {
                      kind: 'file',
                      messageId: first,
                      index: Number(second),
                      forward: kind === linkKind.forwardFile,
                  }
                : undefined
        case linkKind.sticker:
            return first
                ? { kind: 'sticker', url: decodeURIComponent(first) }
                : undefined
        case linkKind.embedText:
        case linkKind.forwardEmbedText: {
            // <messageId>/<embed>/<part>[/<field>]
            const field = parts[3]
            return first && second && isEmbedTextPart(third)
                ? {
                      kind: 'embedText',
                      messageId: first,
                      index: Number(second),
                      part: third,
                      field: field === undefined ? undefined : Number(field),
                      forward: kind === linkKind.forwardEmbedText,
                  }
                : undefined
        }
        case jsKind.nav:
            // <guildId|@me>/<route>[/<item>]
            return second
                ? {
                      kind: 'nav',
                      guildId: first === dmGuild ? undefined : first,
                      route: second,
                  }
                : undefined
        case jsKind.pins:
            return first ? { kind: 'pins', channelId: first } : undefined
        case jsKind.editGroup:
            return first ? { kind: 'editGroup', channelId: first } : undefined
        case jsKind.poll:
            // <messageId>/<action>[/<answerId>]
            return first && isPollAction(second)
                ? {
                      kind: 'poll',
                      messageId: first,
                      action: second,
                      answerId: third === undefined ? undefined : Number(third),
                  }
                : undefined
        case jsKind.dismiss:
            return first ? { kind: 'dismiss', messageId: first } : undefined
        case jsKind.reveal:
            return first ? { kind: 'reveal', groupId: first } : undefined
        case jsKind.component:
            // <messageId>/<component id>
            return first && second
                ? {
                      kind: 'component',
                      messageId: first,
                      componentId: decodeURIComponent(second),
                  }
                : undefined
        case jsKind.post:
            // <channelId>/<action>
            return first && isPostAction(second)
                ? { kind: 'post', channelId: first, action: second }
                : undefined
        case linkKind.result:
            return first && second
                ? { kind: 'result', channelId: first, messageId: second }
                : undefined
        case linkKind.viewer: {
            const action = viewerActions.find(known => known === first)
            return action
                ? {
                      kind: 'viewer',
                      action,
                      index: Number(second),
                      origin: originOf(query),
                  }
                : undefined
        }
        default:
            // `wave` needs the write path.
            return undefined
    }
}
