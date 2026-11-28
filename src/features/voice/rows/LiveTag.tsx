import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'

/** LiveTag: the pill that marks a user who is streaming. */
export function LiveTag() {
    return (
        <View style={styles.tag}>
            <Text variant="text-xs/bold" color="WHITE" lineClamp={1}>
                {t('voice.live').toUpperCase()}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    tag: {
        paddingHorizontal: theme.space.PX_6,
        paddingVertical: 2,
        borderRadius: theme.radii.round,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.BACKGROUND_FEEDBACK_NOTIFICATION,
    },
}))
