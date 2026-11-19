import type { Message } from '../readStates'

export interface Attachment {
    id: string
    filename: string
    size: number
    url: string
    proxy_url: string
    width?: number | null
    height?: number | null
    content_type?: string
    /** Alt text. */
    description?: string
    /** Attachment flags: IS_SPOILER = 1 << 3. */
    flags?: number
    /** Voice messages. */
    duration_secs?: number
    /** Voice messages: base64 of up to 256 amplitude bytes. */
    waveform?: string
}

export interface EmbedMedia {
    url: string
    proxy_url?: string
    width?: number | null
    height?: number | null
}

export interface Embed {
    type?: string
    title?: string
    description?: string
    url?: string
    color?: number
    timestamp?: string
    provider?: { name?: string; url?: string }
    author?: { name?: string; url?: string; proxy_icon_url?: string }
    footer?: { text?: string; proxy_icon_url?: string }
    image?: EmbedMedia
    thumbnail?: EmbedMedia
    video?: EmbedMedia
    fields?: Array<{ name: string; value: string; inline?: boolean }>
}

export interface StickerItem {
    id: string
    name: string
    format_type: number
}

export interface Reaction {
    emoji: { id: string | null; name: string | null; animated?: boolean }
    /** Normal and super reactions together. */
    count: number
    /** The user made a normal reaction. */
    me: boolean
    /** How many of `count` are each kind. Absent on reactions made before super reactions. */
    count_details?: { normal: number; burst: number }
    /** The user made a super reaction. */
    me_burst?: boolean
    /** `#rrggbb` colours a super reaction is drawn with. */
    burst_colors?: string[]
}

/** A message's poll as the API sends it. */
export interface MessagePoll {
    question: { text?: string }
    answers: Array<{
        answer_id: number
        poll_media: {
            text?: string
            emoji?: {
                id?: string | null
                name?: string | null
                animated?: boolean
            }
        }
    }>
    expiry?: string | null
    allow_multiselect?: boolean
    results?: {
        is_finalized: boolean
        answer_counts: Array<{ id: number; count: number; me_voted: boolean }>
    }
}

declare module '../readStates' {
    interface Message {
        type?: number
        content?: string
        timestamp?: string
        edited_timestamp?: string | null
        attachments?: Attachment[]
        embeds?: Embed[]
        sticker_items?: StickerItem[]
        reactions?: Reaction[]
        poll?: MessagePoll
        pinned?: boolean
        referenced_message?: Message | null
        /** Set on messages the user sent; the gateway echoes it, which is how a pending message is matched. */
        nonce?: string | number
        /** Only on messages the user sent that the server has not confirmed: still sending, or failed. */
        state?: 'sending' | 'failed'
        flags?: number
        message_reference?: {
            message_id?: string
            channel_id?: string
            guild_id?: string
        }
    }
}

export interface ChannelMessages {
    /** Newest first. */
    messages: Message[]
    /** Whether older history may exist on the server. */
    hasMore: boolean
    loading: boolean
    error: boolean
    /**
     * Loaded before the current gateway connection (from the cache, or before a reconnect that could
     * not resume), so messages may be missing. Shown as is until the newest page has been refetched.
     */
    stale?: boolean
    /**
     * A window the user jumped to (`jumpToMessage`): newer messages exist that are not loaded, so `messages` does not
     * reach the present. Live messages are not added to it, and `loadNewerMessages` / `jumpToPresent` extend it.
     */
    hasMoreAfter?: boolean
}

export interface MessagesState {
    /** Only channels that have been opened. Gateway events for other channels are ignored. */
    channels: Record<string, ChannelMessages>
    /** Opened channels, most recent first; the first CACHED_CHANNELS are cached. */
    recent: string[]
    /**
     * The messages around a search result, shown by its preview (the reference's MessagePreviewStore). Apart from the
     * channel's own window, so previewing does not move the chat. Edits, deletes and reactions reach it; new messages
     * do not.
     */
    preview?: MessagePreview
}

export interface MessagePreview {
    channelId: string
    messageId: string
    /** Newest first. */
    messages: Message[]
    /** The first page, around the message, is on its way. */
    loading: boolean
    /** Older and newer history may exist on the server: the preview pages through it like the chat does. */
    hasMore: boolean
    hasMoreAfter: boolean
    /** 'missing': the message is gone or cannot be read. */
    error?: 'missing' | 'failed'
}
