import { ChannelType } from '../../core/discord/channelType'
import { computePermissions, Permission } from '../../core/discord/permissions'
import { useSession, useSessionStore } from '../../core/react'
import { showSimpleActionSheet } from '../../design/components/sheets/showSimpleActionSheet'
import { TableRow, TableRowIcon } from '../../design/components/table/TableRow'
import { t } from '../../i18n'
import { channelsStore, isVoice } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { membersStore } from '../../stores/members'
import {
    channelPermissions,
    useChannelPermissions,
} from '../../stores/permissions'
import {
    setMemberVoiceChannel,
    setServerDeaf,
    setServerMute,
} from '../../stores/voiceModeration'
import { guildVoiceState, voiceStatesStore } from '../../stores/voiceStates'
import { channelIcon } from '../servers/channelIcon'
import { showToast } from '../toasts'
import { isChannelFull } from '../voice/joinChecks'
import type { ReactElement } from 'react'
import type { Session } from '../../core/session'

const MOVE_PICKER_SHEET_KEY = 'voice-move-to'

/** Runs a moderation request, toasting the generic error when it fails. */
async function run(request: Promise<void>) {
    try {
        await request
    } catch {
        showToast({ content: t('error.generic'), variant: 'critical' })
    }
}

/**
 * UserProfileModeratorActions' `channels`: the guild's voice channels but the user's own the moderator can move
 * them to. Needs MOVE_MEMBERS there, CONNECT for the moderator or the user, and room.
 */
function moveTargets(
    session: Session,
    guildId: string,
    userId: string,
    currentId: string,
) {
    const { channels } = session.get(channelsStore).getState()
    const guild = session.get(guildsStore).getState().guilds[guildId]
    const roles =
        session.get(membersStore).getState().members[guildId]?.[userId]
            ?.roles ?? []
    const canUserConnect = (channelId: string) =>
        guild !== undefined &&
        (computePermissions(
            { ...guild, myRoles: roles },
            channels[channelId],
            userId,
        ) &
            Permission.CONNECT) !==
            0n
    return Object.values(channels)
        .filter(
            channel =>
                channel.guild_id === guildId &&
                isVoice(channel) &&
                channel.id !== currentId &&
                (channelPermissions(session, channel.id) &
                    Permission.MOVE_MEMBERS) !==
                    0n &&
                ((channelPermissions(session, channel.id) &
                    Permission.CONNECT) !==
                    0n ||
                    canUserConnect(channel.id)) &&
                !isChannelFull(session, channel.id),
        )
        .sort(
            (a, b) =>
                (a.position ?? 0) - (b.position ?? 0) ||
                a.id.localeCompare(b.id),
        )
}

/** The "Move to" row's sheet: ChannelPicker titled "Select a Channel". */
function openMovePicker(
    session: Session,
    guildId: string,
    userId: string,
    currentId: string,
) {
    showSimpleActionSheet({
        key: MOVE_PICKER_SHEET_KEY,
        header: { title: t('voice.selectChannel') },
        options: moveTargets(session, guildId, userId, currentId).map(
            channel => ({
                label: channel.name ?? channel.id,
                icon: channelIcon(channel.type),
                onPress: () =>
                    run(
                        setMemberVoiceChannel(
                            session,
                            guildId,
                            userId,
                            channel.id,
                        ),
                    ),
            }),
        ),
    })
}

/**
 * The voice rows of UserProfileModeratorActions for a user in a voice channel of the guild: "Move to" (before
 * Timeout), then Server Mute, Server Deafen and Disconnect (before Kick). Each is gated by its permission in the
 * user's voice channel, also for ourselves. Stage channels are left out.
 */
export function useVoiceModeration(guildId: string, userId: string) {
    const session = useSession()
    const voice = useSessionStore(voiceStatesStore, state =>
        guildVoiceState(state, guildId, userId),
    )
    const channelId = voice?.channelId
    const channel = useSessionStore(channelsStore, state =>
        channelId ? state.channels[channelId] : undefined,
    )
    const permissions = useChannelPermissions(channelId ?? '')
    const none: ReactElement[] = []
    if (
        !voice ||
        !channelId ||
        !channel ||
        channel.type === ChannelType.GUILD_STAGE_VOICE
    )
        return { moveRows: none, stateRows: none }
    const can = (bit: bigint) => (permissions & bit) === bit
    const moveRows = can(Permission.MOVE_MEMBERS)
        ? [
              <TableRow
                  key="move-to"
                  label={t('voice.moveTo')}
                  subLabel={channel.name}
                  arrow
                  icon={<TableRowIcon name="VoiceNormalIcon" />}
                  onPress={() =>
                      openMovePicker(session, guildId, userId, channelId)
                  }
              />,
          ]
        : []
    const stateRows: ReactElement[] = []
    if (can(Permission.MUTE_MEMBERS))
        stateRows.push(
            <TableRow
                key="server-mute"
                label={
                    voice.mute ? t('voice.serverUnmute') : t('voice.serverMute')
                }
                icon={
                    <TableRowIcon
                        name={
                            voice.mute
                                ? 'MicrophoneSlashIcon'
                                : 'MicrophoneIcon'
                        }
                    />
                }
                onPress={() =>
                    run(setServerMute(session, guildId, userId, !voice.mute))
                }
            />,
        )
    if (can(Permission.DEAFEN_MEMBERS))
        stateRows.push(
            <TableRow
                key="server-deafen"
                label={
                    voice.deaf
                        ? t('voice.serverUndeafen')
                        : t('voice.serverDeafen')
                }
                icon={
                    <TableRowIcon
                        name={
                            voice.deaf
                                ? 'HeadphonesSlashIcon'
                                : 'HeadphonesIcon'
                        }
                    />
                }
                onPress={() =>
                    run(setServerDeaf(session, guildId, userId, !voice.deaf))
                }
            />,
        )
    if (can(Permission.MOVE_MEMBERS))
        stateRows.push(
            <TableRow
                key="disconnect"
                variant="danger"
                label={t('voice.disconnect')}
                icon={<TableRowIcon name="PhoneHangUpIcon" variant="danger" />}
                onPress={() =>
                    run(setMemberVoiceChannel(session, guildId, userId, null))
                }
            />,
        )
    return { moveRows, stateRows }
}
