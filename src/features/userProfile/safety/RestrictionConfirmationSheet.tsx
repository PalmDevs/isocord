import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import { showToast } from '../../../design/components/overlays/toastStore'
import { ActionSheet } from '../../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { Text } from '../../../design/components/Text'
import {
    TableRow,
    TableRowIcon,
} from '../../../design/components/table/TableRow'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { t } from '../../../i18n'
import {
    blockUser,
    ignoreUser,
    useIsIgnored,
} from '../../../stores/relationships'
import { usersStore } from '../../../stores/users'
import {
    FeatureGuideText,
    InfoTable,
    RESTRICTION_ICONS,
    RestrictedAvatar,
} from './SafetyParts'
import type { MessageKey } from '../../../i18n'
import type { InfoRow, Restriction } from './SafetyParts'

/** RestrictionConfirmationConstants. */
const SHEET_KEYS: Record<Restriction, string> = {
    block: 'BlockConfirmationActionSheet',
    ignore: 'IgnoreConfirmationActionSheet',
}

/** What each sheet says, after BlockConfirmationActionSheet and IgnoreConfirmationActionSheet. */
const COPY: Record<
    Restriction,
    { title: MessageKey; subtitle: MessageKey; rows: InfoRow[] }
> = {
    block: {
        title: 'safety.block.title',
        subtitle: 'safety.block.subtitle',
        rows: [
            {
                icon: 'CircleCheckIcon',
                label: 'safety.block.stopMessages',
                detail: 'safety.block.stopMessagesDetail',
            },
            {
                icon: 'CircleCheckIcon',
                label: 'safety.block.limitProfile',
                detail: 'safety.block.limitProfileDetail',
            },
            {
                icon: 'CircleInformationIcon',
                label: 'safety.block.canInteract',
                detail: 'safety.block.canInteractDetail',
            },
        ],
    },
    ignore: {
        title: 'safety.ignore.title',
        subtitle: 'safety.ignore.subtitle',
        rows: [
            {
                icon: 'CircleCheckIcon',
                label: 'safety.ignore.hide',
                detail: 'safety.ignore.hideDetail',
            },
            {
                icon: 'CircleCheckIcon',
                label: 'safety.ignore.mute',
                detail: 'safety.ignore.muteDetail',
            },
            {
                icon: 'CircleInformationIcon',
                label: 'safety.ignore.canMessage',
                detail: 'safety.ignore.canMessageDetail',
            },
        ],
    },
}

/**
 * Opens the block or ignore confirmation. From the profile's menu it stacks over the profile. The "instead" row
 * replaces it with the other one.
 */
export function openRestrictionConfirmation(
    restriction: Restriction,
    userId: string,
    name: string,
    stackingBehavior: 'stack' | 'replaceTopSheet' = 'stack',
): void {
    openActionSheet(
        SHEET_KEYS[restriction],
        <RestrictionConfirmationSheet
            restriction={restriction}
            userId={userId}
            name={name}
        />,
        { stackingBehavior },
    )
}

/** BlockConfirmationActionSheet and IgnoreConfirmationActionSheet. */
function RestrictionConfirmationSheet({
    restriction,
    userId,
    name,
}: {
    restriction: Restriction
    userId: string
    name: string
}) {
    const session = useSession()
    const closeSheet = useCloseSheet()
    const user = useSessionStore(usersStore, state => state.users[userId])
    const ignored = useIsIgnored(userId)
    const [pending, setPending] = useState(false)
    if (!user) return null
    const copy = COPY[restriction]
    const block = restriction === 'block'
    const confirm = () => {
        setPending(true)
        ;(block ? blockUser : ignoreUser)(session, userId)
            .then(() => {
                if (block)
                    showToast({
                        content: t('userProfile.blocked', { username: name }),
                        variant: 'success',
                    })
                closeSheet()
            })
            .catch(() => {
                setPending(false)
                showToast({ content: t('error.generic'), variant: 'critical' })
            })
    }
    return (
        <ActionSheet>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.avatar}>
                        <RestrictedAvatar
                            user={user}
                            restriction={restriction}
                        />
                    </View>
                    <Text
                        variant="heading-xl/bold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        accessibilityRole="header"
                        style={styles.centered}
                    >
                        {t(copy.title, { username: name })}
                    </Text>
                    <Text
                        variant="heading-md/medium"
                        color="TEXT_DEFAULT"
                        style={styles.centered}
                    >
                        {t(copy.subtitle)}
                    </Text>
                </View>
                <View style={styles.table}>
                    <InfoTable rows={copy.rows} />
                </View>
                {/* Block offers ignoring only to a user not ignored yet. */}
                {(!block || !ignored) && (
                    <InsteadRow
                        restriction={restriction}
                        userId={userId}
                        name={name}
                    />
                )}
                <Button
                    size="lg"
                    variant={block ? 'destructive' : 'primary'}
                    text={
                        block ? t('userProfile.block') : t('userProfile.ignore')
                    }
                    loading={pending}
                    disabled={pending}
                    grow
                    onPress={confirm}
                />
                <FeatureGuideText onOpen={closeSheet} />
            </View>
        </ActionSheet>
    )
}

/** "Too much?" or "Not enough?": the other restriction, in place of this sheet. */
function InsteadRow({
    restriction,
    userId,
    name,
}: {
    restriction: Restriction
    userId: string
    name: string
}) {
    const block = restriction === 'block'
    const other: Restriction = block ? 'ignore' : 'block'
    return (
        <View style={styles.instead}>
            <TableRowGroup
                title={
                    block
                        ? t('safety.block.tooMuch')
                        : t('safety.ignore.notEnough')
                }
                hasIcons
            >
                <TableRow
                    icon={
                        <TableRowIcon
                            name={RESTRICTION_ICONS[other]}
                            variant={block ? 'default' : 'danger'}
                        />
                    }
                    label={
                        block
                            ? t('safety.block.ignoreInstead')
                            : t('safety.ignore.blockInstead')
                    }
                    subLabel={
                        block ? (
                            t('safety.block.ignoreInsteadDetail')
                        ) : (
                            <Text
                                variant="text-xs/medium"
                                color="TEXT_FEEDBACK_CRITICAL"
                            >
                                {t('safety.ignore.blockInsteadDetail')}
                            </Text>
                        )
                    }
                    variant={block ? 'default' : 'danger'}
                    arrow
                    onPress={() =>
                        openRestrictionConfirmation(
                            other,
                            userId,
                            name,
                            'replaceTopSheet',
                        )
                    }
                />
            </TableRowGroup>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // The sheet pads the sides.
    container: { paddingTop: theme.space.PX_16 },
    header: { marginBottom: theme.space.PX_16 },
    avatar: { marginBottom: theme.space.PX_16 },
    centered: { textAlign: 'center' },
    table: { marginBottom: theme.space.PX_16 },
    instead: { marginBottom: theme.space.PX_24 },
}))
