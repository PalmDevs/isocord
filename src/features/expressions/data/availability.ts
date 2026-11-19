import { StickerType } from './types'
import type { AnyEmoji, CustomEmoji, Sticker } from './types'

/**
 * Which emojis and stickers the user may use where, ported from the reference client
 * (`EmojiUtils.getEmojiUnavailableReason`, `GuildEmojis.isUsable`, `StickerSendability`). Pure
 * functions: everything they depend on is in the `UsageContext`.
 */

/** Why an emoji is used; some intentions never allow external or custom emojis. Same values as the reference. */
export const EmojiIntention = {
    REACTION: 0,
    STATUS: 1,
    COMMUNITY_CONTENT: 2,
    CHAT: 3,
    GUILD_STICKER_RELATED_EMOJI: 4,
    GUILD_ROLE_BENEFIT_EMOJI: 5,
    SOUNDBOARD: 6,
    VOICE_CHANNEL_TOPIC: 7,
    GIFT: 8,
    AUTO_SUGGESTION: 9,
    POLLS: 10,
    PROFILE: 11,
    GUILD_PROFILE: 12,
    DEFAULT_REACT_EMOJI: 13,
    NO_CUSTOM_EMOJI: 14,
    TYPING_INDICATOR: 15,
} as const

/** Why an emoji cannot be used, `null` when it can. Same values as the reference's `EmojiDisabledReasons`. */
export const EmojiDisabledReason = {
    DISALLOW_EXTERNAL: 0,
    GUILD_SUBSCRIPTION_UNAVAILABLE: 1,
    PREMIUM_LOCKED: 2,
    ONLY_GUILD_EMOJIS_ALLOWED: 3,
    ROLE_SUBSCRIPTION_LOCKED: 4,
    ROLE_SUBSCRIPTION_UNAVAILABLE: 5,
    DISALLOW_CUSTOM: 6,
} as const
export type EmojiUnavailableReason =
    (typeof EmojiDisabledReason)[keyof typeof EmojiDisabledReason]

export const StickerSendability = {
    SENDABLE: 0,
    SENDABLE_WITH_PREMIUM: 1,
    NONSENDABLE: 2,
    SENDABLE_WITH_BOOSTED_GUILD: 3,
} as const
export type StickerSendabilityValue =
    (typeof StickerSendability)[keyof typeof StickerSendability]

/** Discord's `premium_type` values. */
export const PremiumType = {
    NONE: 0,
    NITRO_CLASSIC: 1,
    NITRO: 2,
    NITRO_BASIC: 3,
} as const

interface Perks {
    animatedEmojis: boolean
    emojisEverywhere: boolean
    stickersEverywhere: boolean
}

/**
 * What each `premium_type` unlocks. The reference reads this from the SKU feature lists the server
 * sends (`animatedEmojis`, `emojisEverywhere`, `stickersEverywhere`), which the client does not
 * receive in a form held here, so this table is the documented Nitro tier behaviour. Adjust here.
 */
const PERKS: Record<number, Perks> = {
    [PremiumType.NITRO_CLASSIC]: {
        animatedEmojis: true,
        emojisEverywhere: true,
        stickersEverywhere: false,
    },
    [PremiumType.NITRO]: {
        animatedEmojis: true,
        emojisEverywhere: true,
        stickersEverywhere: true,
    },
    [PremiumType.NITRO_BASIC]: {
        animatedEmojis: true,
        emojisEverywhere: true,
        stickersEverywhere: true,
    },
}

const perksOf = (premiumType: number | null | undefined) =>
    PERKS[premiumType ?? 0]

export const canUseEmojisEverywhere = (premiumType?: number | null) =>
    perksOf(premiumType)?.emojisEverywhere ?? false
export const canUseAnimatedEmojis = (premiumType?: number | null) =>
    perksOf(premiumType)?.animatedEmojis ?? false
export const canUseStickersEverywhere = (premiumType?: number | null) =>
    perksOf(premiumType)?.stickersEverywhere ?? false

/** The permissions the rules look at, already resolved for the channel. */
export interface UsageContext {
    premiumType?: number | null
    /** The guild the expression is for; defaults to the channel's. Null in DMs. */
    guildId?: string | null
    channel?: {
        /** Null for DMs and group DMs. */
        guildId?: string | null
        /** USE_EXTERNAL_EMOJIS in the channel. */
        canUseExternalEmojis?: boolean
        /** USE_EXTERNAL_STICKERS in the channel. */
        canUseExternalStickers?: boolean
    } | null
    /** Defaults to CHAT. */
    intention?: number
    /** Counts external emojis as allowed in intentions that would otherwise refuse them. */
    forceIncludeExternalGuilds?: boolean
    /** Skips the Nitro checks (used to list what Nitro would unlock). */
    bypassPremiumEmojiEntitlement?: boolean
}

export const isCustomEmoji = (emoji: AnyEmoji): emoji is CustomEmoji =>
    emoji.type === 'custom'

/** Intentions the reference never lets use external guilds' emojis. */
const INTERNAL_ONLY_INTENTIONS: ReadonlySet<number> = new Set([
    EmojiIntention.COMMUNITY_CONTENT,
    EmojiIntention.GUILD_STICKER_RELATED_EMOJI,
    EmojiIntention.GUILD_ROLE_BENEFIT_EMOJI,
    EmojiIntention.SOUNDBOARD,
    EmojiIntention.GIFT,
])
export const isExternalEmojiAllowedForIntention = (intention: number) =>
    !INTERNAL_ONLY_INTENTIONS.has(intention)

/**
 * Why `emoji` cannot be used in the context, `null` when it can. Unicode emoji are always usable.
 * Role subscription emojis (`ROLE_SUBSCRIPTION_*`) are not modelled: they are hidden by
 * `isEmojiUsableByRoles` like any role restricted emoji.
 */
export function getEmojiUnavailableReason(
    emoji: AnyEmoji,
    context: UsageContext = {},
): EmojiUnavailableReason | null {
    if (!isCustomEmoji(emoji)) return null
    const intention = context.intention ?? EmojiIntention.CHAT
    if (
        intention === EmojiIntention.GUILD_PROFILE ||
        intention === EmojiIntention.NO_CUSTOM_EMOJI
    )
        return EmojiDisabledReason.DISALLOW_CUSTOM

    const guildId = context.guildId ?? context.channel?.guildId ?? null
    const internal = guildId !== null && guildId === emoji.guildId
    if (intention === EmojiIntention.COMMUNITY_CONTENT)
        return internal ? null : EmojiDisabledReason.DISALLOW_EXTERNAL

    if (
        !isExternalEmojiAllowedForIntention(intention) &&
        !internal &&
        !context.forceIncludeExternalGuilds
    )
        return EmojiDisabledReason.DISALLOW_EXTERNAL
    if (
        context.channel?.guildId &&
        !internal &&
        !context.channel.canUseExternalEmojis
    )
        return EmojiDisabledReason.DISALLOW_EXTERNAL
    if (emoji.available === false)
        return EmojiDisabledReason.GUILD_SUBSCRIPTION_UNAVAILABLE

    if (!context.bypassPremiumEmojiEntitlement) {
        if (!canUseEmojisEverywhere(context.premiumType) && !internal) {
            if (intention === EmojiIntention.STATUS || !emoji.managed)
                return EmojiDisabledReason.PREMIUM_LOCKED
        }
        if (emoji.animated && !canUseAnimatedEmojis(context.premiumType))
            return EmojiDisabledReason.PREMIUM_LOCKED
    }
    return null
}

/** Role restricted emojis are only usable by members holding one of the roles. */
export const isEmojiUsableByRoles = (
    emoji: { roles: string[] },
    memberRoleIds: readonly string[],
): boolean =>
    emoji.roles.length === 0 ||
    emoji.roles.some(role => memberRoleIds.includes(role))

export const isGuildSticker = (sticker: Sticker) =>
    sticker.type === StickerType.GUILD
export const isStandardSticker = (sticker: Sticker) =>
    sticker.type === StickerType.STANDARD

/**
 * Returns whether the user can send `sticker` in the context's channel (`getStickerSendability`).
 * - Standard: sendable once its pack is known (`packKnown`).
 * - Guild: the user must be a member (`isMember`).
 * - Guild below its boost level (`available === false`): `SENDABLE_WITH_BOOSTED_GUILD`.
 * - Guild, own channel: sendable.
 * - Guild, elsewhere: needs USE_EXTERNAL_STICKERS and Nitro, else `SENDABLE_WITH_PREMIUM`.
 */
export function getStickerSendability(
    sticker: Sticker,
    context: UsageContext,
    options: {
        /** The sticker's pack is held (standard stickers). */
        packKnown?: boolean
        /** The user is in the sticker's guild (guild stickers). */
        isMember?: boolean
    } = {},
): StickerSendabilityValue {
    if (isStandardSticker(sticker))
        return options.packKnown
            ? StickerSendability.SENDABLE
            : StickerSendability.NONSENDABLE
    if (!isGuildSticker(sticker) || !context.channel)
        return StickerSendability.NONSENDABLE
    if (!(options.isMember ?? true)) return StickerSendability.NONSENDABLE
    if (sticker.available === false)
        return StickerSendability.SENDABLE_WITH_BOOSTED_GUILD
    const guildId = context.guildId ?? context.channel.guildId ?? null
    if (guildId !== null && guildId === sticker.guild_id)
        return StickerSendability.SENDABLE
    if (context.channel.guildId && !context.channel.canUseExternalStickers)
        return StickerSendability.NONSENDABLE
    return canUseStickersEverywhere(context.premiumType)
        ? StickerSendability.SENDABLE
        : StickerSendability.SENDABLE_WITH_PREMIUM
}
