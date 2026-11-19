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

const MODERATION_ALERT_KEY = 'user-profile-moderation'

/**
 * UserProfileModeratorActions: Timeout, Kick and Ban, each behind a confirmation.
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
    if (!guild || userId === session.userId || userId === guild.ownerId)
        return null
    const permissions = computePermissions(guild, undefined, session.userId)
    const can = (bit: bigint) => (permissions & bit) === bit
    const canTimeout = can(Permission.MODERATE_MEMBERS)
    const canKick = can(Permission.KICK_MEMBERS)
    const canBan = can(Permission.BAN_MEMBERS)
    if (!canTimeout && !canKick && !canBan) return null

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
            // Over the profile sheet, which stays open.
            layer: 'aboveSheets',
        })
    return (
        <ProfileSection title={t('userProfile.moderatorActions')}>
            <TableRowGroup hasIcons>
                {canTimeout && (
                    <ContextMenu
                        triggerOnLongPress={false}
                        title={t('userProfile.timeoutDuration')}
                        items={TIMEOUT_DURATIONS.map(({ key, ms }) => ({
                            label: t(key),
                            action: () =>
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
