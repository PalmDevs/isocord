import {
    useNavigation,
    useNavigationState,
    usePreventRemove,
} from '@react-navigation/native'
import { useEffect } from 'react'
import { BackHandler, StyleSheet as NativeStyleSheet, View } from 'react-native'
import { AlertPile } from '../modals/AlertPile'
import { dismissTopAlert, useAlertStore } from '../modals/alertStore'
import { SheetLayer } from '../sheets/SheetLayer'
import { hideActionSheet, useSheetStore } from '../sheets/sheetStore'
import {
    closeLayerPopover,
    PopoverBackground,
    PopoverLayer,
} from './PopoverLayer'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { AlertEntry } from '../modals/alertStore'
import type { SheetEntry } from '../sheets/sheetStore'

type ModalLayer =
    | { kind: 'sheet'; sheet: SheetEntry }
    /** Front-most first, as AlertPile takes them. */
    | { kind: 'alerts'; alerts: [AlertEntry, ...AlertEntry[]] }

/** Returns sheets and alerts back to front, with each run of adjacent alerts as one pile. */
function stackLayers(sheets: SheetEntry[], alerts: AlertEntry[]): ModalLayer[] {
    const entries = [
        ...sheets.map(sheet => ({ order: sheet.order, sheet })),
        ...alerts.map(alert => ({ order: alert.order, alert })),
    ].sort((a, b) => a.order - b.order)
    const layers: ModalLayer[] = []
    for (const entry of entries) {
        if ('sheet' in entry) {
            layers.push({ kind: 'sheet', sheet: entry.sheet })
            continue
        }
        const last = layers.at(-1)
        if (last?.kind === 'alerts') last.alerts.unshift(entry.alert)
        else layers.push({ kind: 'alerts', alerts: [entry.alert] })
    }
    return layers
}

/**
 * Closes the front-most alert or sheet. Pinned alerts stay. Returns whether one was open. Back is swallowed while
 * the front sheet animates out.
 */
function closeFrontModal(): boolean {
    if (closeLayerPopover()) return true
    const alert = useAlertStore.getState().alerts[0]
    const sheet = useSheetStore.getState().sheets.at(-1)
    if (sheet && (!alert || sheet.order > alert.order)) {
        if (!sheet.closing) hideActionSheet(sheet.key)
        return true
    }
    return dismissTopAlert()
}

export function useModalOpen() {
    const sheetsOpen = useSheetStore(state => state.sheets.length > 0)
    const alertsOpen = useAlertStore(state => state.alerts.length > 0)
    return sheetsOpen || alertsOpen
}

/** Handles the preview stack's native dismiss action while an overlay owns Back. */
export function useNativeDismissGuard(enabled: boolean, close: () => void) {
    const navigation = useNavigation()
    // StackRouter.dismiss requires a second screen. BackHandler owns Back at the root.
    const canDismiss = useNavigationState(state => state.index > 0)
    usePreventRemove(enabled && canDismiss, ({ data }) => {
        if (data.action.type === 'DISMISS') close()
        else navigation.dispatch(data.action)
    })
}

/** AccessibilityView: keeps the navigator out of TalkBack while an alert is open. */
export function ModalScreen({
    children,
    style,
}: {
    children: ReactNode
    style: StyleProp<ViewStyle>
}) {
    useNativeDismissGuard(useModalOpen(), closeFrontModal)
    const alertOpen = useAlertStore(state => state.alerts.length > 0)
    return (
        <PopoverBackground accessibilityHidden={alertOpen} style={style}>
            {children}
        </PopoverBackground>
    )
}

/**
 * Renders sheets and alerts in the order they were opened, so a sheet opened from an alert draws
 * over it and the reverse. Mount once, above the navigator. Android back closes the front one.
 */
export function ModalStack() {
    const sheets = useSheetStore(state => state.sheets)
    const alerts = useAlertStore(state => state.alerts)
    const layers = stackLayers(sheets, alerts)
    // Closing sheets count, so a second back during an exit animation doesn't reach the navigator.
    const open = alerts.length > 0 || sheets.length > 0

    useEffect(() => {
        if (!open) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            closeFrontModal,
        )
        return () => subscription.remove()
    }, [open])

    return (
        <View pointerEvents="box-none" style={NativeStyleSheet.absoluteFill}>
            <PopoverBackground style={NativeStyleSheet.absoluteFill}>
                {layers.map((layer, index) => {
                    const front = index === layers.length - 1
                    return layer.kind === 'sheet' ? (
                        <SheetLayer
                            key={layer.sheet.key}
                            sheet={layer.sheet}
                            front={front}
                        />
                    ) : (
                        // Keyed by the back-most alert, which stays while the pile grows.
                        <AlertPile
                            key={layer.alerts.at(-1)?.key}
                            alerts={layer.alerts}
                            front={front}
                        />
                    )
                })}
            </PopoverBackground>
            <PopoverLayer />
        </View>
    )
}
