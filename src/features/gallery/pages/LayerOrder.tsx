import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { snowflakeFromTimestamp } from '../../../core/discord/snowflake'
import { useSession } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import { showAlert } from '../../../design/components/modals/showAlert'
import { showToast } from '../../../design/components/overlays/toastStore'
import {
    ActionSheet,
    ActionSheetCloseButton,
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
    BottomSheetTitleHeader,
} from '../../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { TableRow } from '../../../design/components/table/TableRow'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { channelsStore } from '../../../stores/channels/channels'
import { usersStore } from '../../../stores/users'
import { showInAppNotification } from '../../inAppNotifications/store'
import { serversUiStore } from '../../servers/store'
import { PageSection } from '../GalleryPage'
import type { Session } from '../../../core/session'
import type { Message } from '../../../stores/readStates'

function triggerActionSheet(
    title: string,
    subtitle: string,
    session?: Session,
) {
    openActionSheet(
        `demo-sheet-${Date.now()}`,
        <DemoActionSheet title={title} subtitle={subtitle} session={session} />,
    )
}

function triggerAlertModal(title: string, content: string) {
    showAlert({
        key: `demo-alert-${Date.now()}`,
        title,
        content,
    })
}

function triggerToast(content: string) {
    showToast({
        content,
        icon: 'BellIcon',
    })
}

function triggerInAppNotification(session: Session, content: string) {
    const { selectedGuildId, selectedChannelIds } = session
        .get(serversUiStore)
        .getState()
    const channelId = selectedGuildId
        ? selectedChannelIds[selectedGuildId]
        : undefined
    const channel = channelId
        ? session.get(channelsStore).getState().channels[channelId]
        : undefined
    const author = session.get(usersStore).getState().users[session.userId]

    if (!channel || !author) {
        showToast({
            key: 'layer-order-in-app-err',
            content: 'Select a channel first to test in-app notifications',
            variant: 'critical',
        })
        return
    }

    const id = snowflakeFromTimestamp(Date.now())
    const message: Message = {
        id,
        channel_id: channel.id,
        author,
        type: 0,
        timestamp: new Date().toISOString(),
        content,
        attachments: [],
        sticker_items: [],
        embeds: [],
    }
    showInAppNotification(session, message, channel)
}

function DemoActionSheet({
    title,
    subtitle,
    session,
}: {
    title: string
    subtitle: string
    session?: Session
}) {
    const close = useCloseSheet()
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader
                    title={title}
                    subtitle={subtitle}
                    trailing={<ActionSheetCloseButton />}
                />
            }
        >
            <ActionSheetRowGroup title="Open other overlays">
                <ActionSheetRow
                    label="Show AlertModal"
                    icon={<ActionSheetRowIcon name="WarningIcon" />}
                    onPress={() =>
                        triggerAlertModal(
                            'Alert from Sheet',
                            'Alert opened over an active ActionSheet.',
                        )
                    }
                />
                <ActionSheetRow
                    label="Show Toast"
                    icon={<ActionSheetRowIcon name="BellIcon" />}
                    onPress={() =>
                        triggerToast('Toast launched from ActionSheet')
                    }
                />
                {session ? (
                    <ActionSheetRow
                        label="Show In-App Notification"
                        icon={<ActionSheetRowIcon name="ChatIcon" />}
                        onPress={() =>
                            triggerInAppNotification(
                                session,
                                'Notification launched from ActionSheet',
                            )
                        }
                    />
                ) : null}
                <ActionSheetRow
                    label="Stack another ActionSheet"
                    arrow
                    icon={<ActionSheetRowIcon name="ShareIcon" />}
                    onPress={() =>
                        triggerActionSheet(
                            'Stacked Sheet',
                            'Opened on top of the first sheet',
                            session,
                        )
                    }
                />
            </ActionSheetRowGroup>
            <ActionSheetRowGroup>
                <ActionSheetRow
                    label="Close"
                    variant="danger"
                    icon={
                        <ActionSheetRowIcon name="TrashIcon" variant="danger" />
                    }
                    onPress={close}
                />
            </ActionSheetRowGroup>
        </ActionSheet>
    )
}

const DELAY_SECONDS = 2

export function LayerOrderPage() {
    const session = useSession()

    const triggerDelayed = (action: () => void, label: string) => {
        showToast({
            key: 'delay-toast',
            content: `Opening ${label} in ${DELAY_SECONDS}s...`,
        })
        setTimeout(action, DELAY_SECONDS * 1000)
    }

    return (
        <View style={styles.container}>
            <PageSection title="Individual Overlays">
                <TableRowGroup description="Spawn each overlay independently.">
                    <TableRow
                        label="Open ActionSheet"
                        subLabel="Bottom sheet modal"
                        onPress={() =>
                            triggerActionSheet(
                                'Test ActionSheet',
                                'Directly opened from Layer Order test page',
                                session,
                            )
                        }
                    />
                    <TableRow
                        label="Open AlertModal"
                        subLabel="Centered modal dialog"
                        onPress={() =>
                            triggerAlertModal(
                                'Test AlertModal',
                                'Directly opened from Layer Order test page',
                            )
                        }
                    />
                    <TableRow
                        label="Show Toast"
                        subLabel="Top-anchored transient pill"
                        onPress={() => triggerToast('Test Toast notification')}
                    />
                    <TableRow
                        label="Show In-App Notification"
                        subLabel="Top-anchored banner"
                        onPress={() =>
                            triggerInAppNotification(
                                session,
                                'Test In-App Notification message',
                            )
                        }
                    />
                </TableRowGroup>
            </PageSection>

            <PageSection title="Delayed Triggers (Test Layering Over Modals)">
                <TableRowGroup description="Tap to schedule an overlay after 2 seconds, then immediately open a sheet or alert to test layering.">
                    <TableRow
                        label="Delayed ActionSheet (2s)"
                        onPress={() =>
                            triggerDelayed(
                                () =>
                                    triggerActionSheet(
                                        'Delayed ActionSheet',
                                        'Fired after delay',
                                        session,
                                    ),
                                'ActionSheet',
                            )
                        }
                    />
                    <TableRow
                        label="Delayed AlertModal (2s)"
                        onPress={() =>
                            triggerDelayed(
                                () =>
                                    triggerAlertModal(
                                        'Delayed AlertModal',
                                        'Fired after delay',
                                    ),
                                'AlertModal',
                            )
                        }
                    />
                    <TableRow
                        label="Delayed In-App Notification (2s)"
                        onPress={() =>
                            triggerDelayed(
                                () =>
                                    triggerInAppNotification(
                                        session,
                                        'Delayed notification banner',
                                    ),
                                'Notification',
                            )
                        }
                    />
                    <TableRow
                        label="Delayed Toast (2s)"
                        onPress={() =>
                            triggerDelayed(
                                () =>
                                    triggerToast('Delayed Toast notification'),
                                'Toast',
                            )
                        }
                    />
                </TableRowGroup>
            </PageSection>

            <PageSection title="Simultaneous Combinations">
                <View style={styles.buttonStack}>
                    <Button
                        text="Open All 4 Overlays (Sheet + Alert + Notif + Toast)"
                        variant="primary"
                        onPress={() => {
                            triggerActionSheet(
                                'ActionSheet Layer',
                                'Base layer',
                                session,
                            )
                            triggerAlertModal(
                                'AlertModal Layer',
                                'Alert modal opened along with sheet.',
                            )
                            triggerInAppNotification(
                                session,
                                'In-App Notification Banner',
                            )
                            triggerToast('Top Toast Notification')
                        }}
                    />
                    <Button
                        text="Sheet + AlertModal"
                        variant="secondary"
                        onPress={() => {
                            triggerActionSheet(
                                'Sheet Under Alert',
                                'Sheet opened first',
                                session,
                            )
                            triggerAlertModal(
                                'Alert Over Sheet',
                                'Alert opened second',
                            )
                        }}
                    />
                    <Button
                        text="AlertModal + Sheet"
                        variant="secondary"
                        onPress={() => {
                            triggerAlertModal(
                                'Alert Under Sheet',
                                'Alert opened first',
                            )
                            triggerActionSheet(
                                'Sheet Over Alert',
                                'Sheet opened second',
                                session,
                            )
                        }}
                    />
                    <Button
                        text="Notification + Toast"
                        variant="secondary"
                        onPress={() => {
                            triggerInAppNotification(
                                session,
                                'Notification underneath Toast',
                            )
                            triggerToast('Toast above Notification')
                        }}
                    />
                </View>
            </PageSection>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { gap: theme.space.PX_24 },
    buttonStack: { gap: theme.space.PX_12 },
}))
