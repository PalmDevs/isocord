import { useState } from 'react'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../core/react'
import SpanTextView from '../../native/SpanTextViewNativeComponent'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { membersStore } from '../../stores/members'
import { usersStore } from '../../stores/users'
import { handleChatLink } from '../chat/links/links'
import { openChannel } from '../chat/links/openChannel'
import { mentionResolver } from '../chat/rows/buildRows'
import { parseMarkdown, toSpans } from '../chat/rows/markdown'
import { useChatTheme } from '../chat/rows/rowEncoder'
import type { Session } from '../../core/session'
import type { User } from '../../stores/users'

/**
 * UserProfileAboutMeCard: the bio's markdown in the chat's native text, as ChannelTopic draws a topic. Mentions
 * resolve in the shown server, in a selector that returns a string.
 */
export function ProfileBio({
    bio,
    guildId,
    onLink,
}: {
    bio: string
    guildId: string | undefined
    /** A link that leaves the profile. */
    onLink: () => void
}) {
    const session = useSession()
    const { theme } = useUnistyles()
    const chatTheme = useChatTheme('transparent')
    const [height, setHeight] = useState(0)
    const nodes = parseMarkdown(bio)
    const users = useSessionStore(usersStore, state => state.users)
    const spans = resolve(session, nodes, users, guildId)
    const variant = theme.text['text-md/normal']
    return (
        <SpanTextView
            markdown
            spans={spans}
            theme={chatTheme}
            color={theme.colors.TEXT_DEFAULT}
            fontSize={variant.fontSize}
            lineHeight={variant.lineHeight}
            lineClamp={0}
            onContentHeight={event => setHeight(event.nativeEvent.height)}
            onLinkPress={event =>
                handleChatLink(event.nativeEvent.url, {
                    session,
                    openChannel: (id, messageId) => {
                        onLink()
                        openChannel(id, messageId)
                    },
                })
            }
            style={styles.text(height)}
        />
    )
}

function resolve(
    session: Session,
    nodes: ReturnType<typeof parseMarkdown>,
    users: Record<string, User>,
    guildId: string | undefined,
): string {
    const guild = guildId
        ? session.get(guildsStore).getState().guilds[guildId]
        : undefined
    const members = guildId
        ? session.get(membersStore).getState().members[guildId]
        : undefined
    const { channels } = session.get(channelsStore).getState()
    return JSON.stringify(
        toSpans(nodes, mentionResolver({ guild, members, users, channels })),
    )
}

const styles = StyleSheet.create({
    text: (height: number) => ({ height }),
})
