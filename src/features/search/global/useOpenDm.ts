import { ChannelType } from '../../../core/discord/channelType'
import { useSession } from '../../../core/react'
import { channelsStore } from '../../../stores/channels/channels'
import { openChannel } from '../../chat/links/openChannel'
import { searchHistoryStore } from './SearchHistoryStore'

/** useOnPressDMItem / useOnPressGroupDMItem: records the DM in the history, closes search and opens the chat. */
export function useOpenDm(onDismiss: () => void) {
    const session = useSession()
    return (channelId: string) => {
        const channel = session.get(channelsStore).getState().channels[
            channelId
        ]
        session
            .get(searchHistoryStore)
            .getState()
            .add({
                type:
                    channel?.type === ChannelType.GROUP_DM ? 'group_dm' : 'dm',
                channelId,
            })
        onDismiss()
        openChannel(channelId)
    }
}
