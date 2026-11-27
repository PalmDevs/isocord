import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { GuildActionSheet } from './GuildActionSheet'
import type { Guild } from '../../../stores/guilds'
import type { GuildActionNavigation } from './types'

/** Opens the server action sheet (openGuildActionSheet). */
export function openGuildActionSheet(
    guild: Guild,
    navigation?: GuildActionNavigation,
    onOpenSearch?: () => void,
): void {
    openActionSheet(
        `guild-actions-${guild.id}`,
        <GuildActionSheet
            guildId={guild.id}
            navigation={navigation}
            onOpenSearch={onOpenSearch}
        />,
    )
}
