import { showAlert } from '../../design/components/modals/showAlert'
import { showToast } from '../../design/components/overlays/toastStore'
import { openActionSheet } from '../../design/components/sheets/sheetStore'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { membersStore } from '../../stores/members'
import { findMessage, messagesStore } from '../../stores/messages/messages'
import { displayName, usersStore } from '../../stores/users'
import { openProfileSheet } from '../userProfile/openProfileSheet'
import { authorStyle } from './author'
import { TempGuildInfoSheet } from './TempGuildInfoSheet'
import type { Session } from '../../core/session'
import type { User } from '../../stores/users'
import type { ComposerApi } from './composer'
import type { HeaderPart } from './headerParts'

interface HeaderContext {
    session: Session
    channelId: string
    /** Absent in a message preview, which has no composer. */
    composer?: ComposerApi
}

/** Tap on the name, avatar, server tag or role icon of a message (the reference's message header press targets). */
export function handleHeaderPress(
    part: HeaderPart,
    messageId: string,
    { session, channelId, composer }: HeaderContext,
): void {
    const message = findMessage(
        session.get(messagesStore).getState(),
        channelId,
        messageId,
    )
    if (!message) return
    const users = session.get(usersStore).getState().users
    const user = users[message.author.id] ?? message.author
    // The channel's server, as the rows use: only gateway messages carry guild_id, fetched history does not.
    const guildId = session.get(channelsStore).getState().channels[
        channelId
    ]?.guild_id
    const guild = guildId
        ? session.get(guildsStore).getState().guilds[guildId]
        : undefined
    const member = guildId
        ? session.get(membersStore).getState().members[guildId]?.[user.id]
        : undefined
    const name = displayName(user, member?.nick)

    switch (part) {
        case 'name':
            // Like autocomplete: a name parse.ts finds again and turns into <@id> on send.
            if (!composer) return
            composer.insertText(`@${name}`, { space: true })
            composer.focus()
            return
        case 'avatar':
            openProfileSheet(session, user.id, guildId)
            return
        case 'guild-tag':
            openGuildTagSheet(session, user)
            return
        case 'role-icon': {
            const style = authorStyle(guild, member)
            const role = style.roleIconRoleId
                ? guild?.roles[style.roleIconRoleId]
                : undefined
            if (role?.name)
                showRoleToast(
                    role.name,
                    style.roleIcon?.url,
                    style.roleIcon?.emoji,
                )
            return
        }
        case 'silent':
            // handleTapSuppressNotificationsIcon.
            showToast({
                key: 'SUPPRESS_NOTIFICATIONS_TOOLTIP',
                content: t('chat.silentMessage.toast'),
            })
    }
}

/**
 * Opens the profile sheet of a mentioned user. Like the reference, a user we have no record of gets an
 * "unknown user" alert instead.
 */
export function openUserProfile(
    session: Session,
    userId: string,
    guildId?: string,
): void {
    const user = session.get(usersStore).getState().users[userId]
    if (!user) {
        showAlert({
            key: 'unknown-user',
            title: t('chat.mention.unknownUser.title'),
            content: t('chat.mention.unknownUser.body'),
            confirmText: t('chat.mention.unknownUser.confirm'),
        })
        return
    }
    openProfileSheet(session, userId, guildId)
}

/** Opens the server of a user's server tag (GuildTag press). Nothing for a user without one. */
export function openGuildTagSheet(session: Session, user: User): void {
    const tagGuild = user.primary_guild
    const tagGuildId = tagGuild?.identity_guild_id
    if (!tagGuild?.tag || !tagGuildId) return
    const known = session.get(guildsStore).getState().guilds[tagGuildId]
    if (known) {
        void import('../servers/guildActions').then(
            ({ openGuildActionSheet }) => {
                openGuildActionSheet(known)
            },
        )
        return
    }
    openActionSheet(
        'guild-tag',
        <TempGuildInfoSheet
            guildId={tagGuildId}
            icon={null}
            tag={tagGuild.tag}
        />,
    )
}

/** The toast of a tapped role icon: the role's icon (image or emoji) and its name. */
function showRoleToast(
    roleName: string,
    iconUrl?: string,
    emoji?: string,
): void {
    // One key: tapping another role icon replaces the toast instead of queueing behind it.
    showToast({
        key: 'role-icon',
        content: emoji && !iconUrl ? `${emoji} ${roleName}` : roleName,
        iconUrl,
    })
}
