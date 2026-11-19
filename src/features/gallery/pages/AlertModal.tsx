import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Button } from '../../../design/components/buttons/Button'
import {
    AlertActionButton,
    AlertActions,
    AlertModal,
} from '../../../design/components/modals/AlertModal'
import { openAlert } from '../../../design/components/modals/alertStore'
import {
    showAlert,
    showConfirmModal,
} from '../../../design/components/modals/showAlert'
import { Icon } from '../../../design/icons/Icon'

const wait = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms))

export function AlertModalPage() {
    return (
        <View style={styles.column}>
            <Button
                text="Alert"
                variant="secondary"
                onPress={() =>
                    showAlert({
                        key: 'demo-info',
                        title: 'Heads up',
                        content: 'This is a single-button alert.',
                    })
                }
            />
            <Button
                text="Confirm (destructive)"
                variant="secondary"
                onPress={() =>
                    showConfirmModal({
                        key: 'demo-confirm',
                        title: 'Remove this account?',
                        content: "You'll have to log in again later.",
                        confirmText: 'Remove',
                    })
                }
            />
            <Button
                text="Confirm (primary)"
                variant="secondary"
                onPress={() =>
                    showConfirmModal({
                        key: 'demo-confirm-primary',
                        title: 'Leave server?',
                        content: 'You can rejoin with a new invite.',
                        confirmText: 'Leave',
                        variant: 'primary',
                    })
                }
            />
            <Button
                text="Async action (loading)"
                variant="secondary"
                onPress={() =>
                    openAlert(
                        'demo-async',
                        <AlertModal
                            title="Save changes?"
                            content="The button spins until the promise settles, then the alert closes."
                            actions={
                                <AlertActions>
                                    <AlertActionButton
                                        text="Save"
                                        onPress={() => wait(1500)}
                                    />
                                    <AlertActionButton
                                        variant="secondary"
                                        text="Cancel"
                                    />
                                </AlertActions>
                            }
                        />,
                    )
                }
            />
            <Button
                text="Header and extra content"
                variant="secondary"
                onPress={() =>
                    openAlert(
                        'demo-rich',
                        <AlertModal
                            header={
                                <Icon
                                    name="WarningIcon"
                                    size="lg"
                                    color="STATUS_WARNING"
                                />
                            }
                            title="Rich alert"
                            content="Header above, extra content below the text."
                            extraContent={
                                <Button text="Extra" variant="tertiary" grow />
                            }
                            actions={
                                <AlertActions>
                                    <AlertActionButton text="Okay" />
                                </AlertActions>
                            }
                        />,
                    )
                }
            />
            <Button
                text="Pinned (not dismissable)"
                variant="secondary"
                onPress={() =>
                    showAlert({
                        key: 'demo-pinned',
                        title: 'Pinned',
                        content:
                            'The backdrop and back button do nothing; use the button.',
                        dismissable: false,
                    })
                }
            />
            <Button
                text="Stack of three"
                variant="secondary"
                onPress={() => {
                    showAlert({
                        key: 'demo-stack-1',
                        title: 'First',
                        content: 'Opened first.',
                    })
                    showAlert({
                        key: 'demo-stack-2',
                        title: 'Second',
                        content: 'Opened second.',
                    })
                    showAlert({
                        key: 'demo-stack-3',
                        title: 'Third',
                        content: 'Opened last, so it is in front.',
                    })
                }}
            />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    column: { gap: theme.space.PX_12 },
}))
