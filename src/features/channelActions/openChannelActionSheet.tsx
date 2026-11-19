import { openActionSheet } from '../../design/components/sheets/sheetStore'
import { ChannelActionSheet } from './ChannelActionSheet'
import type { ChannelActionNavigation } from './actions'

/**
 * openChannelLongPressActionSheet: opens the actions of a channel. The sheets are drawn outside the navigator, so
 * the caller passes its `navigation` for the rows that open a screen.
 */
export function openChannelActionSheet(
    channelId: string,
    navigation: ChannelActionNavigation,
): void {
    openActionSheet(
        `channel-long-press-${channelId}`,
        <ChannelActionSheet channelId={channelId} navigation={navigation} />,
    )
}
