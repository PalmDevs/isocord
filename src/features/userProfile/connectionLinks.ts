import type { ImageSourcePropType } from 'react-native'
import type { IconName } from '../../design/icons/Icon'
import type { ConnectedAccount } from '../../stores/userProfiles'

/** Platforms.getPlatformUserUrl: where a connection's profile lives, by the connection's name or id. */
const PROFILE_URLS: Record<string, (account: ConnectedAccount) => string> = {
    twitch: ({ name }) => `https://www.twitch.tv/${encodeURIComponent(name)}`,
    youtube: ({ id }) =>
        `https://www.youtube.com/channel/${encodeURIComponent(id)}`,
    bluesky: ({ id }) =>
        `https://bsky.app/profile/${encodeURIComponent(id).replaceAll('%3A', ':')}`,
    steam: ({ id }) =>
        `https://steamcommunity.com/profiles/${encodeURIComponent(id)}`,
    reddit: ({ name }) =>
        `https://www.reddit.com/u/${encodeURIComponent(name)}`,
    twitter: ({ name }) => `https://x.com/${encodeURIComponent(name)}`,
    spotify: ({ id }) =>
        `https://open.spotify.com/user/${encodeURIComponent(id)}`,
    github: ({ name }) => `https://github.com/${encodeURIComponent(name)}`,
    roblox: ({ id }) =>
        `https://roblox.com/users/${encodeURIComponent(id)}/profile`,
    ebay: ({ name }) => `https://www.ebay.com/usr/${encodeURIComponent(name)}`,
    tiktok: ({ name }) => `https://www.tiktok.com/@${encodeURIComponent(name)}`,
    instagram: ({ name }) =>
        `https://www.instagram.com/${encodeURIComponent(name)}`,
    domain: ({ id }) => `https://${id}/`,
}

/** Icons the design system has for a platform; the others show a link. */
const ICONS: Record<string, IconName> = {
    twitch: 'TwitchNeutralIcon',
    youtube: 'YoutubeNeutralIcon',
    bluesky: 'BlueskyNeutralIcon',
    steam: 'SteamNeutralIcon',
    reddit: 'RedditNeutralIcon',
    twitter: 'TwitterNeutralIcon',
    spotify: 'SpotifyNeutralIcon',
    tiktok: 'TiktokNeutralIcon',
    instagram: 'InstagramNeutralIcon',
    facebook: 'FacebookNeutralIcon',
    domain: 'GlobeEarthIcon',
    xbox: 'XboxNeutralIcon',
    playstation: 'PlaystationNeutralIcon',
    battlenet: 'BattlenetNeutralIcon',
    epicgames: 'EpicGamesNeutralIcon',
    riotgames: 'RiotGamesNeutralIcon',
    crunchyroll: 'CrunchyrollneutralIcon',
}

/**
 * Platforms without a Mana icon: the reference's own platform art (img_account_sync_github_white), tinted like
 * an icon.
 */
const IMAGES: Record<string, ImageSourcePropType> = {
    github: require('./images/github.png'),
}

/** Returns the platform art of a connection without a Mana icon. */
export function connectionImage(
    account: ConnectedAccount,
): ImageSourcePropType | undefined {
    return IMAGES[account.type]
}

/** Returns the connection's profile URL, undefined for a platform with none. */
export function connectionUrl(account: ConnectedAccount): string | undefined {
    return PROFILE_URLS[account.type]?.(account)
}

export function connectionIcon(account: ConnectedAccount): IconName {
    return ICONS[account.type] ?? 'LinkIcon'
}
