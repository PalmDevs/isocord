import { computePermissions, Permission } from '../../core/discord/permissions'
import { useSession, useSessionStore } from '../../core/react'
import { showConfirmModal } from '../../design/components/modals/showAlert'
import { ContextMenu } from '../../design/components/overlays/ContextMenu'
import { TableRow, TableRowIcon } from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { guildsStore } from '../../stores/guilds'
import { banMember, kickMember, timeoutMember } from '../../stores/moderation'
import { TIMEOUT_DURATIONS } from './constants'
import { ProfileSection } from './ProfileSection'
import { useVoiceModeration } from './useVoiceModeration'

const MODERATION_ALERT_KEY = 'user-profile-moderation'

/**
 * UserProfileModeratorActions: Move to, Timeout, the voice rows, Kick and Ban. Timeout, Kick and Ban each sit
 * behind a confirmation, the voice rows (useVoiceModeration) run at once as the reference's do.
 * Icons as the reference: ClockWarningIcon, UserMinusIcon, HammerIcon. Shown to a member with the
 * permission, never for oneself or the server's owner.
 */
export function ProfileModeration({
    guildId,
    userId,
    name,
}: {
    guildId: string
    userId: string
    name: string
}) {
    const session = useSession()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const { moveRows, stateRows } = useVoiceModeration(guildId, userId)
    if (!guild) return null
    // Timeout, Kick and Ban never target ourselves or the owner. The voice rows do.
    const isOther = userId !== session.userId && userId !== guild.ownerId
    const permissions = computePermissions(guild, undefined, session.userId)
    const can = (bit: bigint) => (permissions & bit) === bit
    const canTimeout = isOther && can(Permission.MODERATE_MEMBERS)
    const canKick = isOther && can(Permission.KICK_MEMBERS)
    const canBan = isOther && can(Permission.BAN_MEMBERS)
    if (
        !canTimeout &&
        !canKick &&
        !canBan &&
        moveRows.length === 0 &&
        stateRows.length === 0
    )
        return null

    const confirm = (
        title: string,
        content: string,
        confirmText: string,
        onConfirm: () => Promise<void>,
    ) =>
        showConfirmModal({
            key: MODERATION_ALERT_KEY,
            title,
            content,
            confirmText,
            onConfirm,
        })
    return (
        <ProfileSection title={t('userProfile.moderatorActions')}>
            <TableRowGroup hasIcons>
                {moveRows}
                {canTimeout && (
                    <ContextMenu
                        triggerOnLongPress={false}
                        title={t('userProfile.timeoutDuration')}
                        items={TIMEOUT_DURATIONS.map(({ key, ms }) => ({
                            label: t(key),
                            onPress: () =>
                                confirm(
                                    t('userProfile.timeoutTitle', {
                                        user: name,
                                    }),
                                    t(key),
                                    t('userProfile.timeout'),
                                    () =>
                                        timeoutMember(
                                            session,
                                            guildId,
                                            userId,
                                            new Date(
                                                Date.now() + ms,
                                            ).toISOString(),
                                        ),
                                ),
                        }))}
                    >
                        {({ open }) => (
                            <TableRow
                                label={t('userProfile.timeout')}
                                icon={<TableRowIcon name="ClockWarningIcon" />}
                                onPress={open}
                            />
                        )}
                    </ContextMenu>
                )}
                {stateRows}
                {canKick && (
                    <TableRow
                        variant="danger"
                        label={t('userProfile.kick')}
                        icon={
                            <TableRowIcon
                                name="UserMinusIcon"
                                variant="danger"
                            />
                        }
                        onPress={() =>
                            confirm(
                                t('userProfile.kickTitle', { user: name }),
                                t('userProfile.kickBody', { user: name }),
                                t('userProfile.kick'),
                                () => kickMember(session, guildId, userId),
                            )
                        }
                    />
                )}
                {canBan && (
                    <TableRow
                        variant="danger"
                        label={t('userProfile.ban')}
                        icon={
                            <TableRowIcon name="HammerIcon" variant="danger" />
                        }
                        onPress={() =>
                            confirm(
                                t('userProfile.banTitle', { user: name }),
                                t('userProfile.banBody', { user: name }),
                                t('userProfile.ban'),
                                () => banMember(session, guildId, userId),
                            )
                        }
                    />
                )}
            </TableRowGroup>
        </ProfileSection>
    )
}
