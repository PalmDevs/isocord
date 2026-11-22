import Animated, {
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { ON_PRESS_SPRING, SPRING_STANDARD } from '../../design/tokens/motion'
import { t } from '../../i18n'
import type { ComponentProps } from 'react'

/**
 * ChannelsUnreadBar: the "NEW" pill floating at the top or bottom edge of a list, pointing at an
 * unread channel or conversation out of view. A tap scrolls to it; the pill scales under the press.
 */

/** Which side of the list the pill hangs from. */
export interface UnreadBarProps {
    position: 'top' | 'bottom'
    /** The target has mentions waiting: red pill, @ icon. */
    mention?: boolean
    shown: boolean
    onPress: () => void
    /** Anchors the bar to its edge of the list; the pill slides off it. */
    style?: ComponentProps<typeof Animated.View>['style']
}

/** ChannelsUnreadBar unreadBar: minHeight 24. */
const PILL_MIN_HEIGHT = 24
/** The press scale, (width + 5) / width in the reference; a fixed stand-in at pill widths. */
const PRESS_SCALE = 1.1

export function UnreadBar({
    position,
    mention = false,
    shown,
    onPress,
    style,
}: UnreadBarProps) {
    const { theme } = useUnistyles()
    const pressed = useSharedValue(0)
    // ChannelsUnreadBar: STATUS_DANGER under a mention, BACKGROUND_SURFACE_HIGHEST under a plain unread.
    const pillColor = mention
        ? theme.colors.STATUS_DANGER
        : theme.colors.BACKGROUND_SURFACE_HIGHEST
    // The pill's own height hides it off-edge; a measured one would need an onLayout state round trip.
    const offsetBase = PILL_MIN_HEIGHT * (position === 'bottom' ? 1 : -1)

    const visible = useDerivedValue(() => {
        const value = shown ? 0 : offsetBase
        return withSpring(value, SPRING_STANDARD)
    })
    const opacity = useDerivedValue(() =>
        withSpring(shown ? 1 : 0, SPRING_STANDARD),
    )
    const scale = useDerivedValue(() =>
        withSpring(1 + pressed.get() * (PRESS_SCALE - 1), ON_PRESS_SPRING),
    )
    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.get(),
        transform: [{ translateY: visible.get() }, { scale: scale.get() }],
    }))

    const iconName = mention
        ? 'AtIcon'
        : position === 'bottom'
          ? 'ArrowSmallDownIcon'
          : 'ArrowSmallUpIcon'
    const textColor = mention ? 'WHITE' : 'MOBILE_UNREADBAR_TEXT_DEFAULT'

    return (
        <Animated.View
            pointerEvents={shown ? 'box-none' : 'none'}
            style={[styles.edge, style]}
        >
            <Animated.View
                style={[
                    styles.pill(mention),
                    { backgroundColor: pillColor },
                    animatedStyle,
                ]}
            >
                {/* The ripple fills the pill, so it is clipped by the pill's own radius. */}
                <RipplePressable
                    accessibilityRole="button"
                    onPress={onPress}
                    onPressIn={() => pressed.set(1)}
                    onPressOut={() => pressed.set(0)}
                    style={StyleSheet.absoluteFill}
                />
                <Icon name={iconName} size="xxs" color={textColor} />
                <Text
                    variant="text-xs/bold"
                    color={textColor}
                    style={styles.text}
                >
                    {t('unreadBar.new')}
                </Text>
            </Animated.View>
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    edge: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        // The pill slides off this edge; the parent must not clip it before the slide ends.
        overflow: 'visible',
    },
    // ChannelsUnreadBar unreadBar: round, 24 tall, 1 border, small shadow, 9/6 or 9/5 side padding.
    pill: (mention: boolean) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: PILL_MIN_HEIGHT,
        paddingLeft: mention ? theme.space.PX_6 : 5,
        paddingRight: 9,
        paddingVertical: theme.space.PX_4,
        marginVertical: theme.space.PX_16,
        borderRadius: theme.radii.round,
        borderWidth: 1,
        borderColor: theme.colors.BORDER_SUBTLE,
        shadowColor: theme.colors.BLACK,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 4,
    }),
    // ChannelsUnreadBar text: uppercase, nudged up on Android for optical centering.
    text: {
        textTransform: 'uppercase',
        marginTop: -1,
        marginLeft: 2,
    },
}))
