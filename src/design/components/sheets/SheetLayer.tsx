import { StyleSheet as NativeStyleSheet, View } from 'react-native'
import { Dialog } from '../modals/Dialog'
import { useLayerPopoverOpen } from '../overlays/PopoverLayer'
import { ScopedThemeScope } from '../overlays/scopedTheme'
import { SheetContext } from './sheetContext'
import { hideActionSheet, removeActionSheet } from './sheetStore'
import type { SheetEntry } from './sheetStore'

/** Draws one open sheet. Rendered by ModalStack. Only the front sheet takes touches. */
export function SheetLayer({
    sheet,
    front,
}: {
    sheet: SheetEntry
    front: boolean
}) {
    const { key, closing, theme, buttonTheme } = sheet
    const popoverOpen = useLayerPopoverOpen()
    const content = (
        <SheetContext
            value={{
                closing,
                buttonTheme,
                backPreviewKey:
                    front && !closing && !popoverOpen ? key : undefined,
                close: () => hideActionSheet(key),
                onClosed: () => removeActionSheet(key),
            }}
        >
            <View
                pointerEvents={front ? 'box-none' : 'none'}
                importantForAccessibility={
                    front ? 'auto' : 'no-hide-descendants'
                }
                // Open order, so the sheet keeps its place among alerts while it animates out.
                style={[NativeStyleSheet.absoluteFill, { zIndex: sheet.order }]}
            >
                <Dialog dialogKey={key} onDismiss={() => hideActionSheet(key)}>
                    {sheet.node}
                </Dialog>
            </View>
        </SheetContext>
    )
    return (
        <ScopedThemeScope
            name={theme}
            buttonTheme={buttonTheme}
            active={front && !closing}
        >
            {content}
        </ScopedThemeScope>
    )
}
