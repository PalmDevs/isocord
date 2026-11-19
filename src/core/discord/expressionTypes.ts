/** Shapes of emojis and stickers as the gateway and REST API send them. */

export interface GuildEmoji {
    id: string
    name: string
    /** Role ids the emoji is restricted to; empty means everyone. */
    roles: string[]
    require_colons?: boolean
    /** Integration (Twitch, ...) emoji. */
    managed?: boolean
    animated?: boolean
    /** False when the guild lost the boost level that unlocked the emoji. */
    available?: boolean
    user?: { id: string }
    version?: number
}

/** Guild or standard sticker. `format_type`: 1 PNG, 2 APNG, 3 LOTTIE, 4 GIF. */
export interface Sticker {
    id: string
    name: string
    description?: string | null
    /** Comma separated tags; for guild stickers the related emoji (unicode or name). */
    tags?: string | null
    /** 1 standard (from a pack), 2 guild. */
    type: number
    format_type: number
    /** Guild stickers. */
    guild_id?: string
    available?: boolean
    version?: number
    user_id?: string
    /** Standard stickers. */
    pack_id?: string
    sort_value?: number
}

export interface StickerPack {
    id: string
    name: string
    description?: string
    sku_id?: string
    cover_sticker_id?: string
    banner_asset_id?: string
    stickers: Sticker[]
}

export const StickerFormat = {
    PNG: 1,
    APNG: 2,
    LOTTIE: 3,
    GIF: 4,
} as const

/** The user's `animate_stickers` setting (StickerAnimationSettings). */
export const StickerAnimation = {
    ALWAYS_ANIMATE: 0,
    ANIMATE_ON_INTERACTION: 1,
    NEVER_ANIMATE: 2,
} as const
