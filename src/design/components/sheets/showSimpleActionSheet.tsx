import { SimpleActionSheet } from './SimpleActionSheet'
import { openActionSheet } from './sheetStore'
import type { SimpleActionSheetProps } from './SimpleActionSheet'
import type { SheetStackingBehavior } from './sheetStore'

/** Opens a SimpleActionSheet under `key`. */
export function showSimpleActionSheet({
    key,
    stackingBehavior,
    ...props
}: SimpleActionSheetProps & {
    key: string
    stackingBehavior?: SheetStackingBehavior
}): void {
    openActionSheet(key, <SimpleActionSheet {...props} />, { stackingBehavior })
}
