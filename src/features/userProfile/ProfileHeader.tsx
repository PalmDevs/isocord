import { Image } from 'expo-image'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../core/react'
import { StatusAvatar } from '../../design/components/avatars/StatusAvatar'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { presencesStore } from '../../stores/presences'
import { hexColor } from '../chat/color'
import { openImageViewer } from '../mediaViewer/store'
import {
    AVATAR_PADDING,
    AVATAR_SIZE,
    BANNER_CDN_SIZE,
    BANNER_HEIGHT,
    VIEWER_IMAGE_SIZE,
} from './constants'
import { ProfileStatusBubble } from './ProfileStatusBubble'
import { profileTopColor } from './profileColors'
import type { ReactNode } from 'react'
import type { ProfileView } from './useProfileView'

/**
 * UserProfileHeader: the banner (or the accent colour) with the avatar and its status over its lower edge, and the
 * owner's action at the top right. Tapping the banner or the avatar opens it in the media viewer.
 */
export function ProfileHeader({
    view,
    background,
    action,
}: {
    view: ProfileView
    /** The plain background behind the profile, for the cutout without a profile theme. */
    background: string
    /** The button at the top right, if any. */
    action?: ReactNode
}) {
    const session = useSession()
    const presence = useSessionStore(
        presencesStore,
        state => state.presences[view.user.id],
    )
    const banner = view.bannerUrl(BANNER_CDN_SIZE)
    const accent = view.profile?.user.accent_color
    // The theme's top colour under the dimming overlay, for the ring and the status cutout.
    const cutout = view.themeColors
        ? profileTopColor(view.themeColors)
        : background
    const avatar = view.avatarUrl(VIEWER_IMAGE_SIZE)
    return (
        <View>
            <RipplePressable
                accessibilityRole="imagebutton"
                disabled={!banner}
                onPress={() => {
                    const full = view.bannerUrl(VIEWER_IMAGE_SIZE)
                    if (full) openImageViewer(session, full)
                }}
                style={[
                    styles.banner,
                    accent ? { backgroundColor: hexColor(accent) } : undefined,
                ]}
            >
                {banner && <Image source={banner} style={styles.fill} />}
            </RipplePressable>
            {action && <View style={styles.action}>{action}</View>}
            {/* UserProfileAvatar: a disc of the background behind the avatar, cut out of the banner. */}
            <View style={styles.avatarRing(cutout)}>
                <RipplePressable
                    accessibilityRole="imagebutton"
                    borderless
                    radius={AVATAR_SIZE / 2}
                    // Avatars are square, asked for at VIEWER_IMAGE_SIZE.
                    onPress={() =>
                        openImageViewer(
                            session,
                            avatar,
                            VIEWER_IMAGE_SIZE,
                            VIEWER_IMAGE_SIZE,
                        )
                    }
                >
                    <StatusAvatar
                        user={view.user}
                        url={
                            view.guildAvatar
                                ? view.avatarUrl(AVATAR_SIZE * 3)
                                : undefined
                        }
                        size={AVATAR_SIZE}
                        status={presence?.status ?? 'offline'}
                        mobile={presence?.mobile}
                        streaming={presence?.streaming}
                        cutoutBackground={cutout}
                    />
                </RipplePressable>
            </View>
            <ProfileStatusBubble userId={view.user.id} />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    banner: {
        height: BANNER_HEIGHT,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
    },
    fill: { width: '100%', height: '100%' },
    action: {
        position: 'absolute',
        top: theme.space.PX_16,
        right: theme.space.PX_16,
    },
    avatarRing: (background: string) => ({
        position: 'absolute',
        top: BANNER_HEIGHT - AVATAR_SIZE / 2 - AVATAR_PADDING,
        left: theme.space.PX_16 - AVATAR_PADDING,
        padding: AVATAR_PADDING,
        borderRadius: theme.radii.round,
        backgroundColor: background,
    }),
}))
