import { useId } from 'react'
import { StyleSheet as NativeStyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'

export interface DialogProps {
    children?: ReactNode
    /** Native id of the dialog root. Defaults to a generated id. */
    dialogKey?: string
    /** Called on the screen reader's escape gesture (iOS). */
    onDismiss?: () => void
}

/** Full-screen container that tells screen readers everything outside it is inert. */
export function Dialog({ children, dialogKey, onDismiss }: DialogProps) {
    const id = useId()
    return (
        <View
            accessibilityViewIsModal
            onAccessibilityEscape={onDismiss}
            nativeID={dialogKey ?? id}
            pointerEvents="box-none"
            style={NativeStyleSheet.absoluteFill}
        >
            {children}
        </View>
    )
}
