import { useEffect } from 'react'
import { BackHandler, StyleSheet as NativeStyleSheet, View } from 'react-native'
import { Dialog } from '../modals/Dialog'
import { SheetContext } from './sheetContext'
import { hideActionSheet, removeActionSheet, useSheetStore } from './sheetStore'
import type { SheetEntry } from './sheetStore'

/**
 * Renders the sheets opened with `openActionSheet`, stacked in the order they were opened; only the
 * front-most takes touches. Mount once, above the navigator (see sheetsFeature). Android back closes
 * the front-most sheet.
 */
export function SheetHost() {
    const sheets = useSheetStore(state => state.sheets)
    const open = sheets.some(sheet => !sheet.closing)

    useEffect(() => {
        if (!open) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                hideActionSheet()
                return true
            },
        )
        return () => subscription.remove()
    }, [open])

    return (
        <View pointerEvents="box-none" style={NativeStyleSheet.absoluteFill}>
            {sheets.map((sheet, index) => (
                <SheetLayer
                    key={sheet.key}
                    sheet={sheet}
                    index={index}
                    front={index === sheets.length - 1}
                />
            ))}
        </View>
    )
}

function SheetLayer({
    sheet,
    index,
    front,
}: {
    sheet: SheetEntry
    index: number
    front: boolean
}) {
    const { key, closing } = sheet
    return (
        <SheetContext
            value={{
                closing,
                close: () => hideActionSheet(key),
                onClosed: () => removeActionSheet(key),
            }}
        >
            <View
                pointerEvents={front ? 'box-none' : 'none'}
                importantForAccessibility={
                    front ? 'auto' : 'no-hide-descendants'
                }
                style={NativeStyleSheet.absoluteFill}
            >
                <Dialog
                    dialogKey={key}
                    zIndex={index}
                    onDismiss={() => hideActionSheet(key)}
                >
                    {sheet.node}
                </Dialog>
            </View>
        </SheetContext>
    )
}
