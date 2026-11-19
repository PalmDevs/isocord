import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useStore } from 'zustand'
import {
    accountsStore,
    removeAccount,
    switchAccount,
} from '../../core/accounts'
import { logout } from '../../core/api/auth'
import { MAX_ACCOUNTS } from '../../core/constants'
import { Avatar } from '../../design/components/avatars/Avatar'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import {
    showAlert,
    showConfirmModal,
} from '../../design/components/modals/showAlert'
import { Text } from '../../design/components/Text'
import { TableRow } from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { Account } from '../../core/accounts'

type Props = NativeStackScreenProps<
    { manageAccounts: undefined; addAccount: undefined },
    'manageAccounts'
>

/** Lists the saved accounts: tap to switch, Edit to log one out, Add Account to sign in to another. */
export function ManageAccounts({ navigation }: Props) {
    const { accounts, currentId } = useStore(accountsStore)
    const [editing, setEditing] = useState(false)

    const confirmRemove = (account: Account) =>
        showConfirmModal({
            key: 'remove-account',
            title: t('accounts.removeTitle'),
            content: t('accounts.removeBody', { username: account.username }),
            confirmText: t('accounts.remove'),
            cancelText: t('common.cancel'),
            onConfirm: () => {
                logout(account)
                removeAccount(account.id)
            },
        })

    const addAccount = () => {
        if (accounts.length >= MAX_ACCOUNTS) {
            showAlert({
                key: 'account-limit',
                title: t('accounts.limitTitle'),
                content: t('accounts.limitBody', {
                    maxNumAccounts: MAX_ACCOUNTS,
                }),
            })
        } else {
            navigation.push('addAccount')
        }
    }

    return (
        <View style={styles.container}>
            <NavigatorHeader
                title={t('accounts.manage')}
                onBack={navigation.goBack}
                backIcon="XLargeIcon"
                backLabel={t('common.close')}
                trailing={
                    <RipplePressable
                        borderless
                        radius={24}
                        accessibilityRole="button"
                        hitSlop={12}
                        onPress={() => setEditing(value => !value)}
                    >
                        <Text variant="text-md/medium" color="TEXT_BRAND">
                            {t(editing ? 'common.done' : 'common.edit')}
                        </Text>
                    </RipplePressable>
                }
            />
            <ScrollView contentContainerStyle={styles.content}>
                <TableRowGroup hasIcons accessibilityRole="radiogroup">
                    {accounts.map(account => {
                        const active = account.id === currentId
                        return (
                            <TableRow
                                key={account.id}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                                accessibilityHint={
                                    active
                                        ? undefined
                                        : t('accounts.switchHint')
                                }
                                onPress={
                                    editing || active
                                        ? undefined
                                        : () => switchAccount(account.id)
                                }
                                icon={
                                    <View style={styles.leading}>
                                        {editing && (
                                            <RipplePressable
                                                borderless
                                                radius={20}
                                                accessibilityRole="button"
                                                accessibilityLabel={t(
                                                    'accounts.logOut',
                                                )}
                                                hitSlop={8}
                                                onPress={() =>
                                                    confirmRemove(account)
                                                }
                                            >
                                                <Icon
                                                    name="CircleMinusIcon"
                                                    color="ICON_FEEDBACK_CRITICAL"
                                                />
                                            </RipplePressable>
                                        )}
                                        <Avatar user={account} size={32} />
                                    </View>
                                }
                                label={account.username}
                                labelLineClamp={1}
                                subLabel={
                                    active ? (
                                        <Text
                                            variant="text-sm/semibold"
                                            color="TEXT_BRAND"
                                        >
                                            {t('accounts.active')}
                                        </Text>
                                    ) : undefined
                                }
                                trailing={
                                    active && !editing ? (
                                        <Icon
                                            name="CircleCheckIcon"
                                            color="TEXT_BRAND"
                                        />
                                    ) : undefined
                                }
                            />
                        )
                    })}
                </TableRowGroup>
                {!editing && (
                    <TableRowGroup hasIcons>
                        <TableRow
                            onPress={addAccount}
                            icon={
                                <Icon name="CirclePlusIcon" color="TEXT_LINK" />
                            }
                            label={
                                <Text
                                    variant="text-md/medium"
                                    color="TEXT_LINK"
                                >
                                    {t('accounts.add')}
                                </Text>
                            }
                        />
                    </TableRowGroup>
                )}
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
    content: {
        padding: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_16,
        gap: theme.space.PX_16,
    },
    leading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_12,
    },
}))
