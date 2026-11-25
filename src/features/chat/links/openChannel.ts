import type { ShareParams } from '../../share/params'

/** What the panels on screen open, each set by the panel that owns it. */
interface Openers {
    /** Set by the main tabs: a channel as the panel of its tab, scrolled to a message when given one. */
    channel: (channelId: string, messageId?: string) => void
    /** Set by the panels whose chat is on screen: a channel in a panel stacked over that chat. */
    stackedChat: (channelId: string, messageId?: string) => void
    /** Set by the panels whose chat is on screen: jump in place if on top, else stack a new panel. */
    chatJump: (channelId: string, messageId?: string) => void
    /** Set by the panels on screen: the thread creation panel slid in over them. */
    threadCreation: (channelId: string, messageId?: string) => void
    /** Set by the panels while their channel details show: a channel picked there. */
    detailsChannel: (channelId: string) => void
    /** Set by the panels while their channel details show: a jump from search or a link there. */
    detailsJump: (channelId: string, messageId?: string) => void
    /** Set by the main tabs: a server's Channels & Roles, on one of its tabs. */
    channelBrowser: (guildId: string, tab: 'customize' | 'browse') => void
    /** Set by the main tabs: a text file's plain-text preview (openPlaintextFilePreview). */
    plaintextFilePreview: (url: string, fileName: string) => void
    /** Set by the main tabs: the screen that forwards a message or sends what another app shared. */
    share: (params: ShareParams) => void
}

const openers: Partial<Openers> = {}

/** Sets what opens `kind` while its owner is on screen. Returns the function that unsets it. */
export function setOpener<K extends keyof Openers>(
    kind: K,
    opener: Openers[K],
): () => void {
    openers[kind] = opener
    return () => {
        if (openers[kind] === opener) delete openers[kind]
    }
}

/**
 * Opens a channel from inside a chat as the panel of its tab, as if picked from the list: direct messages in the
 * Messages tab, server channels in the Servers tab (selecting their server). Swiping the panel away goes back to
 * the list.
 */
export function openChannel(channelId: string, messageId?: string): void {
    openers.channel?.(channelId, messageId)
}

/** Opens a server's Channels & Roles (openStaticChannelRoute's "customize" and "browse"). */
export function openChannelBrowser(
    guildId: string,
    tab: 'customize' | 'browse',
): void {
    openers.channelBrowser?.(guildId, tab)
}

/** openPlaintextFilePreview: a text file's contents on a screen of their own. */
export function openPlaintextFilePreview(url: string, fileName: string): void {
    openers.plaintextFilePreview?.(url, fileName)
}

/** openForwardModal, or the share screen for what another app shared. */
export function openShare(params: ShareParams): void {
    openers.share?.(params)
}

/** Opens a channel stacked over the chat on screen. False when no chat panels are on screen. */
export function openStackedChat(
    channelId: string,
    messageId?: string,
): boolean {
    if (!openers.stackedChat) return false
    openers.stackedChat(channelId, messageId)
    return true
}

/** Opens the panel that creates a thread in a channel, from `messageId` if given (navigateToThreadCreation). */
export function openThreadCreation(channelId: string, messageId?: string) {
    openers.threadCreation?.(channelId, messageId)
}

/**
 * Opens a channel or thread picked in the channel details (ThreadsScreen's transitionToThread, ChannelsScreen's
 * useOnPressGuildTextChannel): the details slide away first, as for thread creation, then the chat under them
 * switches to it in place. `onDismiss` closes the details where no panels registered.
 */
export function openFromDetails(
    channelId: string,
    onDismiss: () => void,
): void {
    if (openers.detailsChannel) {
        openers.detailsChannel(channelId)
        return
    }
    onDismiss()
    openChannel(channelId)
}

/**
 * Jumps to a channel or message from a search preview or link inside channel details: scrolls in place when it is
 * already the channel on top, stacks a new panel over an open chat, or leaves via `onDismiss` when outside details.
 */
export function jumpFromDetails(
    channelId: string,
    messageId: string | undefined,
    onDismiss: () => void,
): void {
    if (openers.detailsJump) {
        openers.detailsJump(channelId, messageId)
        return
    }
    onDismiss()
    openChannel(channelId, messageId)
}

/**
 * Opens a channel or message from inside a chat or an overlay over it: jumps in place when it is already the
 * channel on top, stacks a new panel over an open chat, slides out of details, or opens in its tab.
 */
export function openFromChat(channelId: string, messageId?: string): void {
    if (openers.detailsJump) {
        openers.detailsJump(channelId, messageId)
        return
    }
    if (openers.chatJump) {
        openers.chatJump(channelId, messageId)
        return
    }
    openChannel(channelId, messageId)
}
