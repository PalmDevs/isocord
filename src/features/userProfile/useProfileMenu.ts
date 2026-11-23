import * as Clipboard from 'expo-clipboard'
import { RelationshipType } from '../../core/discord/relationships'
import { useSession } from '../../core/react'
import { showConfirmModal } from '../../design/components/modals/showAlert'
import { showToast } from '../../design/components/overlays/toastStore'
import { t } from '../../i18n'
import {
    removeFriend,
    unblockUser,
    unignoreUser,
    useIsIgnored,
    useRelationshipType,
} from '../../stores/relationships'
import { openRestrictionConfirmation } from './safety/RestrictionConfirmationSheet'
import type { ContextMenuItemDef } from '../../design/components/overlays/ContextMenu'
import type { ProfileView } from './useProfileView'

const CONFIRM_KEY = 'user-profile-confirm'

/**
 * UserProfileOverflowMenu: the server profile switch, copy actions, Remove Friend for a friend, then ignore and block.
 * Remove Friend confirms in an alert, Ignore and Block in a sheet over the profile. Invite to Server and Apps do
 * nothing yet.
 */
export function useProfileMenu(
    view: ProfileView,
    toggleServerProfile: () => void,
    /** The server the sheet was opened in, which the switch toggles to. */
    contextGuildId: string | undefined,
): ContextMenuItemDef[] {
    const session = useSession()
    const relationship = useRelationshipType(view.user.id)
    const ignored = useIsIgnored(view.user.id)
    const { id, username } = view.user
    const isNotSelf = session.userId !== id
    const blocked = relationship === RelationshipType.BLOCKED
    const copy = (text: string) => {
        Clipboard.setStringAsync(text).then(() =>
            showToast({
                key: 'profile-copied',
                content: t('chat.copiedToClipboard'),
            }),
        )
    }
    // showUnblockSuccessToast.
    const unblock = () =>
        unblockUser(session, id).then(() =>
            showToast({
                content: t('userProfile.unblocked', { username: view.name }),
                variant: 'success',
            }),
        )
    const confirm = (
        title: string,
        content: string,
        confirmText: string,
        onConfirm: () => Promise<void>,
    ) =>
        showConfirmModal({
            key: CONFIRM_KEY,
            title,
            content,
            confirmText,
            onConfirm,
        })

    const items: ContextMenuItemDef[] = []
    if (contextGuildId)
        items.push({
            label: view.guildId
                ? t('userProfile.viewMainProfile')
                : t('userProfile.viewServerProfile'),
            icon: 'UserSquareIcon',
            action: toggleServerProfile,
        })
    if (isNotSelf)
        items.push({
            label: t('userProfile.inviteToServer'),
            icon: 'UserPlusIcon',
        })
    items.push(
        {
            label: t('userProfile.copyUsername'),
            icon: 'CopyIcon',
            action: () => copy(username),
        },
        {
            label: t('userProfile.copyUserId'),
            icon: 'IdIcon',
            action: () => copy(id),
        },
        { label: t('userProfile.apps'), icon: 'AppsIcon', divider: true },
    )
    if (relationship === RelationshipType.FRIEND)
        items.push({
            label: t('userProfile.removeFriend'),
            icon: 'UserMinusIcon',
            variant: 'destructive',
            action: () =>
                confirm(
                    t('userProfile.removeFriend'),
                    t('userProfile.removeFriendBody', { name: view.name }),
                    t('userProfile.removeFriend'),
                    () => removeFriend(session, id),
                ),
        })
    // A blocked user can be neither ignored nor unignored here.
    if (!blocked && isNotSelf)
        items.push({
            label: ignored
                ? t('userProfile.unignore')
                : t('userProfile.ignore'),
            icon: 'EyeSlashIcon',
            action: () =>
                ignored
                    ? unignoreUser(session, id)
                    : openRestrictionConfirmation('ignore', id, view.name),
        })
    if (isNotSelf)
        items.push({
            label: blocked ? t('userProfile.unblock') : t('userProfile.block'),
            icon: 'DenyIcon',
            variant: 'destructive',
            action: () =>
                blocked
                    ? unblock()
                    : openRestrictionConfirmation('block', id, view.name),
        })
    return items
}
