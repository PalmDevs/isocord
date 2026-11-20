import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { ActionSheet } from '../../../design/components/sheets/Sheet'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { setIgnoreProfileSpeedbumpDisabled } from '../../../stores/settings/settingsActions'
import { usersStore } from '../../../stores/users'
import { InfoTable, MarkupText, RestrictedAvatar } from './SafetyParts'
import type { InfoRow, Restriction } from './SafetyParts'

const NOT_NOTIFIED: InfoRow = {
    icon: 'CircleCheckIcon',
    label: 'safety.speedBump.notNotified',
}

/** InformationTable: they won't know, and stay blocked or ignored. */
const ROWS: Record<Restriction, InfoRow[]> = {
    block: [
        NOT_NOTIFIED,
        { icon: 'CircleCheckIcon', label: 'safety.speedBump.stillBlocked' },
    ],
    ignore: [
        NOT_NOTIFIED,
        { icon: 'CircleCheckIcon', label: 'safety.speedBump.stillIgnored' },
    ],
}

/**
 * UserProfileSpeedBumpActionSheet: "Show Profile?" before the profile of a user you blocked or ignored. `onShow`
 * opens the profile in its place.
 */
export function SpeedBumpSheet({
    userId,
    name,
    restriction,
    onShow,
}: {
    userId: string
    name: string
    restriction: Restriction
    onShow: () => void
}) {
    const session = useSession()
    const user = useSessionStore(usersStore, state => state.users[userId])
    if (!user) return null
    return (
        <ActionSheet>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <RestrictedAvatar user={user} restriction={restriction} />
                </View>
                <Text
                    variant="heading-xl/bold"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                    accessibilityRole="header"
                    style={styles.centered}
                >
                    {t('safety.speedBump.title')}
                </Text>
                <MarkupText
                    textKey={
                        restriction === 'block'
                            ? 'safety.speedBump.blockedBody'
                            : 'safety.speedBump.ignoredBody'
                    }
                    values={{ username: name }}
                    variant="text-md/medium"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                    style={styles.centered}
                />
            </View>
            <View style={styles.table}>
                <InfoTable rows={ROWS[restriction]} />
            </View>
            <View style={styles.footer}>
                <Button
                    size="lg"
                    variant="secondary"
                    text={t('safety.speedBump.show')}
                    grow
                    onPress={onShow}
                />
                {/* Only ignoring can be told to skip this. */}
                {restriction === 'ignore' && (
                    <RipplePressable
                        accessibilityRole="button"
                        style={styles.suppress}
                        onPress={() => {
                            setIgnoreProfileSpeedbumpDisabled(session, true)
                            onShow()
                        }}
                    >
                        <Text variant="text-sm/normal" color="TEXT_LINK">
                            {t('safety.speedBump.dontShowAgain')}
                        </Text>
                    </RipplePressable>
                )}
            </View>
        </ActionSheet>
    )
}

const styles = StyleSheet.create(theme => ({
    header: { gap: theme.space.PX_8, marginBottom: theme.space.PX_24 },
    avatar: { marginTop: theme.space.PX_16 },
    centered: { textAlign: 'center' },
    table: { marginBottom: theme.space.PX_24 },
    footer: { paddingBottom: theme.space.PX_48 },
    suppress: {
        alignSelf: 'center',
        marginTop: theme.space.PX_16,
        borderRadius: theme.radii.sm,
    },
}))
