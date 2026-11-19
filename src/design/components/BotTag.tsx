import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { t } from '../../i18n'
import { Text } from './Text'

/** applications/native/BotTag: the "APP" chip after a bot's name. */
export function BotTag() {
    return (
        <View style={styles.tag}>
            <Text variant="text-xs/semibold" color="WHITE">
                {t('members.appTag')}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    tag: {
        borderRadius: theme.radii.xs,
        backgroundColor: theme.colors.BACKGROUND_BRAND,
        paddingHorizontal: theme.space.PX_4,
        paddingVertical: 1,
    },
}))
