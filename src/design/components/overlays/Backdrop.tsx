import { StyleSheet as NativeStyleSheet, Pressable } from 'react-native'
import Animated, { withSpring } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { t } from '../../../i18n'
import { MODAL_SPRING } from '../../tokens/motion'

const ENTERING = () => {
    'worklet'
    return {
        initialValues: { opacity: 0 },
        animations: { opacity: withSpring(1, MODAL_SPRING) },
    }
}
const EXITING = () => {
    'worklet'
    return {
        initialValues: { opacity: 1 },
        animations: { opacity: withSpring(0, MODAL_SPRING) },
    }
}

export interface BackdropProps {
    /** Uses the near-opaque scrim instead of the translucent one. */
    opaque?: boolean
    /** Makes the backdrop tappable. */
    onDismiss?: () => void
    accessibilityLabel?: string
    /** Fades in on mount and out on unmount. */
    animated?: boolean
}

/**
 * Full-screen scrim behind overlays. The reference also offers a blurred variant; on Android that
 * falls back to the same scrim colour, so it is not ported.
 */
export function Backdrop({
    opaque = false,
    onDismiss,
    accessibilityLabel = t('common.close'),
    animated,
}: BackdropProps) {
    return (
        <Animated.View
            pointerEvents="box-none"
            entering={animated ? ENTERING : undefined}
            exiting={animated ? EXITING : undefined}
            style={styles.fill}
        >
            <Pressable
                accessibilityRole={onDismiss ? 'button' : undefined}
                accessibilityLabel={onDismiss ? accessibilityLabel : undefined}
                disabled={!onDismiss}
                onPress={onDismiss}
                style={[styles.fill, opaque ? styles.opaque : styles.scrim]}
            />
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    fill: NativeStyleSheet.absoluteFill,
    scrim: { backgroundColor: theme.colors.BACKGROUND_SCRIM },
    opaque: { backgroundColor: theme.colors.MOBILE_BACKGROUND_SCRIM_OPAQUE },
}))
