import { ChannelType } from '../../core/discord/channelType'
import { channelPermalink } from '../../core/discord/permalink'
import { t } from '../../i18n'
import { isThread } from '../../stores/channels/channels'
import {
    canDuplicateChannel,
    canEditChannel,
    closeDm,
    confirmLeaveGroup,
    openDuplicateChannel,
    openEditChannel,
    openEditGroup,
} from '../channelSettings'
import { openUserProfile } from '../chat/headerActions'
import { copy } from '../chat/longPress/messageActionRows'
import { setPinned } from '../notificationSettings'
import {
    copyIdAction,
    isCategory,
    isGuildChannel,
    muteActions,
    readActions,
} from './rows'
import { threadActionGroups } from './threadActions'
import type { ChannelAction, ChannelActionEnv } from './rows'

export type {
    ChannelAction,
    ChannelActionEnv,
    ChannelActionNavigation,
} from './rows'

/** The "dm" section: Profile and Close DM of a 1:1 DM. */
function dmActions({ session, channel }: ChannelActionEnv): ChannelAction[] {
    if (channel.type !== ChannelType.DM) return []
    const recipientId = channel.recipient_ids?.[0]
    const profile: ChannelAction[] = recipientId
        ? [
              {
                  key: 'profile',
                  label: t('channelActions.profile'),
                  icon: 'UserCircleIcon',
                  onPress: () => openUserProfile(session, recipientId),
              },
          ]
        : []
    return [
        ...profile,
        {
            key: 'closeDm',
            label: t('channelActions.closeDm'),
            icon: 'UserMinusIcon',
            onPress: () => void closeDm(session, channel.id),
        },
    ]
}

/** The "channel-actions" section: Pin Channel to Top, then Copy Link. Invite and the opt-in rows are left out. */
function linkActions({
    session,
    channel,
    pinned,
}: ChannelActionEnv): ChannelAction[] {
    if (!isGuildChannel(channel) || isCategory(channel)) return []
    const copyLink: ChannelAction = {
        key: 'copyLink',
        label: t('chat.linkOptions.copyLink'),
        icon: 'LinkIcon',
        onPress: () =>
            copy(channelPermalink(channel.guild_id, channel.id), 'link'),
    }
    return [
        {
            key: 'pin',
            label: t(
                pinned
                    ? 'channelActions.unpinChannel'
                    : 'channelActions.pinChannel',
            ),
            icon: 'PinIcon',
            onPress: () => setPinned(session, channel, !pinned),
        },
        copyLink,
    ]
}

/** The "notifications" section: Mark Unread, Mark As Read, Mute or Unmute, Notification Settings. */
function notificationActions(env: ChannelActionEnv): ChannelAction[] {
    return [...readActions(env), ...muteActions(env)]
}

/** The "admin-actions" section: Edit Channel or Category, Duplicate Channel, Copy Channel ID. */
function adminActions(env: ChannelActionEnv): ChannelAction[] {
    const { session, channel, navigation } = env
    const actions: ChannelAction[] = []
    if (canEditChannel(session, channel))
        actions.push({
            key: 'edit',
            label: t(
                isCategory(channel)
                    ? 'channelActions.editCategory'
                    : 'channelActions.editChannel',
            ),
            icon: 'SettingsIcon',
            onPress: () => openEditChannel(navigation, channel.id),
        })
    // Our addition: CreateChannelModal's clone, next to Edit. The reference's Duplicate/Create row opens the modal.
    if (canDuplicateChannel(session, channel))
        actions.push({
            key: 'duplicate',
            label: t('channelActions.duplicateChannel'),
            icon: 'CopyIcon',
            onPress: () => openDuplicateChannel(navigation, channel.id),
        })
    actions.push(...copyIdAction(env))
    return actions
}

/** The group DM sections: Customize Group, then the destructive Leave Group. */
function groupActions({
    session,
    channel,
    navigation,
}: ChannelActionEnv): ChannelAction[][] {
    if (channel.type !== ChannelType.GROUP_DM) return []
    return [
        [
            {
                key: 'customizeGroup',
                label: t('groupCustomize.title'),
                icon: 'PencilIcon',
                onPress: () => openEditGroup(navigation, channel.id),
            },
        ],
        [
            {
                key: 'leaveGroup',
                label: t('channelActions.leaveGroup'),
                icon: 'UserMinusIcon',
                isDestructive: true,
                onPress: () => confirmLeaveGroup(session, channel.id),
            },
        ],
    ]
}

/** getActionSheetButtons: the sections of the channel long press sheet, in the reference's order. */
export function channelActionGroups(env: ChannelActionEnv): ChannelAction[][] {
    if (isThread(env.channel))
        return threadActionGroups(env).filter(group => group.length > 0)
    return [
        dmActions(env),
        linkActions(env),
        notificationActions(env),
        adminActions(env),
        ...groupActions(env),
    ].filter(group => group.length > 0)
}
