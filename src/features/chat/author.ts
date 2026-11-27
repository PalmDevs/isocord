import { CDN_BASE } from '../../core/constants'
import { guildTagBadgeUrl } from '../../core/discord/cdn'
import { avatarUrl } from '../../design/components/avatars/avatarUrl'
import { rgbInt } from './color'
import { twemojiUrl } from './emoji'
import type { Guild, Role } from '../../stores/guilds'
import type { Member } from '../../stores/members'
import type { User } from '../../stores/users'

/** What the author line shows besides the name. MessageRow copies these fields, and ChatRows.kt decodes them. */
interface AuthorStyle {
    /** Flat username colour. */
    color?: number
    /** Two or three colours for a gradient (or holographic) username. */
    colors?: number[]
    roleIcon?: { url?: string; emoji?: string }
    /** The role the icon comes from (for the tap on the icon). Not part of the row. */
    roleIconRoleId?: string
}

interface ClanTag {
    tag: string
    badgeUrl?: string
}

/** doesRoleSortHigher in the reference: position first, then the older (smaller) id. */
const sortsHigher = (a: Role, b: Role) =>
    (a.position ?? 0) !== (b.position ?? 0)
        ? (a.position ?? 0) > (b.position ?? 0)
        : BigInt(a.id) < BigInt(b.id)

/**
 * A role's flat colour (the primary one) and, in servers with enhanced role colours, the two or three colours of
 * its gradient. Used for usernames and role mentions (useProcessColorStringsArray / ERC eligibility).
 */
export function roleColors(
    guild: Guild,
    role: Role,
): Pick<AuthorStyle, 'color' | 'colors'> {
    const { colors } = role
    const style: Pick<AuthorStyle, 'color' | 'colors'> = {
        color: rgbInt(colors?.primary_color || role.color),
    }
    if (guild.enhancedRoleColors && colors?.secondary_color) {
        style.colors = [
            colors.primary_color,
            colors.secondary_color,
            colors.tertiary_color,
        ]
            .filter((color): color is number => Boolean(color))
            .map(color => rgbInt(color) ?? 0)
    }
    return style
}

/** A role's icon: its uploaded image, or the Twemoji art of its Unicode emoji. */
export function roleIcon(
    role: Role,
): { url: string; emoji?: string } | undefined {
    if (role.icon)
        return {
            url: `${CDN_BASE}/role-icons/${role.id}/${role.icon}.webp?size=64&quality=lossless`,
        }
    if (role.unicode_emoji)
        return {
            url: twemojiUrl(role.unicode_emoji),
            emoji: role.unicode_emoji,
        }
    return undefined
}

/** The member's colour and icon come from the highest role that has one. */
export function authorStyle(
    guild: Guild | undefined,
    member: Member | undefined,
): AuthorStyle {
    if (!guild || !member) return {}
    let colorRole: Role | undefined
    let iconRole: Role | undefined
    for (const id of member.roles) {
        const role = guild.roles[id]
        if (!role) continue
        const color = role.colors?.primary_color || role.color
        if (color && (!colorRole || sortsHigher(role, colorRole)))
            colorRole = role
        if (
            (role.icon || role.unicode_emoji) &&
            (!iconRole || sortsHigher(role, iconRole))
        )
            iconRole = role
    }

    const style: AuthorStyle = colorRole ? roleColors(guild, colorRole) : {}
    if (iconRole) {
        style.roleIconRoleId = iconRole.id
        style.roleIcon = roleIcon(iconRole)
    }
    return style
}

/** The server tag chip: needs identity enabled, a guild and a tag. Badge size 12 asks the CDN for 32px. */
export function clanTag(user: User): ClanTag | undefined {
    const guild = user.primary_guild
    if (!guild?.identity_enabled || !guild.identity_guild_id || !guild.tag)
        return undefined
    return {
        tag: guild.tag,
        badgeUrl: guild.badge
            ? guildTagBadgeUrl(guild.identity_guild_id, guild.badge)
            : undefined,
    }
}

/** The decoration ring: the server one wins over the profile one. Static frame (`passthrough=false`). */
export function decorationUrl(
    user: User,
    member: Member | undefined,
): string | undefined {
    const asset = (
        member?.avatar_decoration_data ?? user.avatar_decoration_data
    )?.asset
    return asset
        ? `${CDN_BASE}/avatar-decoration-presets/${asset}.png?size=256&passthrough=false`
        : undefined
}

/** The server avatar when the member set one, else the user's own. */
export function authorAvatarUrl(
    user: User,
    member: Member | undefined,
    guildId: string | undefined,
    size: number,
) {
    if (member?.avatar && guildId) {
        return `${CDN_BASE}/guilds/${guildId}/users/${user.id}/avatars/${member.avatar}.webp?size=${size}`
    }
    return avatarUrl(user, size)
}
