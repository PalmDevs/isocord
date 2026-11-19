import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Button } from '../../../design/components/buttons/Button'
import { Coachmark } from '../../../design/components/overlays/Coachmark'
import { ContextMenu } from '../../../design/components/overlays/ContextMenu'
import {
    MenuGroup,
    MenuItem,
    MenuPopout,
} from '../../../design/components/overlays/Menu'
import { Tooltip } from '../../../design/components/overlays/Tooltip'
import {
    ActionSheet,
    ActionSheetCloseButton,
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
    BottomSheet,
    BottomSheetTitleHeader,
} from '../../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { showSimpleActionSheet } from '../../../design/components/sheets/showSimpleActionSheet'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'

const ROWS = Array.from({ length: 30 }, (_, index) => `Row ${index + 1}`)

function SimpleDemo() {
    return (
        <Button
            text="Simple action sheet"
            variant="secondary"
            onPress={() =>
                showSimpleActionSheet({
                    key: 'demo-simple',
                    header: { title: 'general', subtitle: 'Text channel' },
                    options: [
                        {
                            label: 'Mark as read',
                            icon: 'CheckmarkLargeIcon',
                            onPress: () => {},
                        },
                        {
                            label: 'Copy link',
                            icon: 'LinkIcon',
                            onPress: () => {},
                        },
                        {
                            label: 'Mute channel',
                            icon: 'BellSlashIcon',
                            onPress: () => {},
                        },
                        {
                            label: 'Leave',
                            icon: 'TrashIcon',
                            isDestructive: true,
                            onPress: () => {},
                        },
                    ],
                })
            }
        />
    )
}

/** Content sized to fit: no scroll view, the sheet hugs it. */
function FitSheet() {
    const close = useCloseSheet()
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader
                    title="Fit to content"
                    subtitle="Drag the handle down to dismiss"
                    trailing={<ActionSheetCloseButton />}
                />
            }
        >
            <ActionSheetRowGroup title="Actions" hasIcons>
                <ActionSheetRow
                    label="Pin message"
                    icon={<ActionSheetRowIcon name="PinIcon" />}
                    onPress={close}
                />
                <ActionSheetRow
                    label="Copy text"
                    icon={<ActionSheetRowIcon name="CopyIcon" />}
                    onPress={close}
                />
                <ActionSheetRow
                    label="Open another sheet"
                    arrow
                    icon={<ActionSheetRowIcon name="ShareIcon" />}
                    onPress={() =>
                        openActionSheet('demo-stacked', <StackedSheet />, {
                            stackingBehavior: 'stack',
                        })
                    }
                />
            </ActionSheetRowGroup>
            <ActionSheetRowGroup hasIcons>
                <ActionSheetRow
                    label="Report"
                    variant="danger"
                    icon={
                        <ActionSheetRowIcon name="FlagIcon" variant="danger" />
                    }
                    onPress={close}
                />
            </ActionSheetRowGroup>
        </ActionSheet>
    )
}

function StackedSheet() {
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader
                    title="Stacked"
                    subtitle="Opened on top of the first sheet"
                />
            }
        >
            <Text color="TEXT_DEFAULT">
                Closing this one leaves the first sheet where it was.
            </Text>
        </ActionSheet>
    )
}

/** Scrollable: opens at 60% of the window and drags up to full height. */
function ScrollSheet() {
    return (
        <BottomSheet
            scrollable
            header={
                <BottomSheetTitleHeader
                    title="Scrollable sheet"
                    leading={<ActionSheetCloseButton />}
                />
            }
            contentStyles={styles.scrollContent}
            bodyStyles={styles.scrollBody}
        >
            <ActionSheetRowGroup>
                {ROWS.map(label => (
                    <ActionSheetRow
                        key={label}
                        label={label}
                        subLabel="Scroll, or drag the handle up"
                    />
                ))}
            </ActionSheetRowGroup>
        </BottomSheet>
    )
}

export function SheetsPage() {
    return (
        <View style={styles.stack}>
            <SimpleDemo />
            <Button
                text="Fit-to-content sheet (stacks another)"
                variant="secondary"
                onPress={() => openActionSheet('demo-fit', <FitSheet />)}
            />
            <Button
                text="Scrollable sheet"
                variant="secondary"
                onPress={() => openActionSheet('demo-scroll', <ScrollSheet />)}
            />
        </View>
    )
}

export function ContextMenuPage() {
    return (
        <View style={styles.row}>
            <MenuPopout
                trigger={({ open, expanded }) => (
                    <Button
                        text={expanded ? 'Menu open' : 'Menu'}
                        variant="secondary"
                        onPress={open}
                    />
                )}
            >
                <MenuGroup>
                    <MenuItem label="Mark as read" icon="CheckmarkLargeIcon" />
                    <MenuItem label="Copy link" icon="LinkIcon" />
                </MenuGroup>
                <MenuGroup>
                    <MenuItem
                        label="Delete"
                        icon="TrashIcon"
                        variant="danger"
                    />
                </MenuGroup>
            </MenuPopout>
            <ContextMenu
                title="Message"
                triggerOnTap
                items={[
                    { label: 'Reply', icon: 'ArrowAngleLeftUpIcon' },
                    { label: 'Copy text', icon: 'CopyIcon', divider: true },
                    {
                        label: 'Delete message',
                        icon: 'TrashIcon',
                        variant: 'destructive',
                    },
                ]}
            >
                <View style={styles.contextTarget}>
                    <Text variant="text-sm/medium" color="TEXT_DEFAULT">
                        Long press or tap me
                    </Text>
                </View>
            </ContextMenu>
        </View>
    )
}

export function TooltipPage() {
    return (
        <Tooltip label="Long press shows this" position="top">
            <View style={styles.iconTarget}>
                <Icon name="CircleInformationIcon" />
            </View>
        </Tooltip>
    )
}

export function CoachmarkPage() {
    const [coachmark, setCoachmark] = useState(false)
    return (
        <Coachmark
            visible={coachmark}
            onDismiss={() => setCoachmark(false)}
            title="New: sheets"
            description="Tap outside, or the close button, to dismiss this."
            buttonText="Got it"
        >
            <Button
                text="Coachmark"
                variant="secondary"
                onPress={() => setCoachmark(true)}
            />
        </Coachmark>
    )
}

const styles = StyleSheet.create(theme => ({
    stack: { gap: theme.space.PX_12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.PX_12 },
    scrollContent: { paddingHorizontal: theme.space.PX_16 },
    scrollBody: { gap: theme.space.PX_24 },
    contextTarget: {
        padding: theme.space.PX_12,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGH,
    },
    iconTarget: { padding: theme.space.PX_8 },
}))
