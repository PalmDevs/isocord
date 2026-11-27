import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { Share, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ChannelType } from '../../../../core/discord/channelType'
import { GuildFeature } from '../../../../core/discord/guild'
import { inviteUrl } from '../../../../core/discord/inviteUrl'
import { Permission } from '../../../../core/discord/permissions'
import { useSession, useSessionStore } from '../../../../core/react'
import { ActivityIndicator } from '../../../../design/components/ActivityIndicator'
import { Button } from '../../../../design/components/buttons/Button'
import { IconButton } from '../../../../design/components/buttons/IconButton'
import {
    ActionSheet,
    ActionSheetCloseButton,
    BottomSheetTitleHeader,
} from '../../../../design/components/sheets/Sheet'
import { openActionSheet } from '../../../../design/components/sheets/sheetStore'
import { Text } from '../../../../design/components/Text'
import { t } from '../../../../i18n'
import { channelsStore, isThread } from '../../../../stores/channels/channels'
import { guildsStore } from '../../../../stores/guilds'
import { can } from '../../../../stores/permissions'
import { showToast } from '../../../toasts'
import { defaultChannelId, sortChannels } from '../../channelList'
import { serversUiStore } from '../../store'
import { InviteSettingsRows } from './InviteSettingsRows'
import { defaultMaxAge } from './inviteOptions'
import { useInviteLink } from './useInviteLink'
import type { Session } from '../../../../core/session'
import type { Channel } from '../../../../stores/channels/channels'
import type { Guild } from '../../../../stores/guilds'
import type { InviteSettings } from './useInviteLink'

const INVITE_SHEET_KEY = 'guild-invite'

/** Opens the server invite sheet (InstantInviteActionSheet). */
export function openInviteSheet(guild: Guild): void {
    openActionSheet(INVITE_SHEET_KEY, <InviteSheet guildId={guild.id} />)
}

function invitableChannels(session: Session, guildId: string): Channel[] {
    const { byGuild, channels } = session.get(channelsStore).getState()
    const list: Channel[] = []
    for (const id of byGuild[guildId] ?? []) {
        const channel = channels[id]
        if (
            !channel ||
            isThread(channel) ||
            channel.type === ChannelType.GUILD_CATEGORY
        )
            continue
        if (
            can(
                session,
                id,
                Permission.VIEW_CHANNEL | Permission.CREATE_INSTANT_INVITE,
            )
        )
            list.push(channel)
    }
    return sortChannels(list)
}

/**
 * InstantInviteActionSheet: the invite link with copy and share. Expire After and Max Uses are
 * edited as pending settings, and Save creates a new invite (InviteSettingsModal).
 */
function InviteSheet({ guildId }: { guildId: string }) {
    const session = useSession()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const selectedId = useSessionStore(
        serversUiStore,
        state => state.selectedChannelIds[guildId],
    )
    const { byGuild, channels } = useSessionStore(channelsStore, state => state)
    const options = invitableChannels(session, guildId)
    const channelId =
        options.find(c => c.id === selectedId)?.id ??
        (guild
            ? defaultChannelId(guild, byGuild[guildId] ?? [], channels, session)
            : undefined) ??
        options[0]?.id

    const isHub = guild?.features?.includes(GuildFeature.HUB) ?? false
    const [applied, setApplied] = useState<InviteSettings>({
        maxAge: defaultMaxAge(isHub),
        maxUses: 0,
    })
    const [pending, setPending] = useState(applied)
    const { code, loading, error } = useInviteLink(
        channelId,
        applied,
        guild?.vanityUrlCode ?? undefined,
    )

    if (!guild) return null
    const channel = channelId ? channels[channelId] : undefined
    const url = code ? inviteUrl(code) : undefined
    const changed =
        pending.maxAge !== applied.maxAge || pending.maxUses !== applied.maxUses

    const copyLink = () => {
        if (!url) return
        Clipboard.setStringAsync(url).catch(() => {})
        showToast({
            key: 'invite-copied',
            content: t('chat.actions.copiedLink'),
        })
    }

    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader
                    title={t('invite.title')}
                    subtitle={channel ? `#${channel.name ?? ''}` : undefined}
                    trailing={<ActionSheetCloseButton />}
                />
            }
        >
            <View style={styles.linkCard}>
                {loading && !url ? (
                    <ActivityIndicator />
                ) : url ? (
                    <Text
                        variant="text-md/semibold"
                        color="TEXT_LINK"
                        selectable
                        lineClamp={1}
                    >
                        {url}
                    </Text>
                ) : (
                    <Text variant="text-sm/medium" color="TEXT_MUTED">
                        {error ?? t('invite.unavailable')}
                    </Text>
                )}
            </View>

            <View style={styles.buttons}>
                <Button
                    grow
                    variant="primary"
                    icon="LinkIcon"
                    text={t('chat.linkOptions.copyLink')}
                    disabled={!url}
                    onPress={copyLink}
                />
                <IconButton
                    variant="secondary"
                    icon="ArrowAngleRightUpIcon"
                    accessibilityLabel={t('invite.share')}
                    disabled={!url}
                    onPress={() => {
                        if (url) Share.share({ message: url }).catch(() => {})
                    }}
                />
            </View>

            {channelId && (
                <InviteSettingsRows settings={pending} onChange={setPending} />
            )}
            {changed && (
                <Button
                    variant="primary"
                    text={t('settings.save')}
                    onPress={() => setApplied(pending)}
                />
            )}
        </ActionSheet>
    )
}

const styles = StyleSheet.create(theme => ({
    linkCard: {
        minHeight: 48,
        paddingHorizontal: theme.space.PX_16,
        paddingVertical: theme.space.PX_12,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.CARD_MUTED_BG,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
    },
}))
