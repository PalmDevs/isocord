import { useState } from 'react'
import { Button } from '../../../design/components/buttons/Button'
import { ButtonGroup } from '../../../design/components/buttons/ButtonGroup'
import {
    IconButton,
    ToggleIconButton,
} from '../../../design/components/buttons/IconButton'
import { Stack } from '../../../design/components/layout/Stack'
import { RowButton } from '../../../design/components/table/RowButton'
import { TableSwitchRow } from '../../../design/components/table/TableControlRows'
import { TableRowIcon } from '../../../design/components/table/TableRow'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { PageSection } from '../GalleryPage'
import type { ButtonVariant } from '../../../design/components/buttons/buttonVariants'
import type { IconButtonVariant } from '../../../design/components/buttons/IconButton'

const BUTTON_VARIANTS: ButtonVariant[] = [
    'primary',
    'secondary',
    'tertiary',
    'destructive',
    'critical-primary',
    'critical-secondary',
    'active',
    'primary-overlay',
    'secondary-overlay',
]

export function ButtonPage() {
    const [disabled, setDisabled] = useState(false)
    const [loading, setLoading] = useState(false)
    const [icon, setIcon] = useState(false)
    return (
        <>
            <PageSection title="Props">
                <TableRowGroup>
                    <TableSwitchRow
                        label="disabled"
                        value={disabled}
                        onValueChange={setDisabled}
                    />
                    <TableSwitchRow
                        label="loading"
                        value={loading}
                        onValueChange={setLoading}
                    />
                    <TableSwitchRow
                        label="icon"
                        value={icon}
                        onValueChange={setIcon}
                    />
                </TableRowGroup>
            </PageSection>
            <PageSection title="Variants">
                <Stack spacing={8} align="flex-start">
                    {BUTTON_VARIANTS.map(variant => (
                        <Button
                            key={variant}
                            text={variant}
                            variant={variant}
                            disabled={disabled}
                            loading={loading}
                            icon={icon ? 'PlusLargeIcon' : undefined}
                        />
                    ))}
                </Stack>
            </PageSection>
            <PageSection title="Sizes">
                <Stack spacing={8} align="flex-start">
                    <Button text="Small" size="sm" icon="PlusLargeIcon" />
                    <Button text="Medium" size="md" icon="PlusLargeIcon" />
                    <Button
                        text="Large"
                        size="lg"
                        icon="PlusLargeIcon"
                        iconPosition="end"
                    />
                    <Button text="Grow" grow variant="secondary" />
                </Stack>
            </PageSection>
        </>
    )
}

export function ButtonGroupPage() {
    return (
        <>
            <PageSection title="Medium">
                <ButtonGroup>
                    <Button text="Continue" grow />
                    <Button text="Cancel" variant="secondary" grow />
                </ButtonGroup>
            </PageSection>
            <PageSection title="Small">
                <ButtonGroup size="sm">
                    <Button text="Continue" size="sm" grow />
                    <Button text="Cancel" size="sm" variant="secondary" grow />
                </ButtonGroup>
            </PageSection>
        </>
    )
}

export function RowButtonPage() {
    const [pressed, setPressed] = useState('Not pressed')
    return (
        <PageSection title={`Variants: ${pressed}`}>
            <RowButton
                icon="BellIcon"
                label="Secondary (default)"
                onPress={() => setPressed('Secondary')}
            />
            <RowButton
                icon="LockIcon"
                variant="primary"
                label="Primary"
                subLabel="With a sub label"
                onPress={() => setPressed('Primary')}
            />
            <RowButton
                icon={<TableRowIcon name="TrashIcon" variant="danger" />}
                label="Custom icon, no arrow"
                arrow={false}
            />
            <RowButton icon="GlobeEarthIcon" label="Disabled" disabled />
        </PageSection>
    )
}

const ICON_BUTTON_VARIANTS: IconButtonVariant[] = [
    'icon-only',
    ...BUTTON_VARIANTS,
]

export function IconButtonPage() {
    const [disabled, setDisabled] = useState(false)
    const [loading, setLoading] = useState(false)
    return (
        <>
            <PageSection title="Props">
                <TableRowGroup>
                    <TableSwitchRow
                        label="disabled"
                        value={disabled}
                        onValueChange={setDisabled}
                    />
                    <TableSwitchRow
                        label="loading"
                        value={loading}
                        onValueChange={setLoading}
                    />
                </TableRowGroup>
            </PageSection>
            <PageSection title="Variants">
                <Stack spacing={8} align="flex-start">
                    {ICON_BUTTON_VARIANTS.map(variant => (
                        <IconButton
                            key={variant}
                            icon="PlusLargeIcon"
                            variant={variant}
                            accessibilityLabel={variant}
                            disabled={disabled}
                            loading={loading}
                        />
                    ))}
                </Stack>
            </PageSection>
            <PageSection title="Sizes">
                <Stack direction="horizontal" spacing={8} align="center">
                    <IconButton icon="BellIcon" size="sm" variant="secondary" />
                    <IconButton icon="BellIcon" size="md" variant="secondary" />
                    <IconButton icon="BellIcon" size="lg" variant="secondary" />
                </Stack>
            </PageSection>
            <PageSection title="With label">
                <Stack direction="horizontal" spacing={16} align="flex-start">
                    <IconButton
                        icon="MicrophoneIcon"
                        label="Mute"
                        variant="secondary"
                    />
                    <IconButton
                        icon="VideoIcon"
                        label="Video"
                        variant="secondary"
                    />
                </Stack>
            </PageSection>
            <PageSection title="Toggle">
                <ToggleRow />
            </PageSection>
        </>
    )
}

function ToggleRow() {
    const [on, setOn] = useState<Record<string, boolean>>({})
    const toggle = (key: string) =>
        setOn(prev => ({ ...prev, [key]: !prev[key] }))
    return (
        <Stack direction="horizontal" spacing={8} align="center">
            {(['default', 'critical', 'icon-only'] as const).map(variant => (
                <ToggleIconButton
                    key={variant}
                    variant={variant}
                    icon="HeartOutlineIcon"
                    selectedIcon="HeartIcon"
                    pressed={!!on[variant]}
                    accessibilityLabel={`${variant} toggle`}
                    onPress={() => toggle(variant)}
                />
            ))}
        </Stack>
    )
}
