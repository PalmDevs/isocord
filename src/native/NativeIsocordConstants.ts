import { TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'

/** Values native code owns and JS reads (ConstantsModule.kt). */
export interface Spec extends TurboModule {
    getConstants(): {
        /** The scheme of in-app links (`Links.SCHEME`). */
        linkScheme: string
        /** The query key of a media link, `origin=x,y,width,height` (`Links.ORIGIN_PARAM`). */
        originParam: string
        /** The last path part of an embed media link naming the corner thumbnail (`Links.THUMBNAIL_PART`). */
        thumbnailPart: string
        /** The last path part of a reaction link naming the super reaction chip (`Links.BURST_PART`). */
        burstPart: string
        /** The first path part of the in-app links native views build (`LinkKind`). */
        linkKind: {
            addReaction: string
            author: string
            channel: string
            componentMedia: string
            embedMedia: string
            embedText: string
            file: string
            forwardEmbedMedia: string
            forwardEmbedText: string
            forwardFile: string
            forwardMedia: string
            inlineCode: string
            media: string
            sticker: string
            react: string
            reactions: string
            result: string
            retry: string
            viewer: string
        }
        /** The part of an embed an `embed-text` link names (`EmbedTextPart`). */
        embedTextPart: {
            provider: string
            author: string
            title: string
            description: string
            fieldName: string
            fieldValue: string
            footer: string
        }
        /** The media viewer's own link actions (`ViewerAction`). */
        viewerAction: { options: string; alt: string }
        /** ChatInputNodeType of the reference, plus our markdown (`NodeType` in StyleBlocks.kt). */
        nodeType: {
            EMOJI_HIGHLIGHT: number
            USER_HIGHLIGHT: number
            ROLE_HIGHLIGHT: number
            CHANNEL_HIGHLIGHT: number
            SILENT_HIGHLIGHT: number
            MARKDOWN: number
        }
        /** What swiping a message may do, a row's `swipe` (`SwipeMode`). */
        swipeMode: { reply: string; replyEdit: string }
        /** The `action` of a message swipe event (`SwipeAction`). */
        swipeAction: { reply: string; edit: string }
        /** The guild part of a channel link outside a server (`Links.DM_GUILD`). */
        dmGuild: string
        /** The kinds under "Notify me about" (`NotificationKind`). */
        notificationKind: {
            calls: string
            directMessages: string
            friendRequests: string
            reactions: string
            messages: string
            forumPosts: string
            events: string
            systemMessages: string
        }
        /** The chat's message avatar, in dp. */
        avatarSize: number
        /** A reaction chip's height, in dp (`REACTION_CHIP_HEIGHT`). */
        reactionChipHeight: number
        /** Android versionCode of the reference APK (`ClientBuild`). */
        clientVersionCode: number
        /** versionName of the reference APK, such as "353.11". */
        clientVersionName: string
        /** Discord's endpoints (`Discord`). */
        discord: {
            apiVersion: number
            apiBase: string
            gatewayUrl: string
            websocketOrigin: string
            cdnBase: string
            webUrl: string
        }
        /** The request header that names the cookie jar (`ScopedCookieJar.SCOPE_HEADER`). */
        cookieScopeHeader: string
        /** The scope name of an account's cookie jar, followed by its user id (`ScopedCookieJar.ACCOUNT_PREFIX`). */
        accountCookieScopePrefix: string
        /** What the uploader's upload ids, rejections and progress events say (`UploaderWire`). */
        uploader: {
            idSeparator: string
            errorCancelled: string
            errorFailed: string
            errorHttpPrefix: string
            phaseCompress: string
            phaseUpload: string
        }
        /** The viewer's timings, in ms, which the JS header fades follow (`ViewerMotion`). */
        viewerMotion: {
            entranceMs: number
            overlayInMs: number
            overlayOutMs: number
        }
        /** The spring that moves the room of the typing indicator, in the list and in JS (`TypingInsetSpring`). */
        typingInsetSpring: { mass: number; damping: number; stiffness: number }
        /** The expression grid's `kind` prop and item flags (`GridKindName`, `GridItemFlag`). */
        expressionGrid: {
            kindEmoji: string
            kindSticker: string
            itemAnimated: number
            itemLocked: number
        }
        /** The category tile icons of the GIF grid (GifTileIcon). */
        gifGrid: {
            iconTrending: string
            iconFavorites: string
        }
        /** The chat input's line height, in dp (`INPUT_LINE_HEIGHT_DP`). */
        chatInputLineHeight: number
        /** The longest the native list takes to scroll to a row, in ms (`LONGEST_SCROLL_MS`). */
        longestScrollMs: number
        /** Choices both gateway connections make (NotificationGateway.kt): reconnect backoff and the QoS payload version. */
        gateway: {
            minBackoffMs: number
            maxBackoffMs: number
            qosVersion: number
        }
    }
}

const NativeIsocordConstants =
    TurboModuleRegistry.getEnforcing<Spec>('IsocordConstants')

export const {
    linkScheme,
    originParam,
    thumbnailPart,
    burstPart,
    linkKind,
    embedTextPart,
    viewerAction,
    nodeType,
    swipeMode,
    swipeAction,
    dmGuild,
    notificationKind,
    avatarSize,
    reactionChipHeight,
    clientVersionCode,
    clientVersionName,
    discord,
    cookieScopeHeader,
    accountCookieScopePrefix,
    uploader,
    viewerMotion,
    typingInsetSpring,
    expressionGrid,
    gifGrid,
    chatInputLineHeight,
    longestScrollMs,
    gateway,
} = NativeIsocordConstants.getConstants()
