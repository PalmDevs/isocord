import { useSession } from '../../../core/react'
import { openSearchMediaViewer } from '../../mediaViewer/store'
import { useOpenSearchPreview } from '../useOpenSearchPreview'
import { useSearchTab } from './controller'
import { getMedia } from './extract'
import type { MediaOrigin } from '../../mediaViewer/store'
import type { MessagePress } from './cardRows'
import type { MediaItem } from './extract'

/** useOnPressMessageItem: the result in its channel, in the search's preview. */
export function useOpenResult() {
    const openPreview = useOpenSearchPreview()
    return ({ channelId, messageId }: MessagePress) =>
        openPreview(channelId, messageId)
}

/**
 * useOnPressMediaItem: a picture or video opens in the media viewer, grown out of its tile (`origin`), paging
 * through every picture and video of the Media tab's results loaded so far; a voice message opens its message in
 * the preview. Shared by the Media tab and the Recent tab's grid.
 */
export function useOpenMedia() {
    const session = useSession()
    const open = useOpenResult()
    const media = useSearchTab('media')
    return (item: MediaItem, origin?: MediaOrigin) => {
        const items = getMedia(media?.messages ?? [])
        const jump = (channelId: string, messageId: string) =>
            open({ channelId, messageId })
        if (!openSearchMediaViewer(session, items, item, origin, jump))
            open({
                channelId: item.message.channel_id,
                messageId: item.message.id,
            })
    }
}
