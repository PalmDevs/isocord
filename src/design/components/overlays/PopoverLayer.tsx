import { useId, useLayoutEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { create } from 'zustand'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

interface PopoverEntry {
    id: string
    content: ReactNode
    close: () => void
}

const usePopoverLayer = create<{ entry: PopoverEntry | null }>(() => ({
    entry: null,
}))

/** Keeps covered controls out of Android's accessibility tree. */
export function PopoverBackground({
    accessibilityHidden = false,
    children,
    style,
}: {
    accessibilityHidden?: boolean
    children: ReactNode
    style: StyleProp<ViewStyle>
}) {
    const covered = usePopoverLayer(state => state.entry !== null)
    return (
        <View
            collapsable={false}
            importantForAccessibility={
                covered || accessibilityHidden ? 'no-hide-descendants' : 'auto'
            }
            pointerEvents={covered ? 'none' : 'box-none'}
            style={style}
        >
            {children}
        </View>
    )
}

export function closeLayerPopover(): boolean {
    const { entry } = usePopoverLayer.getState()
    if (!entry) return false
    entry.close()
    return true
}

/** ContextMenuContainer: draws the menu above the sheet in the same Android window. */
export function PopoverLayer() {
    const entry = usePopoverLayer(state => state.entry)
    return entry ? (
        <View key={entry.id} style={StyleSheet.absoluteFill}>
            {entry.content}
        </View>
    ) : null
}

/** Publishes content for the lifetime of the trigger. */
export function LayerPopover({
    children,
    close,
}: {
    children: ReactNode
    close: () => void
}) {
    const id = useId()
    useLayoutEffect(() => {
        usePopoverLayer.setState({ entry: { id, content: children, close } })
    }, [id, children, close])
    useLayoutEffect(
        () => () => {
            usePopoverLayer.setState(state =>
                state.entry?.id === id ? { entry: null } : state,
            )
        },
        [id],
    )
    return null
}
