export interface DiscordInviteUrl {
    code: string
    url: string
}

const DISCORD_INVITE_URL =
    /^https?:\/\/(?:discord\.gg|(?:(?:canary\.|ptb\.)?discord(?:app)?\.com)\/invite)\/([a-z0-9-]+)\/?(?:[?#].*)?$/i

/** Parses a Discord invite URL across discord.gg and main, PTB, canary and legacy hosts. */
export function parseDiscordInviteUrl(
    url: string,
): DiscordInviteUrl | undefined {
    const match = DISCORD_INVITE_URL.exec(url)
    if (!match?.[1]) return undefined
    return { code: match[1], url }
}

export const INVITE_HOST = 'https://discord.gg'

/** getInviteURL: the share link for an invite code. */
export function inviteUrl(code: string): string {
    return `${INVITE_HOST}/${code}`
}
