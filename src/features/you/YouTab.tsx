import { useIsFocused, useNavigation } from '@react-navigation/native'
import { ScrollView, View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSession } from '../../core/react'
import { Button } from '../../design/components/buttons/Button'
import { OverlaySpacer } from '../../design/components/layout/OverlaySpacer'
import { t } from '../../i18n'
import {
    profileBackground,
    profileThemeName,
} from '../userProfile/profileColors'
import { UserProfile } from '../userProfile/UserProfile'
import { useProfileView } from '../userProfile/useProfileView'

/** The current user's main profile, as the profile sheet draws it, with a way into settings. */
export function YouTab() {
    const session = useSession()
    const navigation = useNavigation()
    const isFocused = useIsFocused()
    const { theme } = useUnistyles()
    const themeColors = useProfileView(session.userId, undefined)?.themeColors
    const isDark = themeColors
        ? profileThemeName(themeColors[0]) === 'dark'
        : theme.isDark

    return (
        // The gradient sits on a View, which draws it where a ScrollView does not.
        <View
            style={[
                styles.container,
                themeColors ? profileBackground(themeColors) : undefined,
            ]}
        >
            {/* The status bar follows the profile's theme when open. */}
            {isFocused && (
                <SystemBars style={{ statusBar: isDark ? 'light' : 'dark' }} />
            )}
            <ScrollView>
                <UserProfile
                    userId={session.userId}
                    guildId={undefined}
                    background={theme.colors.BACKGROUND_BASE_LOWER}
                    afterIdentity={
                        // Temporary entry: the reference opens settings from the gear in the You tab's header.
                        <Button
                            text={t('settings.title')}
                            variant="secondary"
                            grow
                            onPress={() => navigation.navigate('settings')}
                        />
                    }
                />
                {/* The voice dock floats over the profile's bottom. */}
                <OverlaySpacer />
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: {
        flex: 1,
        paddingTop: runtime.insets.top,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
    },
}))
