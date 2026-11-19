import { useEffect, useState } from 'react'
import { AccessibilityInfo, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
    cancelAnimation,
    Easing,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { useSession, useSessionStore } from '../../core/react'
import { Avatar } from '../../design/components/avatars/Avatar'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import {
    IN_APP_NOTIFICATION_EXIT_FADE_TIMING,
    IN_APP_NOTIFICATION_EXIT_TIMING,
    IN_APP_NOTIFICATION_RETURN_SPRING,
    IN_APP_NOTIFICATION_TIMING,
    ON_PRESS_SPRING,
} from '../../design/tokens/motion'
import MessagePreviewView from '../../native/MessagePreviewViewNativeComponent'
import { openChannel } from '../chat/links/openChannel'
import { useChatTheme } from '../chat/rows/rowEncoder'
import { dismissInAppNotification, inAppNotificationsStore } from './store'
import type { SharedValue } from 'react-native-reanimated'
import type { InAppNotification } from './store'

// InAppNotificationConstants and InAppNotificationUtils.
/** getNotificationDuration(MESSAGE). */
const DURATION = 5000
const NOTIFICATION_MAX_WIDTH = 480
/** IN_APP_NOTIFICATION_MAX_HEIGHT: the preview is cut past this. */
const PREVIEW_MAX_HEIGHT = 96
const PREVIEW_LINE_CLAMP = 2
const PAN_INPUT_RANGE = [-100, 0, 100]
const MIN_SWIPE_DISTANCE = 25
const MIN_SWIPE_VELOCITY = 100
/** AvatarSizes.NORMAL. */
const AVATAR_SIZE = 40
const PRESSED_SCALE = 0.95

/**
 * Ours: the reference unmounts the card without animating it, though it defines a 200 ms ease-in timing beside its
 * container. The card leaves the way it came in, shrinking and fading, whatever takes it away (time, tap, the
 * channel being read, the next notification).
 */
const EXITING = () => {
    'worklet'
    return {
        initialValues: { opacity: 1, transform: [{ scale: 1 }] },
        animations: {
            opacity: withTiming(0, IN_APP_NOTIFICATION_EXIT_FADE_TIMING),
            transform: [
                { scale: withTiming(0, IN_APP_NOTIFICATION_EXIT_TIMING) },
            ],
        },
    }
}

/** The reference's Notifications: the one in-app notification on screen, above everything but toasts. */
export function InAppNotificationHost() {
    const current = useSessionStore(
        inAppNotificationsStore,
        state => state.current,
    )
    if (!current) return null
    return <NotificationCard key={current.key} notification={current} />
}

/**
 * InAppNotificationContainer, NotificationPressable and MessageNotification: a card under the status bar that grows
 * in, counts down its time with a bar along its bottom (paused while touched), goes away when swiped up, and opens
 * the message when tapped. The preview is the chat's native message body; the reference draws plain text messages
 * with a text preview (ChannelRowPreview) and only embeds and forwards with its native renderer.
 */
function NotificationCard({
    notification,
}: {
    notification: InAppNotification
}) {
    const session = useSession()
    const insets = useSafeAreaInsets()
    const reducedMotion = useReducedMotion()
    const [previewHeight, setPreviewHeight] = useState<number>()
    const [initialized, setInitialized] = useState(false)
    const [panning, setPanning] = useState(false)
    const enter = useSharedValue(0)
    const gestureY = useSharedValue(0)
    const startY = useSharedValue(0)
    const velocityY = useSharedValue(0)
    const percent = useSharedValue(100)
    const pressScale = useSharedValue(1)
    const ready = previewHeight !== undefined
    const { key } = notification

    const dismiss = () => dismissInAppNotification(session, key)
    const open = () => {
        dismiss()
        // MessageNotification: transitionToMessage.
        openChannel(notification.channelId, notification.messageId)
    }

    // Grows in once the preview has its height, so the card does not change size after it appears.
    useEffect(() => {
        if (!ready) return
        AccessibilityInfo.announceForAccessibility(notification.announcement)
        enter.set(
            withTiming(1, IN_APP_NOTIFICATION_TIMING, finished => {
                if (finished) scheduleOnRN(setInitialized, true)
            }),
        )
        return () => cancelAnimation(enter)
    }, [ready, enter, notification.announcement])

    // The time left runs down while the card is not held; holding it keeps what is left.
    // biome-ignore lint/correctness/useExhaustiveDependencies: dismiss changes every render; key does not
    useEffect(() => {
        if (!initialized || panning) return
        percent.set(
            withTiming(
                0,
                {
                    duration: (percent.get() / 100) * DURATION,
                    easing: Easing.linear,
                },
                finished => {
                    if (finished) scheduleOnRN(dismiss)
                },
            ),
        )
        return () => cancelAnimation(percent)
    }, [initialized, panning, percent])

    // Only upward: a drag down stays put. A flick or a drag of MIN_SWIPE_DISTANCE dismisses.
    const pan = usePanGesture({
        onBegin: () => {
            'worklet'
            startY.set(gestureY.get())
            velocityY.set(0)
            scheduleOnRN(setPanning, true)
        },
        onUpdate: event => {
            'worklet'
            gestureY.set(
                Math.min(startY.get() + event.translationY, startY.get()),
            )
            velocityY.set(event.velocityY)
        },
        onDeactivate: event => {
            'worklet'
            const shouldDismiss =
                Math.abs(velocityY.get()) >= MIN_SWIPE_VELOCITY ||
                Math.abs(event.translationY) >= MIN_SWIPE_DISTANCE
            if (shouldDismiss && event.translationY <= 0) {
                gestureY.set(
                    withTiming(
                        PAN_INPUT_RANGE[0] ?? 0,
                        IN_APP_NOTIFICATION_TIMING,
                        finished => {
                            if (finished) scheduleOnRN(dismiss)
                        },
                    ),
                )
                return
            }
            scheduleOnRN(setPanning, false)
            gestureY.set(
                withSpring(0, {
                    ...IN_APP_NOTIFICATION_RETURN_SPRING,
                    velocity: velocityY.get(),
                }),
            )
        },
        onFinalize: () => {
            'worklet'
            scheduleOnRN(setPanning, false)
        },
    })

    const containerStyle = useAnimatedStyle(() => {
        const y = gestureY.get()
        const scale = initialized
            ? interpolate(y, PAN_INPUT_RANGE, [0.3, 1, 0.3], 'clamp')
            : enter.get()
        const opacity = initialized
            ? interpolate(y, PAN_INPUT_RANGE, [0, 1, 0], 'clamp')
            : enter.get()
        return { opacity, transform: [{ translateY: y }, { scale }] }
    })
    const pressStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(pressScale.get(), ON_PRESS_SPRING) }],
    }))

    // Transparent over the card, as search results are over their page.
    const previewTheme = useChatTheme('transparent')

    // The outer layer leaves with EXITING, the inner one follows the entry and the gesture: a card swiped away is
    // already invisible inside, so its exit shows nothing.
    return (
        <Animated.View
            exiting={reducedMotion ? undefined : EXITING}
            pointerEvents="box-none"
            style={[styles.container, { top: insets.top + 8 }]}
        >
            <GestureDetector gesture={pan}>
                <Animated.View pointerEvents="box-none" style={containerStyle}>
                    <Animated.View style={[styles.shadow, pressStyle]}>
                        <RipplePressable
                            accessibilityRole="button"
                            onAccessibilityEscape={dismiss}
                            onPress={open}
                            onPressIn={() => pressScale.set(PRESSED_SCALE)}
                            onPressOut={() => pressScale.set(1)}
                            style={styles.card}
                        >
                            <View style={styles.content}>
                                <View style={styles.icon}>
                                    <Avatar
                                        user={notification.author}
                                        size={AVATAR_SIZE}
                                    />
                                </View>
                                <View style={styles.body}>
                                    <Header notification={notification} />
                                    <MessagePreviewView
                                        message={notification.row}
                                        theme={previewTheme}
                                        lineClamp={PREVIEW_LINE_CLAMP}
                                        maxHeight={PREVIEW_MAX_HEIGHT}
                                        onContentHeight={event =>
                                            setPreviewHeight(
                                                event.nativeEvent.height,
                                            )
                                        }
                                        style={{ height: previewHeight ?? 0 }}
                                    />
                                </View>
                            </View>
                            <Progress percent={percent} />
                        </RipplePressable>
                    </Animated.View>
                </Animated.View>
            </GestureDetector>
        </Animated.View>
    )
}

/** MessageNotificationHeader: the author's name, then "· <icon> channel, server" in muted text. */
function Header({ notification }: { notification: InAppNotification }) {
    const { authorName, authorColor, location, locationIcon } = notification
    return (
        <View style={styles.header}>
            <Text
                variant="text-md/semibold"
                color="MOBILE_TEXT_HEADING_PRIMARY"
                lineClamp={1}
                style={[
                    styles.name,
                    authorColor ? { color: authorColor } : undefined,
                ]}
            >
                {authorName}
            </Text>
            {location !== undefined && (
                <View style={styles.location}>
                    <Text
                        variant="text-md/bold"
                        color="TEXT_MUTED"
                        maxFontSizeMultiplier={1.75}
                        style={styles.separator}
                    >
                        {'·'}
                    </Text>
                    {locationIcon && (
                        <Icon
                            name={locationIcon}
                            size="xs"
                            color="TEXT_MUTED"
                        />
                    )}
                    <Text
                        variant="text-md/semibold"
                        color="TEXT_MUTED"
                        lineClamp={1}
                        style={styles.locationText}
                    >
                        {location}
                    </Text>
                </View>
            )}
        </View>
    )
}

/** NotificationProgress: a brand coloured bar along the bottom that shrinks to the left as the time runs out. */
function Progress({ percent }: { percent: SharedValue<number> }) {
    const [width, setWidth] = useState(0)
    const style = useAnimatedStyle(() => ({
        transform: [{ translateX: width * (percent.get() / 100) - width }],
    }))
    return (
        <View
            pointerEvents="none"
            onLayout={event => setWidth(event.nativeEvent.layout.width)}
            style={styles.progressContainer}
        >
            <Animated.View style={[styles.progress, style]} />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    container: {
        position: 'absolute',
        left: theme.space.PX_16,
        right: theme.space.PX_16,
    },
    shadow: {
        boxShadow: theme.shadows.SHADOW_HIGH,
        backgroundColor: theme.colors.MOBILE_ALERT_BACKGROUND_DEFAULT,
        borderRadius: theme.radii.lg,
        maxWidth: NOTIFICATION_MAX_WIDTH,
        width: '100%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: theme.colors.BORDER_SUBTLE,
    },
    card: { borderRadius: theme.radii.lg },
    content: { padding: theme.space.PX_12, flexDirection: 'row' },
    icon: { marginRight: theme.space.PX_8 },
    body: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center' },
    name: { flexShrink: 1, marginRight: 2 },
    location: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flex: 1,
        overflow: 'hidden',
    },
    separator: { marginHorizontal: 2 },
    locationText: { flex: 1 },
    progressContainer: { width: '100%', position: 'absolute', bottom: -1 },
    progress: {
        borderRadius: theme.radii.xs,
        backgroundColor: theme.colors.BACKGROUND_BRAND,
        height: 4,
    },
}))
