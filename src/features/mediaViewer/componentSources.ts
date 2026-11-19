import { ComponentType } from '../../core/discord/components'
import { isVideoMedia } from '../chat/messageComponents/apiComponent'
import type { ApiComponent } from '../chat/messageComponents/apiComponent'
import type { ViewerSource } from './sources'

type UnfurledMedia = NonNullable<ApiComponent['media']>

const GIF_TYPE = 'image/gif'

/**
 * Returns the viewer page of a gallery item or thumbnail (toMediaSourceFromUnfurledMedia). A video when its
 * content type says so and the proxy has it (getUnfurledMediaItemType).
 */
function unfurledSource(
    media: UnfurledMedia,
    description: string | null | undefined,
): ViewerSource {
    const url = media.proxy_url ?? media.url
    const video = isVideoMedia(media)
    return {
        url,
        proxyUrl: media.proxy_url,
        width: media.width ?? 0,
        height: media.height ?? 0,
        videoUrl: video ? url : undefined,
        description: description || undefined,
        link: media.url,
        file: media.url,
        kind: video
            ? 'video'
            : media.content_type === GIF_TYPE
              ? 'gif'
              : 'image',
    }
}

/** Returns the component with `id` anywhere in the tree, section thumbnails included (flattenComponents). */
function findComponent(
    components: ApiComponent[] | undefined,
    id: number,
): ApiComponent | undefined {
    for (const c of components ?? []) {
        if (c.id === id) return c
        if (c.accessory?.id === id) return c.accessory
        const found = findComponent(c.components, id)
        if (found) return found
    }
    return undefined
}

/**
 * Returns what the viewer pages through for a tapped gallery item or thumbnail (extractMediaSourcesFromComponent):
 * the gallery's items, or the thumbnail alone. Undefined when `id` names neither.
 */
export function componentSources(
    components: ApiComponent[] | undefined,
    id: number,
    item: number,
): { sources: ViewerSource[]; initialIndex: number } | undefined {
    const c = findComponent(components, id)
    if (c?.type === ComponentType.MEDIA_GALLERY) {
        const items = c.items ?? []
        return {
            sources: items.map(i => unfurledSource(i.media, i.description)),
            initialIndex: item >= 0 && item < items.length ? item : 0,
        }
    }
    if (c?.type === ComponentType.THUMBNAIL && c.media)
        return {
            sources: [unfurledSource(c.media, c.description)],
            initialIndex: 0,
        }
    return undefined
}
