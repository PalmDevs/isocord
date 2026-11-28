import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'

/** BlockedMemberWarning's headline: who is here, by blocked and ignored counts. */
function headline(blocked: number, ignored: number): string {
    if (blocked > 0 && ignored > 0) return t('voice.preJoin.blockedAndIgnored')
    if (ignored > 0)
        return t(
            ignored === 1
                ? 'voice.preJoin.ignoredHere.one'
                : 'voice.preJoin.ignoredHere.other',
        )
    return t(
        blocked === 1
            ? 'voice.preJoin.blockedHere.one'
            : 'voice.preJoin.blockedHere.other',
    )
}

/** VoicePanelPreJoinContent BlockedMemberWarning: says blocked or ignored people are in the channel. */
export function PreJoinBlockedWarning({
    blocked,
    ignored,
}: {
    blocked: number
    ignored: number
}) {
    return (
        <View style={styles.warning}>
            <Icon name="CircleErrorIcon" color="TEXT_FEEDBACK_WARNING" />
            <Text
                variant="text-sm/bold"
                color="INTERACTIVE_TEXT_ACTIVE"
                style={styles.text}
            >
                {headline(blocked, ignored)}{' '}
                <Text variant="heading-sm/semibold">
                    {t('voice.preJoin.hearEachOther')}
                </Text>
            </Text>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // blockedMemberWarning.
    warning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        padding: theme.space.PX_8,
        borderRadius: theme.radii.xs,
        borderColor: theme.colors.ICON_FEEDBACK_WARNING,
        borderWidth: 1,
        backgroundColor: theme.colors.BACKGROUND_FEEDBACK_WARNING,
        marginHorizontal: theme.space.PX_16,
    },
    text: { flexShrink: 1 },
}))
