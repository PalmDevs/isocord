import { useEffect } from 'react'
import { AccessibilityInfo, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Icon } from '../icons/Icon'
import { Text } from './Text'
import type { StyleProp, ViewStyle } from 'react-native'

export interface ErrorTextProps {
    children: string
    style?: StyleProp<ViewStyle>
}

/** Critical-coloured error line with a leading icon, announced to screen readers when it appears. */
export function ErrorText({ children, style }: ErrorTextProps) {
    useEffect(() => {
        if (children !== '')
            AccessibilityInfo.announceForAccessibility(children)
    }, [children])

    return (
        <View style={[styles.row, style]}>
            <Icon
                name="CircleErrorIcon"
                size="xs"
                color="TEXT_FEEDBACK_CRITICAL"
            />
            <Text
                variant="text-xs/medium"
                color="TEXT_FEEDBACK_CRITICAL"
                style={styles.text}
            >
                {children}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.space.PX_4,
    },
    text: { flexShrink: 1 },
}))
