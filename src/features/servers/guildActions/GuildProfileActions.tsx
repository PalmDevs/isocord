import { GuildFeature } from '../../../core/discord/guild'
import {
    computePermissions,
    Permission,
} from '../../../core/discord/permissions'
import { useSession } from '../../../core/react'
import { ActionSheetRowGroup } from '../../../design/components/sheets/Sheet'
import {
    AllowDmsRow,
    AllowMessageRequestsRow,
    HideMutedChannelsRow,
    NicknameRow,
    ServerTagRow,
    ShowAllChannelsRow,
} from './GuildProfileRows'
import type { Guild } from '../../../stores/guilds'

const NICKNAME_PERMISSIONS =
    Permission.CHANGE_NICKNAME | Permission.MANAGE_NICKNAMES

/** Per-server profile, channel list and direct message preferences. */
export function GuildProfileActions({ guild }: { guild: Guild }) {
    const session = useSession()
    const isCommunity =
        guild.features?.includes(GuildFeature.COMMUNITY) ?? false
    const isHub = guild.features?.includes(GuildFeature.HUB) ?? false
    const canEditNickname =
        (computePermissions(guild, undefined, session.userId) &
            NICKNAME_PERMISSIONS) !==
        0n
    const tag = guild.features?.includes(GuildFeature.GUILD_TAGS)
        ? guild.profile?.tag
        : undefined

    return (
        <ActionSheetRowGroup hasIcons>
            {canEditNickname && <NicknameRow guildId={guild.id} />}
            {tag && <ServerTagRow guild={guild} tag={tag} />}
            {isCommunity && !isHub && <ShowAllChannelsRow guild={guild} />}
            {!isHub && <HideMutedChannelsRow guildId={guild.id} />}
            <AllowDmsRow guildId={guild.id} isHub={isHub} />
            <AllowMessageRequestsRow guildId={guild.id} />
        </ActionSheetRowGroup>
    )
}
