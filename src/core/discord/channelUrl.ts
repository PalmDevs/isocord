export interface DiscordChannelUrl {
    guildId: string
    channelId?: string
    messageId?: string
}

const DISCORD_CHANNEL_URL =
    /^https?:\/\/(?:(?:canary\.|ptb\.)?discord(?:app)?\.com)\/channels\/(\d+|@me)(?:\/(\d+)(?:\/(\d+))?)?\/?(?:[?#].*)?$/i

/** Parses a Discord channel or message URL across main, PTB, canary and legacy hosts. */
export function parseDiscordChannelUrl(
    url: string,
): DiscordChannelUrl | undefined {
    const match = DISCORD_CHANNEL_URL.exec(url)
    if (!match?.[1]) return undefined
    return {
        guildId: match[1],
        channelId: match[2],
        messageId: match[3],
    }
}
