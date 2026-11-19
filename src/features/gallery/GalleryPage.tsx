import { useNavigation } from '@react-navigation/native'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { Text } from '../../design/components/Text'
import { ScopedThemeExample, ScopedThemePicker } from './scopedThemes'
import type { ReactNode } from 'react'

export function GalleryScaffold({
    title,
    fill = false,
    children,
}: {
    title: string
    /** The page fills the screen below the header and scrolls itself (a native list), not in a ScrollView. */
    fill?: boolean
    children: ReactNode
}) {
    const navigation = useNavigation()
    return (
        <View style={styles.container}>
            <NavigatorHeader title={title} onBack={() => navigation.goBack()} />
            <ScopedThemePicker />
            <ScopedThemeExample>
                {fill ? (
                    children
                ) : (
                    <ScrollView contentContainerStyle={styles.content}>
                        {children}
                    </ScrollView>
                )}
            </ScopedThemeExample>
        </View>
    )
}

export function PageSection({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) {
    return (
        <View style={styles.section}>
            <Text variant="text-sm/semibold" color="TEXT_MUTED">
                {title}
            </Text>
            {children}
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
    content: {
        padding: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_32,
        gap: theme.space.PX_24,
    },
    section: { gap: theme.space.PX_8 },
}))
