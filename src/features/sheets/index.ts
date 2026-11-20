import type { Feature } from '../../core/feature'

export {
    hideActionSheet,
    hideAllActionSheets,
    openActionSheet,
    openLazy,
    type SheetStackingBehavior,
} from '../../design/components/sheets/sheetStore'
export { showSimpleActionSheet } from '../../design/components/sheets/showSimpleActionSheet'

/** Sheet actions. alertsFeature's ModalStack draws the sheets. */
export const sheetsFeature: Feature = { name: 'sheets' }
