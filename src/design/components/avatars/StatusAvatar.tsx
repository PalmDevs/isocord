import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import CutoutView from '../../../native/CutoutViewNativeComponent'
import { rawColors } from '../../tokens/generated/rawColors'
import { Avatar } from './Avatar'
import type { Status } from '../../../core/discord/status'
import type { AvatarUser } from './avatarUrl'

const STATUS_COLORS = {
    online: rawColors.GREEN_360,
    idle: rawColors.YELLOW_300,
    dnd: rawColors.RED_400,
    offline: rawColors.PRIMARY_400,
    streaming: rawColors.PLATFORM_TWITCH,
}

/** design/void/Avatar getStatusSize, by the pixel sizes of CutoutableAvatarImage.AVATAR_SIZE_MAP. Avatars below 18 have no status. */
const STATUS_SIZE_BY_AVATAR: Record<number, number> = {
    18: 8,
    20: 8,
    24: 8,
    30: 8,
    32: 10,
    22: 12,
    40: 12,
    50: 12,
    48: 16,
    60: 16,
    64: 16,
    72: 16,
    80: 16,
    128: 16,
}

function statusSizeForAvatar(avatar: number): number {
    const exact = STATUS_SIZE_BY_AVATAR[avatar]
    if (exact !== undefined) return exact
    if (avatar < 18) return 0
    if (avatar <= 30) return 8
    if (avatar <= 32) return 10
    if (avatar <= 40) return 12
    return 16
}

export interface StatusAvatarProps {
    user: AvatarUser
    /** Overrides the user's own avatar, such as a server avatar. */
    url?: string
    size?: number
    status?: Status
    /** Online on mobile only (Presence.mobile). */
    mobile?: boolean
    /** Streaming (Presence.streaming). */
    streaming?: boolean
    /** Kept for callers; CutoutView clips the avatar and status holes natively. */
    cutoutBackground?: string
}

/** Avatar with the status icon in its bottom-right corner, cut out of the avatar like the reference. */
export function StatusAvatar({
    user,
    url,
    size = 40,
    status,
    mobile = false,
    streaming = false,
}: StatusAvatarProps) {
    const { theme } = useUnistyles()
    const statusSize = statusSizeForAvatar(size)
    const phone = mobile && !streaming
    const kind = status
        ? streaming
            ? 'streaming'
            : phone
              ? 'online'
              : status === 'invisible'
                ? 'offline'
                : status
        : undefined
    return (
        <CutoutView
            style={styles.container(size)}
            status={kind}
            statusSize={kind ? statusSize : 0}
            mobile={phone}
            statusColor={kind ? STATUS_COLORS[kind] : undefined}
            playColor={theme.colors.WHITE}
        >
            <Avatar user={user} size={size} url={url} />
        </CutoutView>
    )
}

const styles = StyleSheet.create({
    container: (size: number) => ({ width: size, height: size }),
})
