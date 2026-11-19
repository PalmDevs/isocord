import { useNavigation } from '@react-navigation/native'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ActivityIndicator } from '../../design/components/ActivityIndicator'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { Text } from '../../design/components/Text'
import type { ReactNode } from 'react'

/** A back button and a title over a scrolling form. */
export function ChannelSettingsScaffold({
    title,
    trailing,
    children,
}: {
    title: string
    trailing?: ReactNode
    children: ReactNode
}) {
    const navigation = useNavigation()
    return (
        <View style={styles.container}>
            <NavigatorHeader
                title={title}
                onBack={() => navigation.goBack()}
                trailing={trailing}
            />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                {children}
            </ScrollView>
        </View>
    )
}

/** The header's text button that saves (HeaderTextButton), a spinner while it works (HeaderSubmittingIndicator). */
export function HeaderSubmit({
    label,
    enabled,
    submitting,
    onPress,
}: {
    label: string
    enabled: boolean
    submitting: boolean
    onPress: () => void
}) {
    if (submitting) return <ActivityIndicator size="small" />
    return (
        <RipplePressable
            borderless
            radius={24}
            accessibilityRole="button"
            accessibilityState={{ disabled: !enabled }}
            hitSlop={12}
            disabled={!enabled}
            onPress={onPress}
        >
            <Text
                variant="text-md/medium"
                color={enabled ? 'TEXT_BRAND' : 'TEXT_MUTED'}
            >
                {label}
            </Text>
        </RipplePressable>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
    content: {
        padding: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_32,
        gap: theme.space.PX_24,
    },
}))
