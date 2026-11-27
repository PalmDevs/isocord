import { useState } from 'react'
import { View } from 'react-native'
import { useSession } from '../../../core/react'
import { reactionChipHeight } from '../../../native/IsocordConstants'
import ReactionsView from '../../../native/ReactionsViewNativeComponent'
import { parseChatLink } from '../links/chatLink'
import { handleChatLink } from '../links/links'
import { openFromChat } from '../links/openChannel'
import { reactionRows } from '../rows/buildRows'
import { useChatTheme } from '../rows/rowEncoder'
import type { Reaction } from '../../../stores/messages/messageTypes'
import type { Message } from '../../../stores/readStates'

/**
 * A message's reaction chips as the chat draws them (the native ReactionsView). Taps react; holds are ignored.
 * Sized by its chips on one line. Takes the touches itself, so a pressable around it stays quiet.
 */
export function ReactionChips({
    message,
    reactions,
}: {
    message: Message
    reactions: Reaction[]
}) {
    const session = useSession()
    const themeJson = useChatTheme('transparent')
    // Held at a chip's height until measured, so the card does not jump.
    const [size, setSize] = useState({ width: 0, height: reactionChipHeight })
    const { channel_id: channelId, id } = message
    return (
        <View onStartShouldSetResponder={() => true}>
            <ReactionsView
                messageId={id}
                reactions={JSON.stringify(reactionRows(reactions))}
                theme={themeJson}
                onContentSize={({ nativeEvent: { width, height } }) =>
                    setSize({ width, height })
                }
                onLinkPress={event => {
                    const { url } = event.nativeEvent
                    if (parseChatLink(url)?.kind === 'reactions') return
                    handleChatLink(url, {
                        session,
                        channelId,
                        openChannel: openFromChat,
                    })
                }}
                style={size}
            />
        </View>
    )
}
