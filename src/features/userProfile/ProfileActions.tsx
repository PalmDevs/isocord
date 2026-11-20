import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { RelationshipType } from '../../core/discord/relationships'
import { useSession } from '../../core/react'
import { Button } from '../../design/components/buttons/Button'
import { IconButton } from '../../design/components/buttons/IconButton'
import { Stack } from '../../design/components/layout/Stack'
import { showToast } from '../../design/components/overlays/toastStore'
import { useCloseSheet } from '../../design/components/sheets/sheetContext'
import { t } from '../../i18n'
import {
    openDmChannel,
    sendFriendRequest,
    useRelationshipType,
} from '../../stores/relationships'
import { isWebhookUser } from '../../stores/users'
import { openChannel } from '../chat/links/openChannel'
import type { ButtonProps } from '../../design/components/buttons/Button'
import type { User } from '../../stores/users'

/**
 * UserProfileActions: Message, the friend button for the relationship, and Call (voice is not supported).
 * A bot gets Message only for now. A blocked user gets Add Friend and Call disabled.
 */
export function ProfileActions({ user }: { user: User }) {
    const userId = user.id
    const session = useSession()
    const closeSheet = useCloseSheet()
    const relationship = useRelationshipType(userId)
    const blocked = relationship === RelationshipType.BLOCKED
    // A webhook cannot be messaged.
    if (userId === session.userId || isWebhookUser(user)) return null

    const friend = friendButton(relationship, {
        add: () =>
            sendFriendRequest(session, userId).then(() =>
                showToast({
                    key: 'friend-request',
                    content: t('userProfile.friendRequestSent'),
                }),
            ),
        accept: () => sendFriendRequest(session, userId),
    })
    const message = async () => {
        const channelId = await openDmChannel(session, userId)
        closeSheet()
        openChannel(channelId)
    }
    const messageButton = (
        <View style={styles.action}>
            <Button
                grow
                variant="secondary"
                icon="ChatIcon"
                text={t('userProfile.message')}
                onPress={message}
            />
        </View>
    )
    if (user.bot)
        return (
            <Stack direction="horizontal" spacing={8} style={styles.row}>
                {messageButton}
            </Stack>
        )
    const call = () =>
        showToast({
            key: 'profile-call',
            content: t('userProfile.callUnavailable'),
        })
    // Not friends: the friend button has a label and the others are icons. Friends: two labelled buttons.
    if (friend && relationship !== RelationshipType.FRIEND)
        return (
            <Stack direction="horizontal" spacing={8} style={styles.row}>
                <View style={styles.action}>
                    <Button grow variant="primary" {...friend} />
                </View>
                <IconButton
                    icon="ChatIcon"
                    variant="secondary"
                    accessibilityLabel={t('userProfile.message')}
                    onPress={message}
                />
                <IconButton
                    icon="PhoneCallIcon"
                    variant="secondary"
                    accessibilityLabel={t('userProfile.call')}
                    onPress={call}
                    disabled={blocked}
                />
            </Stack>
        )
    return (
        <Stack direction="horizontal" spacing={8} style={styles.row}>
            {messageButton}
            <View style={styles.action}>
                <Button
                    grow
                    variant="secondary"
                    icon="PhoneCallIcon"
                    text={t('userProfile.call')}
                    onPress={call}
                    disabled={blocked}
                />
            </View>
        </Stack>
    )
}

/** Returns the friend button's props for a relationship, undefined for a friend. Disabled for a blocked user. */
function friendButton(
    relationship: number | undefined,
    on: { add: () => void; accept: () => void },
): ButtonProps | undefined {
    switch (relationship) {
        case RelationshipType.FRIEND:
            return undefined
        case RelationshipType.BLOCKED:
            return {
                icon: 'UserPlusIcon',
                text: t('userProfile.addFriend'),
                disabled: true,
            }
        case RelationshipType.PENDING_OUTGOING:
            return {
                icon: 'ClockIcon',
                text: t('userProfile.pending'),
                disabled: true,
            }
        case RelationshipType.PENDING_INCOMING:
            return {
                icon: 'UserPlusIcon',
                text: t('userProfile.accept'),
                variant: 'primary',
                onPress: on.accept,
            }
        default:
            return {
                icon: 'UserPlusIcon',
                text: t('userProfile.addFriend'),
                onPress: on.add,
            }
    }
}

const styles = StyleSheet.create({
    row: { alignItems: 'center' },
    action: { flex: 1 },
})
