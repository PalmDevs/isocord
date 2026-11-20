import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../core/react'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { presencesStore } from '../../stores/presences'
import { AVATAR_SIZE, BANNER_HEIGHT } from './constants'
import { openCustomStatusAlert } from './customStatus/CustomStatusAlert'
import { StatusEmoji } from './StatusEmoji'

/** UserProfileCustomStatusBubble: the custom status wraps to two lines at most. */
const STATUS_LINES = 2
/** The thought bubble's trail: a small and a large dot between the avatar and the bubble. */
const SMALL_DOT = 8
const LARGE_DOT = 14
/** emojiOnlyEmojiSize: an emoji with no text shows larger. */
const EMOJI_ONLY_SIZE = 32
/** Fonts.PRIMARY_NORMAL_ITALIC: the placeholder's italic face. */
const PRIMARY_NORMAL_ITALIC = 'ggsans-NormalItalic'

/**
 * UserProfileCustomStatusBubble: the custom status in a thought bubble beside the avatar. On the user's own
 * profile it is a button that edits the status, with a placeholder when there is none. Drawn as two dots
 * instead of the reference's SVG tail.
 */
export function ProfileStatusBubble({ userId }: { userId: string }) {
    const session = useSession()
    const text = useSessionStore(
        presencesStore,
        state => state.presences[userId]?.customStatus,
    )
    const emoji = useSessionStore(
        presencesStore,
        state => state.presences[userId]?.customEmoji,
    )
    const self = userId === session.userId
    if (!text && !emoji && !self) return null
    const content =
        text || emoji ? (
            <View style={styles.status}>
                {emoji && (
                    <StatusEmoji
                        emoji={emoji}
                        size={text ? undefined : EMOJI_ONLY_SIZE}
                    />
                )}
                {text ? (
                    <Text
                        variant="text-md/medium"
                        color="TEXT_DEFAULT"
                        lineClamp={STATUS_LINES}
                        style={styles.text}
                    >
                        {text}
                    </Text>
                ) : null}
            </View>
        ) : (
            <View style={styles.status}>
                <Icon name="CirclePlusIcon" size="xs" color="TEXT_SUBTLE" />
                <Text
                    variant="text-md/normal"
                    color="TEXT_SUBTLE"
                    lineClamp={STATUS_LINES}
                    style={styles.placeholder}
                >
                    {t('userProfile.statusPlaceholder')}
                </Text>
            </View>
        )
    return (
        <View style={styles.container} pointerEvents="box-none">
            <View style={[styles.dot, styles.smallDot]} />
            <View style={[styles.dot, styles.largeDot]} />
            {self ? (
                <RipplePressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                        text || emoji
                            ? 'userProfile.editCustomStatus'
                            : 'userProfile.addCustomStatus',
                    )}
                    // Unlike handlePressAddOrEditStatus, the profile stays open under the alert.
                    onPress={() => openCustomStatusAlert(text, emoji)}
                    style={styles.bubble}
                >
                    {content}
                </RipplePressable>
            ) : (
                <View style={styles.bubble}>{content}</View>
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    container: {
        position: 'absolute',
        top: BANNER_HEIGHT - AVATAR_SIZE / 2 + theme.space.PX_24,
        left: theme.space.PX_16 + AVATAR_SIZE + theme.space.PX_12,
        right: theme.space.PX_16,
        alignItems: 'flex-start',
    },
    bubble: {
        paddingHorizontal: theme.space.PX_12,
        paddingVertical: theme.space.PX_8,
        borderRadius: theme.radii.lg,
        overflow: 'hidden',
        backgroundColor: theme.colors.CUSTOM_STATUS_BUBBLE_BG,
    },
    status: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_6,
    },
    text: { flexShrink: 1 },
    placeholder: { flexShrink: 1, fontFamily: PRIMARY_NORMAL_ITALIC },
    dot: {
        position: 'absolute',
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.CUSTOM_STATUS_BUBBLE_BG,
    },
    smallDot: {
        width: SMALL_DOT,
        height: SMALL_DOT,
        left: -theme.space.PX_12,
        top: -SMALL_DOT,
    },
    largeDot: {
        width: LARGE_DOT,
        height: LARGE_DOT,
        left: -theme.space.PX_4,
        top: -theme.space.PX_4,
    },
}))
