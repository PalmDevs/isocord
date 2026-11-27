import { guildBannerUrl, guildIconUrl } from '../../../core/discord/cdn'
import { useSessionStore } from '../../../core/react'
import {
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
} from '../../../design/components/sheets/Sheet'
import { t } from '../../../i18n'
import { settingsStore } from '../../../stores/settings/settingsStore'
import { copy } from '../../chat/longPress/messageActionRows'
import { VIEWER_IMAGE_SIZE } from '../../userProfile/constants'
import type { Guild } from '../../../stores/guilds'

/** GuildDeveloperOptionAction: copy the server id and its icon and banner links in developer mode. */
export function GuildDeveloperActions({ guild }: { guild: Guild }) {
    const developerMode = useSessionStore(
        settingsStore,
        state => state.developerMode === true,
    )
    if (!developerMode) return null
    return (
        <ActionSheetRowGroup title={t('guildActions.developerMode')} hasIcons>
            <ActionSheetRow
                icon={<ActionSheetRowIcon name="IdIcon" />}
                label={t('guildActions.copyId')}
                onPress={() => copy(guild.id, 'id')}
            />
            {guild.icon && (
                <ActionSheetRow
                    icon={<ActionSheetRowIcon name="LinkIcon" />}
                    label={t('guildActions.copyIconLink')}
                    onPress={() =>
                        copy(
                            guildIconUrl(
                                guild.id,
                                guild.icon!,
                                VIEWER_IMAGE_SIZE,
                            ),
                            'link',
                        )
                    }
                />
            )}
            {guild.banner && (
                <ActionSheetRow
                    icon={<ActionSheetRowIcon name="LinkIcon" />}
                    label={t('guildActions.copyBannerLink')}
                    onPress={() =>
                        copy(
                            guildBannerUrl(
                                guild.id,
                                guild.banner!,
                                VIEWER_IMAGE_SIZE,
                                true,
                            ),
                            'link',
                        )
                    }
                />
            )}
        </ActionSheetRowGroup>
    )
}
