import { useNavigation, useRoute } from '@react-navigation/native'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { openLink } from '../../core/openLink'
import { Button } from '../../design/components/buttons/Button'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'

/** Placeholder screen for Discord invite links until invite preview and join UI is implemented. */
export function InviteScreen() {
    const navigation = useNavigation()
    const { code, url } = useRoute().params as { code: string; url: string }
    return (
        <View style={styles.container}>
            <NavigatorHeader
                title={t('servers.header.invite')}
                backIcon="XLargeIcon"
                backLabel={t('common.close')}
                onBack={() => navigation.goBack()}
            />
            <View style={styles.body}>
                <Icon name="LinkIcon" size="lg" color="TEXT_MUTED" />
                <Text variant="heading-lg/semibold" color="TEXT_DEFAULT">
                    {code}
                </Text>
                <Text
                    variant="text-md/normal"
                    color="TEXT_MUTED"
                    style={styles.subtitle}
                >
                    {url}
                </Text>
                <Button
                    text={t('chat.linkOptions.openLink')}
                    icon="LinkExternalSmallIcon"
                    variant="secondary"
                    size="md"
                    onPress={() => void openLink(url)}
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { flex: 1 },
    body: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.space.PX_24,
        gap: theme.space.PX_12,
    },
    subtitle: { textAlign: 'center' },
}))
