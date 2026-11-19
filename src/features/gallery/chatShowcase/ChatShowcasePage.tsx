import { useState } from 'react'
import { StyleSheet } from 'react-native-unistyles'
import { logger } from '../../../core/log'
import { showToast } from '../../../design/components/overlays/toastStore'
import ChatView from '../../../native/ChatViewNativeComponent'
import { parseChatLink } from '../../chat/links/chatLink'
import { buildRows } from '../../chat/rows/buildRows'
import { encodeRows, useChatTheme } from '../../chat/rows/rowEncoder'
import {
    CHANNELS,
    GUILD,
    MEMBERS,
    OTHER_GUILD,
    showcaseAckedId,
    showcaseMessages,
    USERS,
} from './fixtures'
import { showcaseInteractions } from './fixtures/components'
import { ChannelId } from './fixtures/world'
import { showcaseChannels, showcaseGuilds, showcaseSession } from './session'

const log = logger('ChatShowcase')

/** The channel the showcase is drawn as: its welcome row comes at the top of the history. */
const SHOWCASE_CHANNEL = CHANNELS.find(
    channel => channel.id === ChannelId.GENERAL,
)

/**
 * Builds the rows the way `useChatRows` does, from the fixtures instead of the stores: the real `buildRows`, so
 * a feature looks here as it does in a chat. Nothing is sent to the account.
 */
function buildShowcaseRows(): string {
    return encodeRows(
        buildRows(
            {
                messages: [...showcaseMessages].reverse(),
                hasMore: false,
                loading: false,
                error: false,
            },
            {
                session: showcaseSession,
                guild: GUILD,
                guilds: { ...showcaseGuilds, [OTHER_GUILD.id]: OTHER_GUILD },
                members: MEMBERS,
                users: Object.fromEntries(USERS.map(user => [user.id, user])),
                channels: showcaseChannels,
                channel: SHOWCASE_CHANNEL,
                ackedId: showcaseAckedId,
                canReact: () => true,
                // Polls drawn as in a chat; their taps only toast here.
                polls: {},
                // Buttons and selects too, a few of them waiting or failed.
                interactions: showcaseInteractions,
            },
        ),
    )
}

/** Shows what a press would do, and does nothing to the account. */
function describe(action: string, detail: string) {
    log.info(`${action}: ${detail}`)
    showToast({ content: `${action}: ${detail}`, key: 'chat-showcase' })
}

/** Every message type and chat feature, drawn by the chat's native list. Add samples in `fixtures/`. */
export function ChatShowcasePage() {
    // Built once: the fixtures never change.
    const [rows] = useState(buildShowcaseRows)
    const theme = useChatTheme()
    return (
        <ChatView
            style={styles.chat}
            scrollKey="chat-showcase"
            rows={rows}
            theme={theme}
            onLinkPress={event => {
                const link = parseChatLink(event.nativeEvent.url)
                describe('Link', link?.kind ?? event.nativeEvent.url)
            }}
            onMessageLongPress={event =>
                describe('Long press', event.nativeEvent.messageId)
            }
        />
    )
}

const styles = StyleSheet.create({
    chat: { flex: 1 },
})
