import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { RelationshipType } from '../../../core/discord/relationships'
import { useSession } from '../../../core/react'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import {
    unignoreUser,
    useIsIgnored,
    useRelationshipType,
} from '../../../stores/relationships'

/** Separates "You ignored them" from Unignore. */
const BULLET = '•'

/** UserProfileRemediatedNotice: "You blocked them", or "You ignored them • Unignore", in a card. */
export function RemediatedNotice({ userId }: { userId: string }) {
    const session = useSession()
    const blocked = useRelationshipType(userId) === RelationshipType.BLOCKED
    const ignored = useIsIgnored(userId)
    if (!blocked && !ignored) return null
    return (
        <View style={styles.card}>
            {blocked && (
                <Text
                    variant="text-sm/semibold"
                    color="TEXT_DEFAULT"
                    lineClamp={1}
                >
                    {t('safety.notice.blocked')}
                </Text>
            )}
            {ignored && (
                <>
                    <Text
                        variant="text-sm/semibold"
                        color="TEXT_DEFAULT"
                        lineClamp={1}
                    >
                        {t('safety.notice.ignored')}
                    </Text>
                    <Text
                        variant="text-sm/semibold"
                        color="TEXT_DEFAULT"
                        importantForAccessibility="no"
                    >
                        {BULLET}
                    </Text>
                    <RipplePressable
                        accessibilityRole="button"
                        style={styles.unignore}
                        onPress={() =>
                            void unignoreUser(session, userId).catch(() => {})
                        }
                    >
                        <Text variant="heading-sm/medium" color="TEXT_LINK">
                            {t('userProfile.unignore')}
                        </Text>
                    </RipplePressable>
                </>
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // UserProfileSharedStyles.card with the notice's container.
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        padding: theme.space.PX_12,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.BORDER_MUTED,
    },
    unignore: { borderRadius: theme.radii.xs },
}))
