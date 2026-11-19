import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { rawColors } from '../../tokens/generated/rawColors'
import { Avatar } from './Avatar'
import type { Status } from '../../../core/discord/status'
import type { AvatarUser } from './avatarUrl'

// design/void/Status: StatusSizes, STATUS_PADDING and getStatusContainerStyle.
const STATUS_PADDING = 3

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

/** Size of the status container: the icon plus STATUS_PADDING around it, taller for the phone. */
function containerSize(size: number, mobile: boolean) {
    const side = size + 2 * STATUS_PADDING
    return {
        width: side,
        height: mobile ? side * 1.4 : side,
        radius: mobile ? side / 4 : side / 2,
        paddingY: STATUS_PADDING + (mobile ? 1 : 0),
    }
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
    /**
     * The opaque colour behind the avatar (CutoutBackgroundProvider). The cutout and the holes of the status are
     * drawn in it over a plain avatar (ClipView's SolidCutoutOverlay), rather than masked out with react-native-svg,
     * whose views draw in software into a bitmap of their own on every change.
     */
    cutoutBackground: string
}

/**
 * Draws the status of SolidCutoutOverlay: getStatusContainerStyle filled with the background.
 * It doubles as the avatar cutout (same centre, radius status / 2 + STATUS_PADDING).
 * The shapes follow the reference's status masks (StatusOnline, StatusIdle, StatusDND, ...).
 * Idle is a disc with a notch, dnd a disc with a bar, offline a ring, streaming a disc with a play triangle.
 */
function SolidStatus({
    status,
    size,
    mobile,
    streaming,
    background,
}: {
    status: Status
    size: number
    mobile: boolean
    streaming: boolean
    background: string
}) {
    const { theme } = useUnistyles()
    const phone = mobile && !streaming
    const box = containerSize(size, phone)
    const height = box.height - 2 * box.paddingY
    const kind = streaming
        ? 'streaming'
        : phone
          ? 'online'
          : status === 'invisible'
            ? 'offline'
            : status
    const color = STATUS_COLORS[kind]
    // A hole of the mask: a block of the background at (x, y), `width` by `height`, with corners of `radius`.
    const hole = (x: number, y: number, w: number, h: number, r: number) => (
        <View style={styles.hole(x, y, w, h, r, background)} />
    )
    return (
        <View
            style={styles.solidStatus(
                box.width,
                box.height,
                box.radius,
                box.paddingY,
                background,
            )}
        >
            <View
                style={styles.shape(
                    size,
                    phone ? height : size,
                    phone ? size * 0.1875 : size / 2,
                    color,
                )}
            >
                {phone &&
                    hole(
                        size * 0.125,
                        height * (2 / 12),
                        size * 0.75,
                        height * (7 / 12),
                        size * 0.0625,
                    )}
                {kind === 'idle' &&
                    hole(
                        size * -0.125,
                        size * -0.125,
                        size * 0.75,
                        size * 0.75,
                        size * 0.375,
                    )}
                {kind === 'dnd' &&
                    hole(
                        size * 0.125,
                        size * 0.375,
                        size * 0.75,
                        size * 0.25,
                        size * 0.125,
                    )}
                {kind === 'offline' &&
                    hole(
                        size * 0.25,
                        size * 0.25,
                        size * 0.5,
                        size * 0.5,
                        size * 0.25,
                    )}
                {kind === 'streaming' && (
                    <View style={styles.play(size, theme.colors.WHITE)} />
                )}
            </View>
        </View>
    )
}

/** Avatar with the status icon in its bottom-right corner, cut out of the avatar like the reference. */
export function StatusAvatar({
    user,
    url,
    size = 40,
    status,
    mobile = false,
    streaming = false,
    cutoutBackground,
}: StatusAvatarProps) {
    const statusSize = statusSizeForAvatar(size)
    return (
        <View style={styles.container(size)}>
            <Avatar user={user} size={size} url={url} />
            {status && statusSize > 0 && (
                <View style={styles.status}>
                    <SolidStatus
                        status={status}
                        size={statusSize}
                        mobile={mobile}
                        streaming={streaming}
                        background={cutoutBackground}
                    />
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: (size: number) => ({ width: size, height: size }),
    // design/void/Avatar: `status: { position: 'absolute', right: -3, bottom: -3 }`.
    status: {
        position: 'absolute',
        right: -STATUS_PADDING,
        bottom: -STATUS_PADDING,
    },
    solidStatus: (
        width: number,
        height: number,
        radius: number,
        paddingY: number,
        background: string,
    ) => ({
        width,
        height,
        borderRadius: radius,
        paddingHorizontal: STATUS_PADDING,
        paddingVertical: paddingY,
        backgroundColor: background,
    }),
    shape: (width: number, height: number, radius: number, color: string) => ({
        width,
        height,
        borderRadius: radius,
        backgroundColor: color,
    }),
    hole: (
        left: number,
        top: number,
        width: number,
        height: number,
        radius: number,
        background: string,
    ) => ({
        position: 'absolute',
        left,
        top,
        width,
        height,
        borderRadius: radius,
        backgroundColor: background,
    }),
    // The streaming status's play triangle, (0.38, 0.28), (0.76, 0.5), (0.38, 0.72) of the disc, as a bordered empty view.
    play: (size: number, color: string) => ({
        position: 'absolute',
        left: size * 0.38,
        top: size * 0.28,
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.38,
        borderTopWidth: size * 0.22,
        borderBottomWidth: size * 0.22,
        borderLeftColor: color,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
    }),
})
