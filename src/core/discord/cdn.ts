import { CDN_BASE, MEDIA_BASE } from '../constants'

/** Returns a custom emoji image: a GIF when animated, else WebP. */
export const emojiUrl = (
    id: string,
    animated: boolean | undefined,
    size: number,
) => `${CDN_BASE}/emojis/${id}.${animated ? 'gif' : 'webp'}?size=${size}`

/** Returns a guild icon image. */
export const guildIconUrl = (guildId: string, hash: string, size: number) =>
    `${CDN_BASE}/icons/${guildId}/${hash}.webp?size=${size}`

/** Returns a guild banner image (getGuildBannerURL). */
export const guildBannerUrl = (
    guildId: string,
    hash: string,
    size: number,
    animated?: boolean,
) =>
    `${CDN_BASE}/banners/${guildId}/${hash}.webp?size=${size}${animated && hash.startsWith('a_') ? '&animated=true' : ''}`

/** Returns a server tag badge icon (getGuildTagBadgeUrl). */
export const guildTagBadgeUrl = (guildId: string, badge: string, size = 32) =>
    `${CDN_BASE}/clan-badges/${guildId}/${badge}.png?size=${size}`

/** Returns a sticker image from the media proxy. */
export const stickerImageUrl = (id: string, extension: string, size: number) =>
    `${MEDIA_BASE}/stickers/${id}.${extension}?size=${size}`

/** Returns a profile badge icon. */
export const badgeIconUrl = (icon: string) =>
    `${CDN_BASE}/badge-icons/${icon}.png`

/** Returns a profile banner: the guild's override when `guildId` is given. A GIF when the hash is animated. */
export const bannerUrl = (
    userId: string,
    hash: string,
    size: number,
    guildId?: string,
) =>
    `${CDN_BASE}/${guildId ? `guilds/${guildId}/users/${userId}/banners` : `banners/${userId}`}/${hash}.${hash.startsWith('a_') ? 'gif' : 'webp'}?size=${size}`

const EXTERNAL_ASSET_PREFIX = 'mp:'

/** Returns a rich presence image: `mp:` assets are proxied external images, the rest belong to the application. */
export const activityAssetUrl = (
    applicationId: string | undefined,
    asset: string,
    size: number,
) =>
    asset.startsWith(EXTERNAL_ASSET_PREFIX)
        ? `${MEDIA_BASE}/${asset.slice(EXTERNAL_ASSET_PREFIX.length)}?width=${size}&height=${size}`
        : `${CDN_BASE}/app-assets/${applicationId}/${asset}.png?size=${size}`

/** Returns an application's icon (getApplicationIconURL). */
export const applicationIconUrl = (
    applicationId: string,
    icon: string,
    size: number,
) => `${CDN_BASE}/app-icons/${applicationId}/${icon}.webp?size=${size}`
