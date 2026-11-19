import {
    ActionSheet,
    BottomSheetTitleHeader,
} from '../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../design/components/sheets/sheetContext'
import {
    TableRadioGroup,
    TableRadioRow,
} from '../../design/components/table/TableControlRows'
import { t } from '../../i18n'

export type SortOrder = 'newest' | 'oldest'

/** UserSettingsDebugLogsActionSheet's filters sheet, without Refresh as the list updates itself. Choosing closes it. */
export function DebugLogsOptionsSheet({
    sortOrder,
    onSortOrderChanged,
}: {
    sortOrder: SortOrder
    onSortOrderChanged: (sortOrder: SortOrder) => void
}) {
    const close = useCloseSheet()
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader title={t('debugLogs.filterOptions')} />
            }
        >
            <TableRadioGroup
                title={t('debugLogs.sortOrder')}
                defaultValue={sortOrder}
                onChange={value => {
                    onSortOrderChanged(value as SortOrder)
                    close()
                }}
            >
                <TableRadioRow
                    label={t('debugLogs.sortNewest')}
                    value="newest"
                />
                <TableRadioRow
                    label={t('debugLogs.sortOldest')}
                    value="oldest"
                />
            </TableRadioGroup>
        </ActionSheet>
    )
}
