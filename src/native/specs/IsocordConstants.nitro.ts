import type { HybridObject } from 'react-native-nitro-modules'

export interface LinkKindConstants {
    addReaction: string
    author: string
    channel: string
    componentMedia: string
    embedMedia: string
    embedText: string
    file: string
    forwardComponentMedia: string
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

export interface EmbedTextPartConstants {
    provider: string
    author: string
    title: string
    description: string
    fieldName: string
    fieldValue: string
    footer: string
}

export interface ViewerActionConstants {
    options: string
    alt: string
    speed: string
}

export interface NodeTypeConstants {
    EMOJI_HIGHLIGHT: number
    USER_HIGHLIGHT: number
    ROLE_HIGHLIGHT: number
    CHANNEL_HIGHLIGHT: number
    SILENT_HIGHLIGHT: number
    MARKDOWN: number
}

export interface SwipeModeConstants {
    reply: string
    replyEdit: string
}

export interface SwipeActionConstants {
    reply: string
    edit: string
}

export interface NotificationKindConstants {
    calls: string
    directMessages: string
    friendRequests: string
    reactions: string
    messages: string
    forumPosts: string
    events: string
    systemMessages: string
}

export interface DiscordConstants {
    apiVersion: number
    apiBase: string
    gatewayUrl: string
    websocketOrigin: string
    cdnBase: string
    webUrl: string
}

export interface UploaderConstants {
    idSeparator: string
    errorCancelled: string
    errorFailed: string
    errorHttpPrefix: string
    phaseCompress: string
    phaseUpload: string
}

export interface ViewerMotionConstants {
    entranceMs: number
    overlayInMs: number
    overlayOutMs: number
}

export interface TypingInsetSpringConstants {
    mass: number
    damping: number
    stiffness: number
}

export interface ExpressionGridConstants {
    kindEmoji: string
    kindSticker: string
    itemAnimated: number
    itemLocked: number
}

export interface GifGridConstants {
    iconTrending: string
    iconFavorites: string
}

export interface GatewayConstants {
    minBackoffMs: number
    maxBackoffMs: number
    qosVersion: number
}

export interface ConstantsMap {
    /** The first screen's native ID for Android's splash draw gate. */
    splashContentNativeId: string
    /** The scheme of in-app links (`Links.SCHEME`). */
    linkScheme: string
    /** The query key of a media link, `origin=x,y,width,height` (`Links.ORIGIN_PARAM`). */
    originParam: string
    /** The last path part of an embed media link naming the corner thumbnail (`Links.THUMBNAIL_PART`). */
    thumbnailPart: string
    /** The last path part of a reaction link naming the super reaction chip (`Links.BURST_PART`). */
    burstPart: string
    /** The first path part of the in-app links native views build (`LinkKind`). */
    linkKind: LinkKindConstants
    /** The part of an embed an `embed-text` link names (`EmbedTextPart`). */
    embedTextPart: EmbedTextPartConstants
    /** The media viewer's own link actions (`ViewerAction`). */
    viewerAction: ViewerActionConstants
    /** ChatInputNodeType of the reference, plus our markdown (`NodeType` in StyleBlocks.kt). */
    nodeType: NodeTypeConstants
    /** What swiping a message may do, a row's `swipe` (`SwipeMode`). */
    swipeMode: SwipeModeConstants
    /** The `action` of a message swipe event (`SwipeAction`). */
    swipeAction: SwipeActionConstants
    /** The guild part of a channel link outside a server (`Links.DM_GUILD`). */
    dmGuild: string
    /** The kinds under "Notify me about" (`NotificationKind`). */
    notificationKind: NotificationKindConstants
    /** The chat's message avatar, in dp. */
    avatarSize: number
    /** A reaction chip's height, in dp (`REACTION_CHIP_HEIGHT`). */
    reactionChipHeight: number
    /** Android versionCode of the reference APK (`ClientBuild`). */
    clientVersionCode: number
    /** versionName of the reference APK, such as "353.11". */
    clientVersionName: string
    /** Discord's endpoints (`Discord`). */
    discord: DiscordConstants
    /** The request header that names the cookie jar (`ScopedCookieJar.SCOPE_HEADER`). */
    cookieScopeHeader: string
    /** The scope name of an account's cookie jar, followed by its user id (`ScopedCookieJar.ACCOUNT_PREFIX`). */
    accountCookieScopePrefix: string
    /** What the uploader's upload ids, rejections and progress events say (`UploaderWire`). */
    uploader: UploaderConstants
    /** The viewer's timings, in ms, which the JS header fades follow (`ViewerMotion`). */
    viewerMotion: ViewerMotionConstants
    /** The spring that moves the room of the typing indicator, in the list and in JS (`TypingInsetSpring`). */
    typingInsetSpring: TypingInsetSpringConstants
    /** The expression grid's `kind` prop and item flags (`GridKindName`, `GridItemFlag`). */
    expressionGrid: ExpressionGridConstants
    /** The category tile icons of the GIF grid (GifTileIcon). */
    gifGrid: GifGridConstants
    /** The chat input's line height, in dp (`INPUT_LINE_HEIGHT_DP`). */
    chatInputLineHeight: number
    /** The longest the native list takes to scroll to a row, in ms (`LONGEST_SCROLL_MS`). */
    longestScrollMs: number
    /** Choices both gateway connections make (NotificationGateway.kt): reconnect backoff and the QoS payload version. */
    gateway: GatewayConstants
    /** The first adjusted system locale, as a BCP 47 tag (DeviceLocaleModule's `Language`). */
    systemLanguage: string
}

/** Values native code owns and JS reads (HybridIsocordConstants.kt). */
export interface IsocordConstants extends HybridObject<{ android: 'kotlin' }> {
    getConstants(): ConstantsMap
}
