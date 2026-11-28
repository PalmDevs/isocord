/**
 * The contract between JS and the native chat renderer
 * (android/app/src/main/java/me/palmdevs/isocord/chat). JS decides what every
 * row says and looks like; the renderer only lays rows out and draws them.
 * Colours are signed 32-bit ARGB integers (`Color(int)` in Kotlin), as `argb` and `rgbInt` in color.ts build them.
 * ChatRows.kt decodes these shapes. Change both together.
 */

/** A run of message text with one set of styles. */
export interface Span {
    text: string
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strike?: boolean
    /** Inline code, or a code block when `block` is also set. */
    code?: boolean
    block?: boolean
    /** Tappable; reported through `onLinkPress`. */
    link?: string
    /** User, role or channel mention pill. */
    mention?: boolean
    /** Overrides the text colour (role mentions). */
    color?: number
    /** Two or three colours the text of a role mention is painted with (enhanced role colours); `color` is the first. */
    colors?: number[]
    /** An inline icon drawn in place of `text`, in the mention colour: a channel type, `message`, `caret` or a route. */
    icon?: string
    /** Image drawn in place of `text` (custom emoji). */
    emoji?: string
    quote?: boolean
    heading?: 1 | 2 | 3
    /** Nesting depth, from 1, of the list item the run belongs to. */
    list?: number
    /** The first run of a list item, drawn as its marker. Its text is the marker as plain text, for reply previews. */
    bullet?: boolean
    /** Numbered list markers: the item's number. */
    number?: number
    /** Numbered list markers: the list's largest number, which sets the marker column's width. */
    lastNumber?: number
    spoiler?: boolean
    /** `-# ` line: small, muted text. */
    subtext?: boolean
    /** `<t:…>` pill. */
    timestamp?: boolean
    /** Syntax colour inside a code block. */
    token?: SyntaxToken
    /** A word of the search query (search results only). */
    highlight?: boolean
}

export type SyntaxToken =
    | 'keyword'
    | 'string'
    | 'number'
    | 'comment'
    | 'title'
    | 'meta'

export interface AttachmentRow {
    /** Images and videos form the message's mosaic gallery; voice is a voice message. */
    kind: 'image' | 'video' | 'audio' | 'voice' | 'file'
    /** Images: a thumbnail sized for the list. Everything else: the file itself. */
    url: string
    /** Videos: a still of the first frame. */
    posterUrl?: string
    filename: string
    /** Human-readable size, for files. */
    size: string
    width: number
    height: number
    /** Set (to the localised "SPOILER" label) when the media is hidden until tapped. */
    spoiler?: string
    /** Alt text, and the localised "ALT" label drawn on the media. */
    description?: string
    altLabel?: string
    /** Audio and voice messages. */
    durationSecs?: number
    /** Voice messages: base64 of up to 256 amplitude bytes. */
    waveform?: string
}

export interface MediaRow {
    url: string
    width: number
    height: number
    /** Gallery images: the index in `message.embeds` the image came from (`isocord://embed-media/<id>/<index>`). */
    source?: number
}

export interface EmbedRow {
    /** Media only (image, GIF and video links): drawn like an attachment, without the card. */
    media: boolean
    /** Index in `message.embeds`, which tapping the media reports (embeds sharing a url are merged, so it can skip). */
    source?: number
    /** Set (to the localised "SPOILER" label) when the link was written in a spoiler: the media is hidden until tapped. */
    spoiler?: string
    /** Colour of the bar down the leading edge. */
    color?: number
    provider?: string
    providerUrl?: string
    authorName?: string
    authorIconUrl?: string
    authorUrl?: string
    /** Markdown spans (the reference's embed title rules). */
    title?: Span[]
    /** Opened when the title is tapped. */
    url?: string
    description: Span[]
    /** Inline fields sit side by side, up to three to a row. */
    fields: Array<{ name: Span[]; value: Span[]; inline: boolean }>
    /** Drawn full width under the text. */
    image?: MediaRow
    /** Several embeds with one url (a post with more pictures): a gallery drawn in place of `image`. */
    images?: MediaRow[]
    /** Drawn small in the top corner. */
    thumbnail?: MediaRow
    /** A video file played over `image`: tap to play, or with `gifv` autoplayed muted on a loop. */
    videoUrl?: string
    gifv?: boolean
    /** A play button over `image` that opens this link (YouTube and other hosted players). */
    playLink?: string
    footer?: string
    footerIconUrl?: string
}

export interface StickerRow {
    name: string
    url: string
    /** Lottie stickers are JSON animations; everything else is an image. */
    lottie: boolean
}

export interface ReactionRow {
    /** The emoji as reaction URLs carry it: the character, or `name:id` for a custom one. */
    key: string
    /** Unicode emoji, or the name of a custom one. */
    emoji: string
    emojiUrl?: string
    /** The super reaction chip's count and `me` when `burst`, else the normal reaction's. */
    count: number
    me: boolean
    /** A super reaction chip (ReactionView.isBurstReaction): its taps and holds name it with `/burst`. */
    burst?: boolean
    /** A super reaction's colours in each theme (buildPlatformedThemedEmojiColorPalette); the chat's own without. */
    burstColors?: { light: BurstColors; dark: BurstColors }
}

/** ReactionView.BurstColorPalette: the count, the emoji tint and the border; the fill with its opacity applied. */
export interface BurstColors {
    accent?: number
    background?: number
}

/** PollStyles' style sets, by formatPollMessageChatData's answer state. */
export type PollAnswerStyle =
    | 'normalVote'
    | 'selected'
    | 'voted'
    | 'notVoted'
    | 'victorSelected'
    | 'victorNotSelected'
    | 'loserSelected'

/** A poll's action (PollAction): a filled or secondary button, a brand text button, or plain text. */
export interface PollActionRow {
    label: string
    presentation: 'button' | 'secondaryButton' | 'textButton' | 'text'
    /** Absent: shown disabled (a button) or not tappable (text). */
    url?: string
}

export interface PollRow {
    question: string
    /** promptLabel: "Select one answer" or "Select one or more answers". Absent once closed or outside its chat. */
    hint?: string
    answers: Array<{
        text: string
        emoji?: string
        emojiUrl?: string
        /** "3 votes". */
        votes: string
        percent: number
        style: PollAnswerStyle
        /** Selects the answer, or lists its voters once results show. Absent outside the poll's chat. */
        url?: string
    }>
    /** PollChatAnswerInteractionType: the marker drawn on each answer. `list` draws one only for a vote. */
    interaction: 'list' | 'radio' | 'checkbox'
    /** canShowVoteCounts: vote counts and bars are drawn. */
    showResults: boolean
    /** Vote, Remove Vote or Go back to vote, at the end of the footer. */
    primary?: PollActionRow
    /** "12 votes • 3 hours left" (lists the voters), or "View original message to interact". */
    secondary?: PollActionRow
    /** "Show results", after the votes line. */
    tertiary?: PollActionRow
}

/** createExecutedCommand: "{username} used {commandName}" above an interaction response. */
export interface InteractionRow {
    /** The user who ran the command, drawn 16dp before the line. */
    avatarUrl?: string
    authorColor?: number
    authorColors?: number[]
    /** The user's profile (bindUserMenu): a tap on the avatar or name. */
    userUrl?: string
    /** The line in order: the name, the command (on a mention pill) and the text around them. */
    parts: Array<{ text: string; role?: 'name' | 'command' }>
}

/** EphemeralIndication: the eye icon and "Only you can see this • Dismiss message", the dismiss part a link. */
export interface EphemeralRow {
    parts: Array<{ text: string; url?: string }>
}

/** A select's picked option, drawn in place of its placeholder (SelectComponentView's selected items). */
export interface SelectedOptionRow {
    label: string
    emoji?: string
    emojiUrl?: string
    /** A user's avatar: drawn round. */
    round?: boolean
}

/**
 * One node of a message's components tree (v1 action rows and v2 layout), as transformMessageComponents makes it.
 * Unknown types are left out in JS, so every node here has a view.
 */
export interface ComponentRow {
    type:
        | 'row'
        | 'button'
        | 'select'
        | 'container'
        | 'section'
        | 'text'
        | 'thumbnail'
        | 'gallery'
        | 'separator'
        | 'file'
    style?: 'primary' | 'secondary' | 'success' | 'danger' | 'link' | 'premium'
    /** Button label, or select placeholder. */
    label?: string
    emoji?: string
    emojiUrl?: string
    /** The API's `disabled`, or ActionComponentState.DISABLED while another component of the message runs. */
    disabled?: boolean
    /** ActionComponentState.LOADING: this button or select's interaction is on its way. Dots replace the label. */
    loading?: boolean
    /** The tap: a link button's web page, or `isocord://component/<message>/<component>`. Absent: not tappable. */
    url?: string
    /** Rows and sections: getLayoutComponentErrorText, under the failed component. */
    errorText?: string
    /** Selects: the options picked, by the user or the select's defaults. */
    selected?: SelectedOptionRow[]
    /** Selects with max_values over 1: picks are pills. */
    multi?: boolean
    spans?: Span[]
    /** Container accent bar. */
    color?: number
    /** Separators: a 1px line, and the space around it (SeparatorSpacingSize). */
    divider?: boolean
    spacing?: 'small' | 'large'
    /** Containers: the "SPOILER" label while hidden until tapped. */
    spoiler?: string
    children?: ComponentRow[]
    /** Section accessory: a `thumbnail` or a `button`. */
    accessory?: ComponentRow
    /** Galleries and thumbnails: the component id a `component-media` link names. */
    mediaId?: number
    /** Gallery items, and a thumbnail's or file's media, drawn as attachments are. */
    items?: AttachmentRow[]
}

export interface ForwardRow {
    label: string
    content: Span[]
    attachments: AttachmentRow[]
    embeds: EmbedRow[]
    components?: ComponentRow[]
    /**
     * MessageForward.getForwardInfo footerInfo.originLabel: "#channel" (or the DM's name) when the source is in the
     * same server or DM space and readable, else the source server's name. No footer without it.
     */
    origin?: string
    /** footerInfo.originIconUrl: the source server's icon (16), only with a server name. */
    originIconUrl?: string
    /** footerInfo.timestampLabel: when the original was sent (calendarFormatCompact). */
    timestamp?: string
    /** footerInfo.accessibilityLabel: "Message originally sent in {origin} at {timestamp}". */
    accessibilityLabel?: string
    /** isocord://forward/<guild|@me>/<channel>/<message>: the source message (handleForwardBreadcrumb). */
    url?: string
}

interface ClanTagRow {
    tag: string
    badgeUrl?: string
}

/** The preview above a reply. */
export interface ReplyRow {
    /** `loaded` shows the author; the others show only `text` as a muted note (deleted, not loaded, blocked). */
    state: 'loaded' | 'note'
    authorName?: string
    authorColor?: number
    authorColors?: number[]
    authorAvatarUrl?: string
    /** The reply pings the author: "@" before the name. */
    mention?: boolean
    clanTag?: ClanTagRow
    /** The message's text as plain text, or the note. */
    text: string
    /**
     * The message's text on one line as spans (mentions, emoji, links...), drawn in place of `text`; the whole preview
     * stays one tap target. Absent for notes and attachment-only replies.
     */
    spans?: Span[]
    /** The replied-to message has no text: `text` is "Click to see attachment" and an image icon leads. */
    attachment?: boolean
    /** Reported through onLinkPress when the preview is tapped (`isocord://channel/<guild>/<channel>/<message>`). */
    url?: string
}

/** ThreadEmbedMessageAccessory: the card under a message a thread was started from. */
export interface ThreadEmbedRow {
    name: string
    /** "{count} ›", or "See Thread ›" without messages (formatMobileMessageCountLabel). */
    countLabel: string
    /** The newest message's author, drawn before its text. Absent when `preview` is a note. */
    authorName?: string
    authorColor?: number
    authorAvatarUrl?: string
    /** The newest message on one line, or a note ("There are no messages in this thread yet."). */
    preview: Span[]
    /** Icon after the preview text (PreviewIcon names, drawn by ThreadEmbedCard.kt). */
    trailingIcon?: string
    /** The preview is a note: drawn in italics. */
    note: boolean
    /** Opens the thread (onTapThreadEmbed): `isocord://channel/<guild>/<thread>`. */
    url: string
}

export interface MessageRow {
    type: 'message'
    key: string
    id: string
    /** Continues the previous message's group: no avatar or header. */
    grouped: boolean
    /** The thread started from this message (HAS_THREAD). */
    thread?: ThreadEmbedRow
    authorName: string
    authorColor?: number
    /** Gradient (or holographic) username: two or three colours, left to right. */
    authorColors?: number[]
    avatarUrl: string
    /** Ring drawn around the avatar. */
    avatarDecorationUrl?: string
    /** Server tag chip after the name. */
    clanTag?: ClanTagRow
    /** Highest role icon: a custom image or a unicode emoji. */
    roleIcon?: { url?: string; emoji?: string }
    bot: boolean
    /** getTagProperties' opTagText: the localised "OP" tag of a forum post's owner. */
    originalPoster?: string
    timestamp: string
    /** SUPPRESS_NOTIFICATIONS: the localised "Silent message" label of the bell (the header's suppress_notifications_icon) after the timestamp. */
    silent?: string
    content: Span[]
    /** The localised "(edited)" label, when the message was edited. */
    edited?: string
    /** Emoji-only message, drawn larger. */
    jumbo: boolean
    /** Mentions the current user; drawn highlighted. */
    mentioned: boolean
    reply?: ReplyRow
    attachments: AttachmentRow[]
    embeds: EmbedRow[]
    stickers: StickerRow[]
    reactions: ReactionRow[]
    /** Shows the add reaction button after the reactions. */
    addReaction?: boolean
    poll?: PollRow
    components?: ComponentRow[]
    forward?: ForwardRow
    /** "<user> used /command" line above an interaction response. */
    executedCommand?: InteractionRow
    /** "Only you can see this • Dismiss message" under an ephemeral message. */
    ephemeralIndication?: EphemeralRow
    /** A message the user is sending: drawn dimmed; a failed one carries `statusLabel` in red, tapped to retry. */
    status?: 'sending' | 'failed'
    statusLabel?: string
    /**
     * A `swipeMode`: swiping the message left replies to it, and with `replyEdit` a longer pull edits it. Absent: the
     * message cannot be swiped.
     */
    swipe?: string
}

interface SeparatorRow {
    type: 'separator'
    key: string
    text: string
    /** The "NEW" divider after the last read message: drawn in the unread colours. */
    unread?: boolean
}

/** SystemMessageView.getIconAndColor's icons (ReactAsset names), drawn from the `system_*` drawables. */
export type SystemIcon =
    | 'arrowRight'
    | 'arrowLeft'
    | 'pencil'
    | 'reaction'
    | 'pin'
    | 'ticket'
    | 'boost'
    | 'announcements'
    | 'x'
    | 'checkmark'
    | 'circleError'
    | 'thread'
    | 'stage'
    | 'microphoneArrowRight'
    | 'handRequestSpeak'
    | 'lock'
    | 'lockUnlocked'
    | 'polls'
    | 'refresh'
    | 'gameController'
    | 'voice'
    | 'userCheck'

/** SystemMessageView's icon colours, each a `systemIcon*` colour of the chat theme. */
export type SystemTint =
    | 'positive'
    | 'danger'
    | 'warning'
    | 'boost'
    | 'normal'
    | 'muted'

/** CallSystemMessageView: a DM call as a card. The row's `content` is its title. */
export interface CallRow {
    /** PhoneHangUpIcon in the disconnected colour. Otherwise PhoneCallIcon. */
    missed: boolean
    /** PhoneCallIcon in the connected colour, and no description. */
    active: boolean
    /** "{duration} — {time}", or the time. While active, "— Tap to join" after the timer, or nothing. */
    description?: string
    /** OverlappingCirclesView: the caller, or the people in an ongoing call. */
    avatarUrls: string[]
    /** While active, when the call started (`rawMilliseconds`, epoch ms): native ticks the elapsed time. */
    startedAt?: number
    /** What a tap opens (`chatLink.callMessage`). */
    url: string
}

/** The flagged message under an AutoMod action (FlaggedMessageEmbedAccessory). */
export interface FlaggedMessageRow {
    authorName: string
    authorColor?: number
    avatarUrl: string
    content: Span[]
    /** "Keyword: {keyword}" and "Rule: {ruleName}" (FlaggedMessageEmbedFooterView). */
    keyword?: string
    rule?: string
    /** Jumps to the flagged message. */
    url: string
}

/**
 * AutomodSystemMessageView and the AutoMod-authored incident messages: an author line for AutoMod, the row's
 * `content` below it, the channel and the flagged message.
 */
export interface AutomodRow {
    /** "AutoMod". */
    name: string
    /** "OFFICIAL". */
    badge: string
    /** The flagged message's channel, "#name". */
    channel?: string
    flagged?: FlaggedMessageRow
}

/** A system message (SystemMessageView): an icon in the avatar column, the text, the time and the reactions. */
export interface SystemRow {
    type: 'system'
    key: string
    id: string
    icon: SystemIcon
    tint: SystemTint
    /** Links are drawn medium in their `color`, or the text colour; `bold` spans bold. */
    content: Span[]
    timestamp: string
    reactions: ReactionRow[]
    /** Shows the add reaction button after the reactions. */
    addReaction: boolean
    /** "Wave to say hi!" under a join; reported through onLinkPress (`isocord://wave/<messageId>`). */
    waveLabel?: string
    waveUrl?: string
    /** The thread started from this message (THREAD_CREATED with HAS_THREAD). */
    thread?: ThreadEmbedRow
    /** Drawn as a call card instead (CALL). */
    call?: CallRow
    /** Drawn as an AutoMod message instead. */
    automod?: AutomodRow
}

/**
 * Skeleton messages, or a spinner: at the oldest end while older history loads (`onLoadOlder` is asked for more
 * while it is last), at the newest end while a detached window loads newer pages (`onLoadNewer` while it is first).
 */
interface LoadingRow {
    type: 'loading'
    key: string
    /** Skeleton messages (first load, nothing to show yet) instead of the older-history spinner. */
    placeholder?: boolean
}

/** The start of a channel's history ("Welcome to #channel"); the last row of the list. */
interface WelcomeRow {
    type: 'welcome'
    key: string
    /** Round avatar of the other user in a 1:1 DM. */
    avatarUrl?: string
    /** Mention icon name drawn in the icon square ("text", "thread", "post"). */
    icon?: string
    /** Text drawn in the icon square when there is no icon or avatar ("@" for a group DM). */
    glyph?: string
    title: string
    /** DM: the @username under the name. */
    handle?: string
    /** Absent for threads and forum posts, which show only their name. */
    subtitle?: string
    /** A forum post's applied tags. */
    tags?: WelcomeTag[]
}

/** An applied forum tag (ForumPostAppliedTags): its name and emoji image. */
interface WelcomeTag {
    id: string
    name: string
    emojiUrl?: string
}

/** A button of the post actions row: its icon's accessibility label and its link. */
interface PostActionButton {
    label: string
    url: string
    /** Text drawn beside the icon. */
    text?: string
}

/**
 * ForumPostActionBarView: under a forum post's first message, the message's reactions, then Follow, Copy Link and
 * Jump To Top. Pinned to the top of the list once scrolled past (ChatViewStickyHeader).
 */
export interface PostActionsRow {
    type: 'postActions'
    key: string
    /** The post's first message, whose reactions are shown (its id is the post's). */
    messageId: string
    reactions: ReactionRow[]
    addReaction: boolean
    /** additionalNonUniqueReactionCount: users behind the reactions left out, drawn as "+N". */
    moreCount: number
    /** The first reaction left out, whose reactions sheet "+N" opens. */
    moreKey?: string
    /** The user follows the post: the follow button shows UserMinusIcon instead of BellIcon. */
    following: boolean
    follow: PostActionButton
    copyLink: PostActionButton
    jumpToTop: PostActionButton
    /** The first message is not loaded: the row is only drawn pinned to the top. */
    pinnedOnly?: boolean
}

/**
 * BlockedMessageGroupView: a run of messages from users you blocked or ignored, folded behind "N blocked messages".
 * The messages are sent while folded too, so revealing them animates.
 */
export interface HiddenGroupRow {
    type: 'hiddenGroup'
    key: string
    /** "{count} blocked messages" or "{count} ignored messages". */
    text: string
    revealed: boolean
    /** isocord://reveal/<id>: shows or hides the messages (handleReveal). */
    url: string
    /** Newest first, as the list. */
    messages: Array<MessageRow | SystemRow>
}

export type ChatRow =
    | MessageRow
    | HiddenGroupRow
    | SeparatorRow
    | SystemRow
    | LoadingRow
    | WelcomeRow
    | PostActionsRow
