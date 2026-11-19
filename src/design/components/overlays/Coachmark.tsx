import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { t } from '../../../i18n'
import { Icon } from '../../icons/Icon'
import { Bubble } from '../Bubble'
import { Button } from '../buttons/Button'
import { Text } from '../Text'
import { useAnchor } from './popoverHooks'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { BubblePosition } from '../Bubble'

export interface CoachmarkProps {
    title?: string
    description: string
    /** Shown while true. Tapping outside, the close button or back calls `onDismiss`. */
    visible: boolean
    onDismiss: () => void
    position?: BubblePosition
    /** Adds a button under the description. */
    buttonText?: string
    onButtonPress?: () => void
    /** The element the coachmark points at. */
    children: ReactNode
    /** Style of the wrapper around the target. */
    style?: StyleProp<ViewStyle>
}

/** Introduces a feature: a titled card with an arrow pointing at its target. Controlled by `visible`. */
export function Coachmark({
    title,
    description,
    visible,
    onDismiss,
    position = 'bottom',
    buttonText,
    onButtonPress,
    children,
    style,
}: CoachmarkProps) {
    const { ref, anchor, open, clear } = useAnchor()

    useEffect(() => {
        if (visible) open()
    }, [visible, open])

    return (
        <>
            <View ref={ref} collapsable={false} style={style}>
                {children}
            </View>
            {anchor && (
                <Bubble
                    anchor={anchor}
                    position={position}
                    arrowColor="MOBILE_COACHMARK_BACKGROUND_DEFAULT"
                    visible={visible}
                    onDismiss={onDismiss}
                    onExited={clear}
                >
                    <View style={styles.body}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('common.close')}
                            hitSlop={8}
                            onPress={onDismiss}
                            style={styles.close}
                        >
                            <Icon
                                name="XSmallIcon"
                                size="xs"
                                color="INTERACTIVE_ICON_DEFAULT"
                            />
                        </Pressable>
                        {title != null && (
                            <Text
                                accessibilityRole="header"
                                variant="text-md/semibold"
                                color="MOBILE_TEXT_HEADING_PRIMARY"
                                style={styles.text}
                            >
                                {title}
                            </Text>
                        )}
                        <Text
                            variant="text-sm/medium"
                            color="TEXT_SUBTLE"
                            style={styles.text}
                        >
                            {description}
                        </Text>
                        {buttonText != null && (
                            <View style={styles.button}>
                                <Button
                                    text={buttonText}
                                    size="sm"
                                    variant="secondary-overlay"
                                    onPress={onButtonPress ?? onDismiss}
                                />
                            </View>
                        )}
                    </View>
                </Bubble>
            )}
        </>
    )
}

const styles = StyleSheet.create(theme => ({
    body: {
        width: theme.modules.mobile.COACHMARK_BODY_WIDTH,
        alignItems: 'center',
        gap: theme.space.PX_8,
        padding: theme.space.PX_16,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.MOBILE_COACHMARK_BORDER_DEFAULT,
        backgroundColor: theme.colors.MOBILE_COACHMARK_BACKGROUND_DEFAULT,
        boxShadow: theme.shadows.SHADOW_BUTTON_OVERLAY,
    },
    close: {
        position: 'absolute',
        top: theme.space.PX_8,
        right: theme.space.PX_8,
        zIndex: 1,
    },
    text: { textAlign: 'center' },
    button: {
        marginTop:
            theme.modules.mobile.COACHMARK_BUTTON_SPACING - theme.space.PX_8,
    },
}))
