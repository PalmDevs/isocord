import { ComponentType } from '../../../core/discord/components'

export interface ApiEmoji {
    id?: string | null
    name?: string | null
    animated?: boolean
}

/** An unfurled media item: a thumbnail's, gallery item's or file's media. */
export interface ApiUnfurledMedia {
    url: string
    proxy_url?: string
    width?: number | null
    height?: number | null
    content_type?: string
}

export interface ApiSelectOption {
    label: string
    value: string
    description?: string | null
    emoji?: ApiEmoji | null
    default?: boolean
}

/** A message component as the API sends it (v1 action rows and v2 layout). */
export interface ApiComponent {
    type: number
    /** Unique within the message; media links name a gallery or thumbnail by it. */
    id?: number
    custom_id?: string
    style?: number
    label?: string
    emoji?: ApiEmoji
    url?: string
    sku_id?: string
    disabled?: boolean
    placeholder?: string
    min_values?: number
    max_values?: number
    options?: ApiSelectOption[]
    default_values?: Array<{ id: string; type: string }>
    channel_types?: number[]
    content?: string
    accent_color?: number | null
    spoiler?: boolean
    divider?: boolean
    spacing?: number
    components?: ApiComponent[]
    accessory?: ApiComponent
    media?: ApiUnfurledMedia
    /** Thumbnails: alt text. */
    description?: string | null
    items?: Array<{
        media: ApiUnfurledMedia
        description?: string | null
        spoiler?: boolean
    }>
    file?: ApiUnfurledMedia
    name?: string
    size?: number
}

const VIDEO_TYPE = 'video/'

/** getUnfurledMediaItemType: a video when its content type says so and the proxy has it. */
export const isVideoMedia = (media: ApiUnfurledMedia) =>
    media.proxy_url != null &&
    media.content_type?.startsWith(VIDEO_TYPE) === true

/** Separates the child indexes of a component id. */
const PATH_SEPARATOR = ','

/**
 * transformComponent's ids: the child indexes from the top of the tree, joined. A section's accessory comes after
 * its texts. They name a component whether or not the API gave it an `id`.
 */
export const childPath = (path: string, index: number) =>
    path === '' ? String(index) : `${path}${PATH_SEPARATOR}${index}`

/** Returns a component's children in id order: its components, then a section's accessory. */
export function childrenOf(c: ApiComponent): ApiComponent[] {
    const children = c.components ?? []
    return c.type === ComponentType.SECTION && c.accessory
        ? [...children, c.accessory]
        : children
}

/** Returns the component an id names (flattenComponents' lookup). */
export function findByPath(
    components: ApiComponent[] | undefined,
    path: string,
): ApiComponent | undefined {
    let found: ApiComponent | undefined
    let level = components
    for (const index of path.split(PATH_SEPARATOR)) {
        found = level?.[Number(index)]
        if (!found) return undefined
        level = childrenOf(found)
    }
    return found
}

/** Returns whether the component `path` names sits inside the one at `parent` (findChildComponent). */
export const isInside = (path: string, parent: string) =>
    path.startsWith(`${parent}${PATH_SEPARATOR}`)

/** getAllTextDisplayContent: every text display's markdown, one per line. Undefined without any. */
export function allTextDisplayContent(
    components: ApiComponent[] | undefined,
): string | undefined {
    const texts: string[] = []
    const visit = (list: ApiComponent[]) => {
        for (const c of list) {
            if (c.type === ComponentType.TEXT_DISPLAY && c.content)
                texts.push(c.content)
            visit(childrenOf(c))
        }
    }
    visit(components ?? [])
    return texts.length ? texts.join('\n') : undefined
}
