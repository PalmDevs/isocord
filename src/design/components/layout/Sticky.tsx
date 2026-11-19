import { Platform, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import type { ReactNode } from 'react'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'

export interface StickyWrapperProps {
    /** Pinned above the content. */
    header?: ReactNode
    children?: ReactNode
    pointerEvents?: ViewProps['pointerEvents']
    style?: StyleProp<ViewStyle>
}

/** Fills its parent and pins `header` over the content; on Android the header is absolutely positioned (StickyWrapper). */
export function StickyWrapper({
    header,
    children,
    pointerEvents,
    style,
}: StickyWrapperProps) {
    return (
        <View style={[style, styles.wrapper]} pointerEvents={pointerEvents}>
            {header != null && (
                <View
                    style={[
                        styles.header,
                        Platform.OS === 'android' && styles.androidHeader,
                    ]}
                >
                    {header}
                </View>
            )}
            {children}
        </View>
    )
}

const styles = StyleSheet.create({
    wrapper: { height: '100%', width: '100%' },
    header: { zIndex: 1 },
    androidHeader: { position: 'absolute', top: 0, left: 0, right: 0 },
})
