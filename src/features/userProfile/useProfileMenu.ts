import * as Clipboard from 'expo-clipboard'
import { RelationshipType } from '../../core/discord/relationships'
import { useSession } from '../../core/react'
import { showConfirmModal } from '../../design/components/modals/showAlert'
import { showToast } from '../../design/components/overlays/toastStore'
import { t } from '../../i18n'
import {
    blockUser,
    ignoreUser,
    removeFriend,
    unblockUser,
    unignoreUser,
    useIsIgnored,
    useRelationshipType,
} from '../../stores/relationships'
import type { ContextMenuItemDef } from '../../design/components/overlays/ContextMenu'
import type { ProfileView } from './useProfileView'

const CONFIRM_KEY = 'user-profile-confirm'

/**
 * UserProfileActionSheet's more menu: the server profile switch, copy actions, ignore, block, and Remove Friend for
 * a friend. Block and Remove Friend confirm first. Invite to Server and Apps do nothing yet.
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
    const blocked = relationship === RelationshipType.BLOCKED
    const copy = (text: string) => {
        Clipboard.setStringAsync(text).then(() =>
            showToast({
                key: 'profile-copied',
                content: t('chat.copiedToClipboard'),
            }),
        )
    }
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
            // Over the profile sheet, which stays open.
            layer: 'aboveSheets',
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
    items.push(
        { label: t('userProfile.inviteToServer'), icon: 'UserPlusIcon' },
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
    items.push(
        {
            label: ignored
                ? t('userProfile.unignore')
                : t('userProfile.ignore'),
            icon: 'EyeSlashIcon',
            action: () =>
                ignored ? unignoreUser(session, id) : ignoreUser(session, id),
        },
        {
            label: blocked ? t('userProfile.unblock') : t('userProfile.block'),
            icon: 'DenyIcon',
            variant: 'destructive',
            action: () =>
                blocked
                    ? unblockUser(session, id)
                    : confirm(
                          t('userProfile.blockTitle', { name: view.name }),
                          t('userProfile.blockBody', { name: view.name }),
                          t('userProfile.block'),
                          () => blockUser(session, id),
                      ),
        },
    )
    return items
}
