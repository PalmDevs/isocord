import { SheetHost } from '../../design/components/sheets/SheetHost'
import type { Feature } from '../../core/feature'

export {
    hideActionSheet,
    hideAllActionSheets,
    openActionSheet,
    openLazy,
    type SheetStackingBehavior,
} from '../../design/components/sheets/sheetStore'
export { showSimpleActionSheet } from '../../design/components/sheets/showSimpleActionSheet'

/** Mounts the host that renders sheets opened with `openActionSheet` / `showSimpleActionSheet`. */
export const sheetsFeature: Feature = {
    name: 'sheets',
    overlays: { sheets: SheetHost },
}
