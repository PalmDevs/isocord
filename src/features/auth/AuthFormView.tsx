import { useNavigation } from '@react-navigation/native'
import { Pressable, ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import type { ReactNode } from 'react'

const NAV_BAR_HEIGHT = 56

interface AuthFormViewProps {
    headerText: string
    subHeader?: string
    children: ReactNode
}

/** Shared frame for the auth forms: back button, centered heading, scrolling content. */
export function AuthFormView({
    headerText,
    subHeader,
    children,
}: AuthFormViewProps) {
    const navigation = useNavigation()
    return (
        <View style={styles.container}>
            <View style={styles.navbar}>
                {navigation.canGoBack() && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.back')}
                        hitSlop={12}
                        onPress={navigation.goBack}
                        style={styles.back}
                    >
                        <Icon name="ArrowLargeLeftIcon" />
                    </Pressable>
                )}
            </View>
            <ScrollView
                keyboardShouldPersistTaps="handled"
                alwaysBounceVertical={false}
                contentContainerStyle={styles.content}
            >
                <Text accessibilityRole="header" style={styles.header}>
                    {headerText}
                </Text>
                {subHeader !== undefined && (
                    <View style={styles.subHeader}>
                        <Text variant="text-sm/medium">{subHeader}</Text>
                    </View>
                )}
                {children}
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOW },
    navbar: {
        height: runtime.insets.top + NAV_BAR_HEIGHT,
        paddingTop: runtime.insets.top,
        justifyContent: 'center',
    },
    back: { marginLeft: theme.space.PX_16, alignSelf: 'flex-start' },
    content: {
        flexGrow: 1,
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom,
    },
    header: {
        fontFamily: 'ggsans-ExtraBold',
        fontSize: 24,
        // The base Text's line height is for its 16px default and clips a 24px heading.
        lineHeight: 30,
        textAlign: 'center',
        color: theme.colors.MOBILE_TEXT_HEADING_PRIMARY,
    },
    subHeader: { marginTop: theme.space.PX_8, alignItems: 'center' },
}))
