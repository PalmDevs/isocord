import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../../design/components/Text'
import { TableRow, TableRowIcon } from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { openMaskedLink } from '../chat/links/maskedLink'
import {
    connectionIcon,
    connectionImage,
    connectionUrl,
} from './connectionLinks'
import { ProfileSection } from './ProfileSection'
import type { ConnectedAccount } from '../../stores/userProfiles'

/** UserProfileConnections: the name wraps to two lines at most. */
const NAME_LINES = 2

/**
 * UserProfileConnections: platform icon, the name with a verified check, and an external link arrow. A tap opens
 * the profile page through `openMaskedLink`, which asks first for an untrusted host. The verified mark is the
 * circled check, not the reference's badge shape.
 */
export function ProfileConnections({
    accounts,
}: {
    accounts: ConnectedAccount[]
}) {
    if (accounts.length === 0) return null
    return (
        <ProfileSection title={t('userProfile.connections')}>
            <TableRowGroup hasIcons>
                {accounts.map(account => {
                    const url = connectionUrl(account)
                    const image = connectionImage(account)
                    return (
                        <TableRow
                            key={`${account.type}:${account.id}`}
                            label={<ConnectionName account={account} />}
                            icon={
                                image ? (
                                    <TableRowIcon source={image} />
                                ) : (
                                    <TableRowIcon
                                        name={connectionIcon(account)}
                                    />
                                )
                            }
                            trailing={
                                url ? (
                                    <Icon
                                        name="LinkExternalSmallIcon"
                                        size="sm"
                                        color="ICON_MUTED"
                                    />
                                ) : undefined
                            }
                            onPress={
                                url ? () => openMaskedLink(url) : undefined
                            }
                        />
                    )
                })}
            </TableRowGroup>
        </ProfileSection>
    )
}

function ConnectionName({ account }: { account: ConnectedAccount }) {
    return (
        <View style={styles.name}>
            <Text
                variant="text-md/semibold"
                color="MOBILE_TEXT_HEADING_PRIMARY"
                lineClamp={NAME_LINES}
                style={styles.nameText}
            >
                {account.name}
            </Text>
            {account.verified && (
                <Icon
                    name="CircleCheckIcon"
                    size="xs"
                    color="BACKGROUND_BASE_LOWEST"
                    secondaryColor="MOBILE_TEXT_HEADING_PRIMARY"
                    accessibilityLabel={t('userProfile.verified')}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    name: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: theme.space.PX_4,
    },
    nameText: { flexShrink: 1 },
}))
