import { Image, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Button } from '../../design/components/buttons/Button'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import type { AuthScreenProps } from './navigation'

const backgrounds = {
    dark: require('./images/background-dark.png'),
    light: require('./images/background-light.png'),
}

export function Welcome({ navigation }: AuthScreenProps<'welcome'>) {
    const { theme } = useUnistyles()
    return (
        <View style={styles.container}>
            <Image
                source={theme.isDark ? backgrounds.dark : backgrounds.light}
                resizeMode="cover"
                fadeDuration={0}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.centerpiece}>
                <Image
                    source={require('./images/logo.png')}
                    fadeDuration={0}
                    style={styles.logo}
                />
                <Text
                    accessibilityRole="header"
                    variant="display-md"
                    color="TEXT_OVERLAY_LIGHT"
                    style={styles.header}
                >
                    {t('auth.welcome.title')}
                </Text>
                <Text
                    variant="text-md/medium"
                    color="TEXT_OVERLAY_LIGHT"
                    style={styles.subHeader}
                >
                    {t('auth.welcome.subtitle')}
                </Text>
            </View>
            <View style={styles.buttons}>
                {/* Registration is not implemented yet; the button is shown for parity and disabled. */}
                <Button
                    text={t('auth.register')}
                    size="lg"
                    variant="primary-overlay"
                    grow
                    disabled
                />
                <Button
                    text={t('auth.login')}
                    size="lg"
                    variant="secondary-overlay"
                    grow
                    onPress={() => navigation.navigate('login')}
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: {
        flex: 1,
        padding: theme.space.PX_16,
        paddingTop: runtime.insets.top + 56,
        paddingBottom: runtime.insets.bottom + theme.space.PX_16,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWEST,
    },
    centerpiece: { flexGrow: 1, flexShrink: 1, justifyContent: 'center' },
    logo: {
        width: 93,
        height: 70,
        tintColor: 'white',
        alignSelf: 'center',
        marginBottom: theme.space.PX_24,
    },
    header: {
        textAlign: 'center',
        marginBottom: theme.space.PX_8,
        textTransform: 'uppercase',
    },
    subHeader: {
        fontSize: 18,
        lineHeight: 24,
        textAlign: 'center',
        alignSelf: 'center',
        marginBottom: theme.space.PX_24,
        marginHorizontal: theme.space.PX_16,
    },
    buttons: {
        paddingHorizontal: 28,
        maxWidth: 480,
        alignSelf: 'center',
        width: '100%',
        gap: theme.space.PX_12,
    },
}))
