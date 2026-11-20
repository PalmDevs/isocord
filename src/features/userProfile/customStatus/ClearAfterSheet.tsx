import { useState } from 'react'
import { Button } from '../../../design/components/buttons/Button'
import {
    ActionSheet,
    BottomSheetTitleHeader,
} from '../../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import {
    TableRadioGroup,
    TableRadioRow,
} from '../../../design/components/table/TableControlRows'
import { t } from '../../../i18n'
import { CLEAR_AFTER_OPTIONS, clearAfterOptionLabel } from './clearAfter'
import type { ClearAfter } from './clearAfter'

const SHEET_KEY = 'custom-status-clear-after'

/** Opens ClearAfterOptionsActionSheet. It stacks over the status alert. */
export function openClearAfterSheet(
    initialValue: ClearAfter,
    onChange: (value: ClearAfter) => void,
): void {
    openActionSheet(
        SHEET_KEY,
        <ClearAfterSheet initialValue={initialValue} onChange={onChange} />,
        { stackingBehavior: 'stack' },
    )
}

/** ClearAfterOptionsActionSheet: the pick applies on OK. */
function ClearAfterSheet({
    initialValue,
    onChange,
}: {
    initialValue: ClearAfter
    onChange: (value: ClearAfter) => void
}) {
    const close = useCloseSheet()
    const [selected, setSelected] = useState(initialValue)
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader
                    title={t('userProfile.clearAfter.duration')}
                />
            }
        >
            <TableRadioGroup
                title={t('userProfile.clearAfter.title')}
                value={selected}
                onChange={value => setSelected(value as ClearAfter)}
                hasIcons={false}
            >
                {CLEAR_AFTER_OPTIONS.map(value => (
                    <TableRadioRow
                        key={value}
                        value={value}
                        label={clearAfterOptionLabel(value)}
                    />
                ))}
            </TableRadioGroup>
            <Button
                grow
                text={t('common.ok')}
                onPress={() => {
                    onChange(selected)
                    close()
                }}
            />
        </ActionSheet>
    )
}
