import { useState } from 'react'
import { Button } from '../../../design/components/buttons/Button'
import { Text } from '../../../design/components/Text'
import { RowGroup } from '../../../design/components/table/RowGroup'
import {
    TableCheckboxRow,
    TableRadioGroup,
    TableRadioRow,
    TableSwitchRow,
} from '../../../design/components/table/TableControlRows'
import {
    TableRow,
    TableRowIcon,
} from '../../../design/components/table/TableRow'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { PageSection } from '../GalleryPage'

export function TableRowPage() {
    const [rows, setRows] = useState({
        notifications: true,
        sounds: false,
        danger: false,
        disabled: true,
    })
    const [boxes, setBoxes] = useState({ a: true, b: false })
    const [radio, setRadio] = useState('system')
    return (
        <>
            <PageSection title="TableRow">
                <TableRowGroup title="Settings" hasIcons>
                    <TableRow
                        label="Label only"
                        icon={<TableRowIcon name="BellIcon" />}
                    />
                    <TableRow
                        label="With sub label"
                        subLabel="Supporting text"
                        icon={<TableRowIcon name="LockIcon" />}
                        arrow
                    />
                    <TableRow
                        label="Danger"
                        variant="danger"
                        icon={
                            <TableRowIcon name="TrashIcon" variant="danger" />
                        }
                        arrow
                    />
                    <TableRow
                        label="Disabled"
                        disabled
                        icon={<TableRowIcon name="GlobeEarthIcon" />}
                    />
                </TableRowGroup>
            </PageSection>
            <PageSection title="TableSwitchRow">
                <TableRowGroup>
                    <TableSwitchRow
                        label="Notifications"
                        subLabel="Get pinged for messages"
                        value={rows.notifications}
                        onValueChange={notifications =>
                            setRows(r => ({ ...r, notifications }))
                        }
                    />
                    <TableSwitchRow
                        label="Sounds"
                        value={rows.sounds}
                        onValueChange={sounds =>
                            setRows(r => ({ ...r, sounds }))
                        }
                    />
                    <TableSwitchRow
                        label="Dangerous option"
                        variant="danger"
                        value={rows.danger}
                        onValueChange={danger =>
                            setRows(r => ({ ...r, danger }))
                        }
                    />
                    <TableSwitchRow
                        label="Disabled"
                        value={rows.disabled}
                        disabled
                    />
                </TableRowGroup>
            </PageSection>
            <PageSection title="TableCheckboxRow">
                <TableRowGroup>
                    <TableCheckboxRow
                        label="Direct messages"
                        checked={boxes.a}
                        onPress={a => setBoxes(b => ({ ...b, a }))}
                    />
                    <TableCheckboxRow
                        label="Mentions"
                        subLabel="Only when someone @mentions you"
                        checked={boxes.b}
                        onPress={b => setBoxes(x => ({ ...x, b }))}
                    />
                    <TableCheckboxRow
                        label="Disabled"
                        checked
                        disabled
                        onPress={() => {}}
                    />
                </TableRowGroup>
            </PageSection>
            <PageSection title="TableRadioGroup">
                <TableRadioGroup
                    title="Theme"
                    description="Controlled by the parent."
                    helperText="Pick one."
                    value={radio}
                    onChange={setRadio}
                >
                    <TableRadioRow value="system" label="System" />
                    <TableRadioRow
                        value="light"
                        label="Light"
                        subLabel="Easy on the eyes in daylight"
                    />
                    <TableRadioRow value="dark" label="Dark" />
                    <TableRadioRow value="disabled" label="Disabled" disabled />
                </TableRadioGroup>
                <TableRadioGroup
                    defaultValue="b"
                    accessibilityLabel="Uncontrolled group"
                >
                    <TableRadioRow value="a" label="Uncontrolled A" />
                    <TableRadioRow value="b" label="Uncontrolled B" />
                </TableRadioGroup>
            </PageSection>
            <PageSection title="RowGroup">
                <RowGroup
                    title="Title"
                    trailing={
                        <Button text="Edit" size="sm" variant="secondary" />
                    }
                >
                    <Text>
                        Free-form content inside a TableRow-coloured panel.
                    </Text>
                </RowGroup>
            </PageSection>
        </>
    )
}
